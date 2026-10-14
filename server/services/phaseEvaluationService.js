// services/phaseEvaluationService.js
import pool from '../config/db.js';
import { sendPhaseResultsEmail, sendFinalGradeEmail } from '../utils/emailService.js';
import { generatePhaseResultsPDF, generateFinalGradePDF } from '../utils/pdfGenerator.js';

const getResultEmailRecipients = (student) => {
  const institution = String(student.institution || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const isUniversity = institution.includes('universidad') || institution.includes('university');
  const addresses = isUniversity
    ? [student.student_email]
    : [student.student_email, student.contact_email];

  return [...new Set(addresses.map(email => String(email || '').trim()).filter(Boolean))];
};

const claimEmailNotification = async ({ studentId, teacherId, phase, academicYear, type, recipients }) => {
  await pool.query(`
    INSERT INTO improvement_email_notifications
      (student_id, teacher_id, phase, academic_year, notification_type, status, recipients)
    VALUES (?, ?, ?, ?, ?, 'queued', ?)
    ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
  `, [studentId, teacherId, phase, academicYear, type, JSON.stringify(recipients)]);
  const [claim] = await pool.query(`
    UPDATE improvement_email_notifications
    SET status = 'sending', attempts = attempts + 1, recipients = ?, last_error = NULL
    WHERE student_id = ? AND teacher_id = ? AND phase = ? AND academic_year = ?
      AND notification_type = ? AND status IN ('queued', 'failed')
  `, [JSON.stringify(recipients), studentId, teacherId, phase, academicYear, type]);
  return claim.affectedRows === 1;
};

const finishEmailNotification = async ({ studentId, teacherId, phase, academicYear, type, result }) => {
  await pool.query(`
    UPDATE improvement_email_notifications
    SET status = ?, sent_at = ?, last_error = ?
    WHERE student_id = ? AND teacher_id = ? AND phase = ? AND academic_year = ?
      AND notification_type = ? AND status = 'sending'
  `, [result.success ? 'sent' : 'failed', result.success ? new Date() : null,
    result.success ? null : String(result.error || result.message || 'Error desconocido').slice(0, 4000),
    studentId, teacherId, phase, academicYear, type]);
};

const getQuestionnaireIndicatorResults = async ({ studentId, grade, courseId, phase, teacherId }) => {
  const [rows] = await pool.query(`
    SELECT DISTINCT i.id, i.description, i.subject, i.category,
           qi.passing_score, er.best_score, er.best_score AS student_score,
           q.title AS questionnaire_title
    FROM questionnaires q
    JOIN (
      SELECT student_id, questionnaire_id, MAX(best_score) AS best_score
      FROM evaluation_results
      WHERE academic_year = ? OR (academic_year IS NULL AND YEAR(recorded_at) = ?)
      GROUP BY student_id, questionnaire_id
    ) er ON er.questionnaire_id = q.id AND er.student_id = ?
    JOIN questionnaire_indicators qi ON qi.questionnaire_id = q.id
    JOIN indicators i ON i.id = qi.indicator_id
    WHERE q.phase = ? AND q.created_by = ?
      AND (q.is_prueba_saber = FALSE OR q.is_prueba_saber IS NULL)
      AND (q.grade = ? OR q.grade IS NULL)
      AND (q.course_id = ? OR q.course_id IS NULL)
      AND (i.grade = ? OR i.grade IS NULL)
  `, [new Date().getFullYear(), new Date().getFullYear(), studentId, phase, teacherId, grade, courseId, grade]);

  const statusByIndicator = new Map();
  for (const row of rows) {
    const achieved = Number(row.best_score) >= Number(row.passing_score);
    const current = statusByIndicator.get(row.id) || { ...row, achieved: false };
    if (achieved && !current.achieved) {
      Object.assign(current, row, { achieved: true });
    } else if (!achieved && !current.achieved && Number(row.best_score) > Number(current.best_score)) {
      Object.assign(current, row, { achieved: false });
    }
    statusByIndicator.set(row.id, current);
  }
  const indicators = [...statusByIndicator.values()];
  return {
    failed: indicators.filter(indicator => !indicator.achieved),
    passed: indicators.filter(indicator => indicator.achieved)
  };
};

// Función principal para evaluar estudiantes al final de una fase
export const evaluatePhaseResults = async (phase, teacherId, courseIds = []) => {
  try {
    if (!teacherId) {
      throw new Error('Se requiere el docente autenticado para evaluar una fase.');
    }

    console.log(`Iniciando evaluación de resultados para la fase ${phase}`);
    
    // Obtener año académico actual para el período
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    let academicPeriod = `${currentYear}`;
    
    // Determinar período académico (semestre o trimestre)
    if (currentMonth >= 1 && currentMonth <= 6) {
      academicPeriod = `Primer Semestre ${currentYear}`;
    } else {
      academicPeriod = `Segundo Semestre ${currentYear}`;
    }

    // 1. Obtener todos los estudiantes con sus calificaciones para esta fase
    // Incluir datos del docente e institución
    const selectedCourseIds = [...new Set((Array.isArray(courseIds) ? courseIds : []).map(Number).filter(Number.isInteger))];
    if (!selectedCourseIds.length) throw new Error('Selecciona al menos un curso para evaluar.');
    const [students] = await pool.query(`
      SELECT 
        s.id as student_id, 
        s.user_id,
        s.grade,
        s.course_id,
        s.contact_email,
        u.name as student_name,
        u.email as student_email,
        u.institution as student_institution,
        c.name as course_name,
        CASE 
          WHEN ${phase} = 1 THEN g.phase1
          WHEN ${phase} = 2 THEN g.phase2
          WHEN ${phase} = 3 THEN g.phase3
          WHEN ${phase} = 4 THEN g.phase4
        END as phase_score,
        g.phase1,
        g.phase2,
        g.phase3,
        g.phase4,
        g.average as overall_average,
        t.id as teacher_id,
        ut.name as teacher_name,
        t.subject as teacher_subject,
        t.report_brand_name,
        t.report_logo_url,
        COALESCE(c.institution, ut.institution, u.institution) as institution
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN grades g ON s.id = g.student_id
      JOIN courses c ON s.course_id = c.id
      JOIN teachers t ON t.id = ?
      JOIN users ut ON t.user_id = ut.id
      WHERE g.phase${phase} IS NOT NULL
        AND c.id IN (?)
        AND (
          c.teacher_id = ?
          OR EXISTS (
            SELECT 1
            FROM teacher_courses tc
            WHERE tc.teacher_id = ? AND tc.course_id = c.id
          )
        )
    `, [teacherId, selectedCourseIds, teacherId, teacherId]);
    
    console.log(`Encontrados ${students.length} estudiantes con calificaciones para la fase ${phase}`);

    const [questionnairesWithoutIndicators] = await pool.query(`
      SELECT COUNT(DISTINCT q.id) AS total
      FROM questionnaires q
      JOIN students s ON s.course_id IN (?)
        AND (q.grade IS NULL OR q.grade = s.grade)
        AND (q.course_id IS NULL OR q.course_id = s.course_id)
      WHERE q.created_by = ? AND q.phase = ?
        AND NOT EXISTS (
          SELECT 1 FROM questionnaire_indicators qi WHERE qi.questionnaire_id = q.id
        )
    `, [selectedCourseIds, teacherId, phase]);
    const questionnairesMissingIndicators = Number(questionnairesWithoutIndicators[0]?.total || 0);
    let phasePlanTemplates = new Map();
    try {
      const [templates] = await pool.query(`
        SELECT course_id, title, subject, description, activities, deadline_days
        FROM phase_improvement_plan_templates
        WHERE teacher_id = ? AND phase = ? AND academic_year = ? AND enabled = 1 AND course_id IN (?)
      `, [teacherId, phase, currentYear, selectedCourseIds]);
      phasePlanTemplates = new Map(templates.map(template => [Number(template.course_id), template]));
    } catch (templateError) {
      if (templateError.code !== 'ER_NO_SUCH_TABLE') throw templateError;
      console.warn('Plantillas por fase no disponibles; se usará el plan automático estándar hasta aplicar la migración.');
    }
    
    // 2. Para cada estudiante, procesar resultados y enviar emails
    let plansCreated = 0;
    let plansUpdated = 0;
    let studentsNeedingPlanNotice = 0;
    let studentsProcessed = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    
    for (const student of students) {
      studentsProcessed++;
      const hasAllPhases = [student.phase1, student.phase2, student.phase3, student.phase4]
        .every(score => score !== null && score !== undefined && Number.isFinite(Number(score)));
      
      // Obtener indicadores no alcanzados para esta fase
      // Buscar indicadores del estudiante que no alcanzó en esta fase
      const indicatorResults = await getQuestionnaireIndicatorResults({
        studentId: student.student_id,
        grade: student.grade,
        courseId: student.course_id,
        phase,
        teacherId
      });
      const failedIndicators = indicatorResults.failed;
      const achievedIndicators = indicatorResults.passed;
      
      let improvementPlan = null;
      
      // Si nota < 3.5, generar o actualizar plan de mejoramiento
      if (student.phase_score < 3.5) {
        const result = await generateImprovementPlan(student, phase, teacherId, phasePlanTemplates.get(Number(student.course_id)) || null);
        if (result.created) plansCreated++;
        if (result.updated) plansUpdated++;
        
        // Obtener el plan de mejoramiento generado para esta fase
        // Buscar el plan más reciente del estudiante que coincida con la fase
        const [plans] = await pool.query(`
          SELECT ip.* 
          FROM improvement_plans ip
          WHERE ip.student_id = ? 
          AND ip.teacher_id = ?
          AND (ip.academic_year = ? OR ip.academic_year IS NULL)
          AND (ip.title LIKE ? OR ip.title LIKE ? OR ip.title LIKE ?)
          ORDER BY ip.created_at DESC
          LIMIT 1
        `, [
          student.student_id, 
          teacherId,
          currentYear,
          `%Fase ${phase}%`,
          `%fase ${phase}%`,
          `%FASE ${phase}%`
        ]);
        
        if (plans.length > 0) {
          improvementPlan = plans[0];
        }
        if (!improvementPlan) studentsNeedingPlanNotice++;
      } else {
        // Si aprobó, buscar si hay planes anteriores para informar
        const [existingPlans] = await pool.query(`
          SELECT ip.* 
          FROM improvement_plans ip
          WHERE ip.student_id = ? 
          AND ip.teacher_id = ?
          AND (ip.academic_year = ? OR ip.academic_year IS NULL)
          AND (ip.title LIKE ? OR ip.title LIKE ? OR ip.title LIKE ?)
          AND ip.completed = 0
          ORDER BY ip.created_at DESC
          LIMIT 1
        `, [
          student.student_id, 
          teacherId,
          currentYear,
          `%Fase ${phase}%`,
          `%fase ${phase}%`,
          `%FASE ${phase}%`
        ]);
        
        if (existingPlans.length > 0) {
          improvementPlan = existingPlans[0];
          await pool.query(`
            UPDATE improvement_plans
            SET failed_achievements = '', passed_achievements = ?, completed = true,
                activity_status = 'completed', completion_date = COALESCE(completion_date, NOW())
            WHERE id = ?
          `, [achievedIndicators.map(indicator => `• ${indicator.description} (${indicator.subject})`).join('\n'), improvementPlan.id]);
          improvementPlan = {
            ...improvementPlan,
            failed_achievements: '',
            passed_achievements: achievedIndicators.map(indicator => `• ${indicator.description} (${indicator.subject})`).join('\n'),
            completed: true,
            activity_status: 'completed'
          };
        }
      }
      
      // Si es la fase final (4) y el promedio general es < 3.0, marcar como materia perdida
      if (phase === 4 && hasAllPhases && student.overall_average < 3.0) {
        const result = await markFailedSubject(student);
        if (result && result.created) plansCreated++;
        if (result && result.updated) plansUpdated++;
      }
      
      // Preparar datos del estudiante para el email y PDF
      const studentData = {
        id: student.student_id,
        name: student.student_name,
        email: student.student_email,
        contact_email: student.contact_email,
        teacher_name: student.teacher_name,
        grade: student.grade,
        course_name: student.course_name,
        subject: student.teacher_subject,
        final_grade: student.overall_average
      };
      const finalPromotionPassed = phase === 4 && hasAllPhases && student.overall_average != null
        ? Number(student.overall_average) >= 3.0
        : null;
      const resultRecipients = getResultEmailRecipients(student);

      // Preparar datos para el PDF
      const pdfData = {
        studentName: student.student_name,
        studentGrade: student.grade,
        courseName: student.course_name,
        phase: phase,
        phaseScore: student.phase_score,
        finalGrade: student.overall_average,
        teacherName: student.teacher_name || 'N/A',
        teacherSubject: student.teacher_subject || 'N/A',
        reportBrandName: student.report_brand_name || null,
        reportLogoUrl: student.report_logo_url || null,
        institution: student.institution || student.student_institution || 'N/A',
        academicPeriod: academicPeriod,
        failedIndicators: failedIndicators,
        achievedIndicators: achievedIndicators,
        isFinalPass: finalPromotionPassed,
        improvementPlan: improvementPlan
      };
      
      // Generar PDF antes de enviar email
      let pdfBuffer = null;
      try {
        pdfBuffer = await generatePhaseResultsPDF(pdfData);
        console.log(`✅ PDF generado para ${student.student_name} (fase ${phase})`);
      } catch (pdfError) {
        console.error(`❌ Error al generar PDF para ${student.student_name}:`, pdfError);
        // Continuar sin PDF si hay error
      }
      
      // Enviar email con resultados de fase (incluyendo PDF si se generó)
      try {
        if (resultRecipients.length > 0) {
          const notificationKey = { studentId: student.student_id, teacherId, phase, academicYear: currentYear, type: 'phase_result', recipients: resultRecipients };
          const notificationClaimed = await claimEmailNotification(notificationKey);
          const emailResult = notificationClaimed ? await sendPhaseResultsEmail(
            studentData,
            phase,
            student.phase_score,
            improvementPlan,
            failedIndicators,
            pdfBuffer,
            { recipients: resultRecipients, achievedIndicators, isFinalPass: finalPromotionPassed }
          ) : { success: true, skipped: true };
          if (notificationClaimed) await finishEmailNotification({ ...notificationKey, result: emailResult });
          
          if (emailResult.success) {
            if (!emailResult.skipped) emailsSent++;
            console.log(`✅ Email enviado a ${student.student_name} (fase ${phase})`);
            
            // Si hay plan, marcar como enviado
            if (!emailResult.skipped && improvementPlan && student.phase_score < 3.5 && finalPromotionPassed !== true) {
              await pool.query(
                'UPDATE improvement_plans SET email_sent = 1 WHERE id = ?',
                [improvementPlan.id]
              );
            }
          } else {
            emailsFailed++;
            console.warn(`⚠️ Error al enviar email a ${student.student_name}:`, emailResult.error);
          }
        } else {
          console.warn(`⚠️ Estudiante ${student.student_name} no tiene email configurado`);
        }
      } catch (emailError) {
        emailsFailed++;
        console.error(`❌ Error al enviar email a ${student.student_name}:`, emailError);
      }
      
      // Si es fase 4, enviar también email con nota final
      if (phase === 4 && hasAllPhases && resultRecipients.length > 0) {
        try {
          const phaseGrades = {
            phase1: student.phase1,
            phase2: student.phase2,
            phase3: student.phase3,
            phase4: student.phase4
          };

          // Generar PDF de nota final
          let finalPdfBuffer = null;
          try {
            const finalPdfData = {
              studentName: student.student_name,
              studentGrade: student.grade,
              courseName: student.course_name,
              finalGrade: student.overall_average || 0,
              phaseGrades: phaseGrades,
              teacherName: student.teacher_name || 'N/A',
              teacherSubject: student.teacher_subject || 'N/A',
              reportBrandName: student.report_brand_name || null,
              reportLogoUrl: student.report_logo_url || null,
              institution: student.institution || student.student_institution || 'N/A',
              academicPeriod: academicPeriod
            };
            finalPdfBuffer = await generateFinalGradePDF(finalPdfData);
            console.log(`✅ PDF de nota final generado para ${student.student_name}`);
          } catch (pdfError) {
            console.error(`❌ Error al generar PDF de nota final para ${student.student_name}:`, pdfError);
          }
          
          const finalNotificationKey = { studentId: student.student_id, teacherId, phase, academicYear: currentYear, type: 'final_grade', recipients: resultRecipients };
          const finalNotificationClaimed = await claimEmailNotification(finalNotificationKey);
          const finalEmailResult = finalNotificationClaimed ? await sendFinalGradeEmail(
            studentData,
            student.overall_average || 0,
            phaseGrades,
            finalPdfBuffer,
            resultRecipients
          ) : { success: true, skipped: true };
          if (finalNotificationClaimed) await finishEmailNotification({ ...finalNotificationKey, result: finalEmailResult });
          
          if (finalEmailResult.success) {
            console.log(`✅ Email de nota final enviado a ${student.student_name}`);
          } else {
            console.warn(`⚠️ Error al enviar email de nota final a ${student.student_name}:`, finalEmailResult.error);
          }
        } catch (finalEmailError) {
          console.error(`❌ Error al enviar email de nota final a ${student.student_name}:`, finalEmailError);
        }
      }
    }
    
    return { 
      success: true, 
      message: `Evaluación de fase ${phase} completada. ${studentsProcessed} estudiantes procesados. ${plansCreated} planes creados, ${plansUpdated} planes actualizados. ${emailsSent} emails enviados exitosamente, ${emailsFailed} fallos.${studentsNeedingPlanNotice ? ` Atención docente: ${studentsNeedingPlanNotice} estudiante(s) perdieron la fase y no tienen un plan asociado; deben acordar la recuperación.` : ''}${questionnairesMissingIndicators ? ` Atención docente: ${questionnairesMissingIndicators} cuestionario(s) de esta fase no tienen indicadores asociados.` : ''}`,
      studentsProcessed,
      plansCreated,
      plansUpdated,
      studentsNeedingPlanNotice,
      questionnairesMissingIndicators,
      emailsSent,
      emailsFailed
    };
  } catch (error) {
    console.error('Error en evaluación de fase:', error);
    return { success: false, error: error.message };
  }
};

// Función para generar un plan de mejoramiento para un estudiante
export const generateImprovementPlan = async (student, phase, preferredTeacherId = null, planTemplate = null) => {
  try {
    // 1. Obtener el profesor asignado al estudiante
    const [teacherRelation] = await pool.query(`
      SELECT t.id as teacher_id, t.subject, u.name as teacher_name
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE (? IS NOT NULL AND t.id = ?)
        OR (? IS NULL AND EXISTS (
          SELECT 1 FROM teacher_students ts WHERE ts.teacher_id = t.id AND ts.student_id = ?
        ))
      ORDER BY CASE WHEN t.id = ? THEN 0 ELSE 1 END
    `, [preferredTeacherId, preferredTeacherId, preferredTeacherId, student.student_id, preferredTeacherId]);
    
    if (teacherRelation.length === 0) {
      console.log(`Estudiante ${student.student_name} no tiene profesor asignado`);
      return { created: false, updated: false };
    }
    
    const teacher = teacherRelation[0];
    
    // 2. Obtener indicadores no alcanzados para esta fase
    const phaseIndicatorResults = await getQuestionnaireIndicatorResults({
      studentId: student.student_id,
      grade: student.grade,
      courseId: student.course_id,
      phase,
      teacherId: teacher.teacher_id
    });
    const failedIndicators = phaseIndicatorResults.failed;
    
    // 3. Obtener cuestionarios no aprobados para esta fase
    const [failedQuizzes] = await pool.query(`
      SELECT q.title, q.id, er.best_score
      FROM evaluation_results er
      JOIN questionnaires q ON er.questionnaire_id = q.id
      WHERE er.student_id = ? 
      AND q.phase = ? 
      AND er.best_score < 3.5
      AND (q.is_prueba_saber = FALSE OR q.is_prueba_saber IS NULL)
      AND (er.academic_year = ? OR (er.academic_year IS NULL AND YEAR(er.recorded_at) = ?))
    `, [student.student_id, phase, new Date().getFullYear(), new Date().getFullYear()]);
    
    // 4. Formatear los logros no alcanzados
    const failedAchievements = failedIndicators.map(i => 
      `• ${i.description} (${i.subject}; nota: ${i.best_score}; mínima: ${i.passing_score})`
    ).join('\n');
    
    // 5. Obtener indicadores alcanzados para esta fase (si existen)
    const passedIndicators = phaseIndicatorResults.passed;
    const passedAchievements = passedIndicators.map(i => 
      `• ${i.description} (${i.subject}; nota: ${i.best_score}; mínima: ${i.passing_score})`
    ).join('\n');
    
    // 6. Crear el plan de mejoramiento
    const baseTitle = planTemplate?.title?.trim() || `Plan de Mejoramiento - Fase ${phase} - ${teacher.subject}`;
    const title = /fase\s+[1-4]/i.test(baseTitle) ? baseTitle : `${baseTitle} - Fase ${phase}`;
    const generatedDescription = `
El estudiante ${student.student_name} no ha alcanzado la nota mínima aprobatoria (3.5) en la fase ${phase} de ${teacher.subject}.
Este plan de mejoramiento tiene como objetivo que el estudiante alcance los logros pendientes y mejore su desempeño académico.

Nota obtenida en la fase ${phase}: ${student.phase_score}
`;

    const generatedActivities = `
Para superar las dificultades identificadas, el estudiante deberá:

1. Revisar los temas vistos en clase correspondientes a la fase ${phase}.
2. Completar los ejercicios del PDF que publicará el docente en la plataforma.
3. Presentar nuevamente las evaluaciones no aprobadas.
4. Entregar un trabajo escrito sobre los temas principales de la fase.

Cuestionarios a recuperar:
${failedQuizzes.map(q => `• ${q.title} (Nota: ${q.best_score})`).join('\n')}
`;

    const description = [String(planTemplate?.description || '').trim(), generatedDescription.trim()].filter(Boolean).join('\n\n');
    const activities = [String(planTemplate?.activities || '').trim(), generatedActivities.trim()].filter(Boolean).join('\n\n');
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (Number(planTemplate?.deadline_days) || 14));
    
    // 7. Verificar si ya existe un plan de mejoramiento para esta fase
    const [existingPlans] = await pool.query(`
      SELECT id, title, teacher_notes FROM improvement_plans
      WHERE student_id = ? 
      AND teacher_id = ? 
      AND title LIKE ?
      AND (academic_year = ? OR academic_year IS NULL)
      ORDER BY id DESC
      LIMIT 1
    `, [
      student.student_id,
      teacher.teacher_id,
      `%Fase ${phase}%`,
      new Date().getFullYear()
    ]);
    
    if (existingPlans.length > 0) {
      // No reemplazar planes que el docente creó o editó manualmente.
      const isMarkedAutomatic = String(existingPlans[0].teacher_notes || '').includes(`AUTO_PHASE:${phase}:${new Date().getFullYear()}`);
      const isLegacyAutomatic = existingPlans[0].title === `Plan de Mejoramiento - Fase ${phase} - ${teacher.subject}`;
      if (!isMarkedAutomatic && !isLegacyAutomatic) {
        return { created: false, updated: false, preservedManualPlan: true };
      }
      await pool.query(`
        UPDATE improvement_plans 
        SET description = ?, 
            activities = ?,
            deadline = ?,
            failed_achievements = ?,
            passed_achievements = ?,
            completed = false,
            completion_date = NULL,
            activity_status = 'pending',
            academic_year = ?, title = ?, subject = ?, teacher_notes = ?
        WHERE id = ?
      `, [
        description.trim(),
        activities.trim(),
        deadline.toISOString().split('T')[0],
        failedAchievements,
        passedAchievements,
        new Date().getFullYear(),
        title,
        planTemplate?.subject?.trim() || teacher.subject,
        `AUTO_PHASE:${phase}:${new Date().getFullYear()} | Plantilla ${planTemplate ? 'de curso' : 'estándar'}; nota definitiva: ${student.phase_score}`,
        existingPlans[0].id
      ]);
      
      console.log(`Plan de mejoramiento actualizado para ${student.student_name} en fase ${phase}`);
      return { created: false, updated: true };
    } else {
      // Obtener año académico actual
      const currentAcademicYear = new Date().getFullYear();
      
      // Crear nuevo plan (incluyendo academic_year)
      await pool.query(`
        INSERT INTO improvement_plans 
        (student_id, teacher_id, title, subject, description, activities, deadline, 
         failed_achievements, passed_achievements, completed, email_sent, created_at, academic_year, teacher_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false, false, NOW(), ?, ?)
      `, [
        student.student_id, 
        teacher.teacher_id, 
        title, 
        planTemplate?.subject?.trim() || teacher.subject,
        description.trim(), 
        activities.trim(), 
        deadline.toISOString().split('T')[0],
        failedAchievements,
        passedAchievements,
        currentAcademicYear,
        `AUTO_PHASE:${phase}:${currentAcademicYear} | Plantilla ${planTemplate ? 'de curso' : 'estándar'}; nota definitiva: ${student.phase_score}`
      ]);
      
      console.log(`Plan de mejoramiento generado para ${student.student_name} en fase ${phase}`);
      return { created: true, updated: false };
    }
    
    // 8. Asignar los indicadores pendientes al estudiante si no están ya asignados
    for (const indicator of failedIndicators) {
      if (indicator.student_id === null) {
        // Crear una copia del indicador específicamente para este estudiante
        await pool.query(`
          INSERT INTO indicators 
          (teacher_id, student_id, description, subject, phase, achieved, questionnaire_id, grade)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?)
        `, [
          teacher.teacher_id,
          student.student_id,
          indicator.description,
          indicator.subject,
          indicator.phase,
          indicator.questionnaire_id,
          indicator.grade
        ]);
      }
    }
    
  } catch (error) {
    console.error(`Error generando plan de mejoramiento:`, error);
    throw error;
  }
};

// Función para marcar una materia como perdida al final del año
const markFailedSubject = async (student) => {
  try {
    // 1. Obtener el profesor asignado al estudiante
    const [teacherRelation] = await pool.query(`
      SELECT t.id as teacher_id, t.subject, u.name as teacher_name
      FROM teacher_students ts
      JOIN teachers t ON ts.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE ts.student_id = ?
    `, [student.student_id]);
    
    if (teacherRelation.length === 0) {
      console.log(`Estudiante ${student.student_name} no tiene profesor asignado`);
      return { created: false, updated: false };
    }
    
    const teacher = teacherRelation[0];
    
    // 2. Crear un plan de mejoramiento final (habilitación)
    const title = `HABILITACIÓN - ${teacher.subject} - Año Escolar`;
    const description = `
El estudiante ${student.student_name} no ha alcanzado la nota mínima aprobatoria (3.0) en el promedio final de ${teacher.subject}.
Se requiere presentar habilitación para aprobar la materia.

Promedio final obtenido: ${student.overall_average}

IMPORTANTE: Este estudiante ha PERDIDO la materia ${teacher.subject} y debe presentar habilitación.
`;

    const activities = `
Para habilitar la materia, el estudiante deberá:

1. Presentar un examen final que incluye todos los temas vistos durante el año.
2. Entregar un trabajo escrito sobre los temas principales del curso.
3. Realizar una sustentación oral de los conceptos fundamentales.

La habilitación debe presentarse en la fecha establecida por la institución.
`;

    // 3. Obtener todos los indicadores no alcanzados durante el año
    const [allFailedIndicators] = await pool.query(`
      SELECT DISTINCT i.*
      FROM indicators i
      JOIN teacher_students ts
        ON ts.teacher_id = i.teacher_id AND ts.student_id = ?
      LEFT JOIN student_indicators si
        ON si.indicator_id = i.id AND si.student_id = ?
      WHERE COALESCE(si.achieved, 0) = 0
        AND i.teacher_id = ?
        AND i.grade = ?
    `, [student.student_id, student.student_id, teacher.teacher_id, student.grade]);
    
    const failedAchievements = allFailedIndicators.map(i => 
      `• ${i.description} (${i.subject} - Fase ${i.phase})`
    ).join('\n');
    
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30); // 1 mes para la habilitación
    
    // 4. Verificar si ya existe un plan de habilitación
    const [existingPlans] = await pool.query(`
      SELECT id FROM improvement_plans 
      WHERE student_id = ? 
      AND teacher_id = ? 
      AND title LIKE '%HABILITACIÓN%'
      AND completed = false
    `, [
      student.student_id,
      teacher.teacher_id
    ]);
    
    if (existingPlans.length > 0) {
      // Actualizar el plan existente
      await pool.query(`
        UPDATE improvement_plans 
        SET description = ?, 
            activities = ?, 
            failed_achievements = ?
        WHERE id = ?
      `, [
        description.trim(),
        activities.trim(),
        failedAchievements,
        existingPlans[0].id
      ]);
      
      console.log(`Plan de habilitación actualizado para ${student.student_name}`);
      return { created: false, updated: true };
    } else {
      // Crear nuevo plan
      await pool.query(`
        INSERT INTO improvement_plans 
        (student_id, teacher_id, title, subject, description, activities, deadline, 
         failed_achievements, passed_achievements, completed, email_sent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false, false, NOW())
      `, [
        student.student_id, 
        teacher.teacher_id, 
        title, 
        teacher.subject, 
        description.trim(), 
        activities.trim(), 
        deadline.toISOString().split('T')[0],
        failedAchievements,
        '' // No hay logros alcanzados relevantes para la habilitación
      ]);
      
      console.log(`Plan de habilitación generado para ${student.student_name}`);
      return { created: true, updated: false };
    }
    
  } catch (error) {
    console.error(`Error generando plan de habilitación:`, error);
    throw error;
  }
};

export default {
  evaluatePhaseResults,
  generateImprovementPlan
};
