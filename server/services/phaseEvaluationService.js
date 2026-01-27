// services/phaseEvaluationService.js
import pool from '../config/db.js';
import { sendPhaseResultsEmail, sendFinalGradeEmail } from '../utils/emailService.js';
import { generatePhaseResultsPDF, generateFinalGradePDF } from '../utils/pdfGenerator.js';

// Función principal para evaluar estudiantes al final de una fase
export const evaluatePhaseResults = async (phase) => {
  try {
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
        COALESCE(ut.institution, u.institution) as institution
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN grades g ON s.id = g.student_id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN teacher_students ts ON s.id = ts.student_id
      LEFT JOIN teachers t ON ts.teacher_id = t.id
      LEFT JOIN users ut ON t.user_id = ut.id
      WHERE g.phase${phase} IS NOT NULL
    `);
    
    console.log(`Encontrados ${students.length} estudiantes con calificaciones para la fase ${phase}`);
    
    // 2. Para cada estudiante, procesar resultados y enviar emails
    let plansCreated = 0;
    let plansUpdated = 0;
    let studentsProcessed = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    
    for (const student of students) {
      studentsProcessed++;
      
      // Obtener indicadores no alcanzados para esta fase
      // Buscar indicadores del estudiante que no alcanzó en esta fase
      const [failedIndicators] = await pool.query(`
        SELECT DISTINCT
          i.id,
          i.description,
          i.subject,
          i.category
        FROM student_indicators si
        JOIN indicators i ON si.indicator_id = i.id
        WHERE si.student_id = ? 
        AND si.achieved = 0
        AND i.phase = ?
        AND (i.grade = ? OR i.grade IS NULL)
        ORDER BY i.subject, i.category
      `, [student.student_id, phase, student.grade]);
      
      let improvementPlan = null;
      
      // Si nota < 3.5, generar o actualizar plan de mejoramiento
      if (student.phase_score < 3.5) {
        const result = await generateImprovementPlan(student, phase);
        if (result.created) plansCreated++;
        if (result.updated) plansUpdated++;
        
        // Obtener el plan de mejoramiento generado para esta fase
        // Buscar el plan más reciente del estudiante que coincida con la fase
        const [plans] = await pool.query(`
          SELECT ip.* 
          FROM improvement_plans ip
          WHERE ip.student_id = ? 
          AND (ip.title LIKE ? OR ip.title LIKE ? OR ip.title LIKE ?)
          ORDER BY ip.created_at DESC, ip.updated_at DESC
          LIMIT 1
        `, [
          student.student_id, 
          `%Fase ${phase}%`,
          `%fase ${phase}%`,
          `%FASE ${phase}%`
        ]);
        
        if (plans.length > 0) {
          improvementPlan = plans[0];
        }
      } else {
        // Si aprobó, buscar si hay planes anteriores para informar
        const [existingPlans] = await pool.query(`
          SELECT ip.* 
          FROM improvement_plans ip
          WHERE ip.student_id = ? 
          AND (ip.title LIKE ? OR ip.title LIKE ? OR ip.title LIKE ?)
          AND ip.completed = 0
          ORDER BY ip.created_at DESC
          LIMIT 1
        `, [
          student.student_id, 
          `%Fase ${phase}%`,
          `%fase ${phase}%`,
          `%FASE ${phase}%`
        ]);
        
        if (existingPlans.length > 0) {
          improvementPlan = existingPlans[0];
        }
      }
      
      // Si es la fase final (4) y el promedio general es < 3.0, marcar como materia perdida
      if (phase === 4 && student.overall_average < 3.0) {
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
        grade: student.grade,
        course_name: student.course_name
      };

      // Preparar datos para el PDF
      const pdfData = {
        studentName: student.student_name,
        studentGrade: student.grade,
        courseName: student.course_name,
        phase: phase,
        phaseScore: student.phase_score,
        teacherName: student.teacher_name || 'N/A',
        teacherSubject: student.teacher_subject || 'N/A',
        reportBrandName: student.report_brand_name || null,
        reportLogoUrl: student.report_logo_url || null,
        institution: student.institution || student.student_institution || 'N/A',
        academicPeriod: academicPeriod,
        failedIndicators: failedIndicators,
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
        if (student.student_email || student.contact_email) {
          const emailResult = await sendPhaseResultsEmail(
            studentData,
            phase,
            student.phase_score,
            improvementPlan,
            failedIndicators,
            pdfBuffer // Pasar PDF como adjunto
          );
          
          if (emailResult.success) {
            emailsSent++;
            console.log(`✅ Email enviado a ${student.student_name} (fase ${phase})`);
            
            // Si hay plan, marcar como enviado
            if (improvementPlan) {
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
      if (phase === 4 && (student.student_email || student.contact_email)) {
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
          
          const finalEmailResult = await sendFinalGradeEmail(
            studentData,
            student.overall_average || 0,
            phaseGrades,
            finalPdfBuffer // Pasar PDF como adjunto
          );
          
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
      message: `Evaluación de fase ${phase} completada. ${studentsProcessed} estudiantes procesados. ${plansCreated} planes creados, ${plansUpdated} planes actualizados. ${emailsSent} emails enviados exitosamente, ${emailsFailed} fallos.`,
      studentsProcessed,
      plansCreated,
      plansUpdated,
      emailsSent,
      emailsFailed
    };
  } catch (error) {
    console.error('Error en evaluación de fase:', error);
    return { success: false, error: error.message };
  }
};

// Función para generar un plan de mejoramiento para un estudiante
export const generateImprovementPlan = async (student, phase) => {
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
      return;
    }
    
    const teacher = teacherRelation[0];
    
    // 2. Obtener indicadores no alcanzados para esta fase
    const [failedIndicators] = await pool.query(`
      SELECT i.* 
      FROM indicators i
      WHERE i.phase = ? 
      AND i.achieved = 0
      AND (i.student_id = ? OR (i.grade = ? AND i.student_id IS NULL))
    `, [phase, student.student_id, student.grade]);
    
    // 3. Obtener cuestionarios no aprobados para esta fase
    const [failedQuizzes] = await pool.query(`
      SELECT q.title, q.id, er.best_score
      FROM evaluation_results er
      JOIN questionnaires q ON er.questionnaire_id = q.id
      WHERE er.student_id = ? 
      AND q.phase = ? 
      AND er.best_score < 3.5
    `, [student.student_id, phase]);
    
    // 4. Formatear los logros no alcanzados
    const failedAchievements = failedIndicators.map(i => 
      `• ${i.description} (${i.subject})`
    ).join('\n');
    
    // 5. Obtener indicadores alcanzados para esta fase (si existen)
    const [passedIndicators] = await pool.query(`
      SELECT i.* 
      FROM indicators i
      WHERE i.phase = ? 
      AND i.achieved = 1
      AND (i.student_id = ? OR (i.grade = ? AND i.student_id IS NULL))
    `, [phase, student.student_id, student.grade]);
    
    const passedAchievements = passedIndicators.map(i => 
      `• ${i.description} (${i.subject})`
    ).join('\n');
    
    // 6. Crear el plan de mejoramiento
    const title = `Plan de Mejoramiento - Fase ${phase} - ${teacher.subject}`;
    const description = `
El estudiante ${student.student_name} no ha alcanzado la nota mínima aprobatoria (3.5) en la fase ${phase} de ${teacher.subject}.
Este plan de mejoramiento tiene como objetivo que el estudiante alcance los logros pendientes y mejore su desempeño académico.

Nota obtenida en la fase ${phase}: ${student.phase_score}
`;

    const activities = `
Para superar las dificultades identificadas, el estudiante deberá:

1. Revisar los temas vistos en clase correspondientes a la fase ${phase}.
2. Completar los ejercicios adicionales que se adjuntan a este plan.
3. Presentar nuevamente las evaluaciones no aprobadas.
4. Entregar un trabajo escrito sobre los temas principales de la fase.

Cuestionarios a recuperar:
${failedQuizzes.map(q => `• ${q.title} (Nota: ${q.best_score})`).join('\n')}
`;

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14); // 2 semanas para completar el plan
    
    // 7. Verificar si ya existe un plan de mejoramiento para esta fase
    const [existingPlans] = await pool.query(`
      SELECT id FROM improvement_plans 
      WHERE student_id = ? 
      AND teacher_id = ? 
      AND title LIKE ?
      AND completed = false
    `, [
      student.student_id,
      teacher.teacher_id,
      `%Fase ${phase}%`
    ]);
    
    if (existingPlans.length > 0) {
      // Actualizar el plan existente
      await pool.query(`
        UPDATE improvement_plans 
        SET description = ?, 
            activities = ?, 
            failed_achievements = ?,
            passed_achievements = ?,
            updated_at = NOW()
        WHERE id = ?
      `, [
        description.trim(),
        activities.trim(),
        failedAchievements,
        passedAchievements,
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
         failed_achievements, passed_achievements, completed, email_sent, created_at, academic_year)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false, false, NOW(), ?)
      `, [
        student.student_id, 
        teacher.teacher_id, 
        title, 
        teacher.subject, 
        description.trim(), 
        activities.trim(), 
        deadline.toISOString().split('T')[0],
        failedAchievements,
        passedAchievements,
        currentAcademicYear
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
      return;
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
      SELECT i.* 
      FROM indicators i
      WHERE i.achieved = 0
      AND (i.student_id = ? OR (i.grade = ? AND i.student_id IS NULL))
    `, [student.student_id, student.grade]);
    
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
            failed_achievements = ?,
            updated_at = NOW()
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
