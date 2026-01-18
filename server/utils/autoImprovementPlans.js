import pool from '../config/db.js';

/**
 * Sistema Automático de Planes de Mejoramiento
 * 
 * Este módulo maneja la creación automática de planes de mejoramiento
 * cuando un estudiante no alcanza los indicadores requeridos en un cuestionario.
 */

/**
 * Procesa automáticamente los resultados de un cuestionario y crea planes de mejoramiento
 * para estudiantes que no alcanzaron los indicadores requeridos
 */
export const processQuestionnaireResults = async (questionnaireId) => {
  try {
    console.log(`🔄 Procesando resultados automáticos para cuestionario ${questionnaireId}`);
    
    // 1. Obtener información del cuestionario
    const [questionnaireInfo] = await pool.query(`
      SELECT q.*, t.id as teacher_id, t.user_id as teacher_user_id, ut.name as teacher_name
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users ut ON t.user_id = ut.id
      WHERE q.id = ?
    `, [questionnaireId]);
    
    if (questionnaireInfo.length === 0) {
      throw new Error(`Cuestionario ${questionnaireId} no encontrado`);
    }
    
    const questionnaire = questionnaireInfo[0];
    console.log(`📋 Procesando cuestionario: ${questionnaire.title} (${questionnaire.subject})`);
    
    // 2. Obtener todos los estudiantes que realizaron este cuestionario
    const [studentsResults] = await pool.query(`
      SELECT 
        er.student_id,
        er.best_score,
        s.user_id as student_user_id,
        us.name as student_name,
        s.grade,
        s.contact_email,
        c.name as course_name
      FROM evaluation_results er
      JOIN students s ON er.student_id = s.id
      JOIN users us ON s.user_id = us.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE er.questionnaire_id = ?
    `, [questionnaireId]);
    
    console.log(`👥 Encontrados ${studentsResults.length} estudiantes que realizaron el cuestionario`);
    
    // 3. Para cada estudiante, verificar indicadores no alcanzados
    const improvementPlansCreated = [];
    
    for (const studentResult of studentsResults) {
      const failedIndicators = await getFailedIndicators(studentResult.student_id, questionnaireId);
      
      if (failedIndicators.length > 0) {
        console.log(`❌ Estudiante ${studentResult.student_name} no alcanzó ${failedIndicators.length} indicadores`);
        
        // Crear plan de mejoramiento automático
        const improvementPlan = await createAutomaticImprovementPlan({
          student: studentResult,
          questionnaire: questionnaire,
          failedIndicators: failedIndicators,
          studentScore: studentResult.best_score
        });
        
        if (improvementPlan) {
          improvementPlansCreated.push(improvementPlan);
        }
      } else {
        console.log(`✅ Estudiante ${studentResult.student_name} alcanzó todos los indicadores`);
      }
    }
    
    console.log(`🎯 Se crearon ${improvementPlansCreated.length} planes de mejoramiento automáticos`);
    
    return {
      success: true,
      questionnaire_id: questionnaireId,
      students_processed: studentsResults.length,
      improvement_plans_created: improvementPlansCreated.length,
      plans: improvementPlansCreated
    };
    
  } catch (error) {
    console.error('❌ Error procesando resultados automáticos:', error);
    throw error;
  }
};

/**
 * Obtiene los indicadores que un estudiante no alcanzó en un cuestionario específico
 */
const getFailedIndicators = async (studentId, questionnaireId) => {
  const [failedIndicators] = await pool.query(`
    SELECT 
      si.indicator_id,
      i.description,
      i.subject,
      i.category,
      i.grade,
      i.phase,
      qi.passing_score,
      si.achieved
    FROM student_indicators si
    JOIN indicators i ON si.indicator_id = i.id
    JOIN questionnaire_indicators qi ON qi.indicator_id = i.id AND qi.questionnaire_id = ?
    WHERE si.student_id = ? 
      AND si.questionnaire_id = ?
      AND si.achieved = 0
    ORDER BY i.subject, i.category
  `, [questionnaireId, studentId, questionnaireId]);
  
  return failedIndicators;
};

/**
 * Crea un plan de mejoramiento automático para un estudiante
 */
const createAutomaticImprovementPlan = async ({ student, questionnaire, failedIndicators, studentScore }) => {
  try {
    console.log(`📝 Creando plan automático para ${student.student_name}`);
    
    // Generar título automático
    const title = `Plan de Recuperación - ${questionnaire.subject} - ${student.student_name}`;
    
    // Generar descripción automática
    const description = generateAutomaticDescription({
      student: student,
      questionnaire: questionnaire,
      failedIndicators: failedIndicators,
      studentScore: studentScore
    });
    
    // Generar actividades automáticas
    const activities = generateAutomaticActivities(failedIndicators, questionnaire);
    
    // Generar logros no alcanzados
    const failedAchievements = failedIndicators.map(indicator => 
      `• ${indicator.description} (Nota mínima: ${indicator.passing_score}, Obtenida: ${studentScore})`
    ).join('\n');
    
    // Calcular fecha límite (2 semanas desde hoy)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14);
    const deadlineStr = deadline.toISOString().split('T')[0];
    
    // Obtener año académico actual
    const currentAcademicYear = new Date().getFullYear();
    
    // Insertar plan de mejoramiento (incluyendo academic_year)
    const [result] = await pool.query(`
      INSERT INTO improvement_plans (
        student_id, teacher_id, title, subject, description, activities,
        deadline, failed_achievements, activity_status, teacher_notes,
        created_at, academic_year
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), ?)
    `, [
      student.student_id,
      questionnaire.teacher_id,
      title,
      questionnaire.subject,
      description,
      activities,
      deadlineStr,
      failedAchievements,
      `Plan generado automáticamente el ${new Date().toLocaleDateString('es-CO')} debido a indicadores no alcanzados en el cuestionario "${questionnaire.title}".`,
      currentAcademicYear
    ]);
    
    const improvementPlanId = result.insertId;
    console.log(`✅ Plan de mejoramiento creado con ID: ${improvementPlanId}`);
    
    // Crear recursos automáticos para cada indicador fallido
    await createAutomaticResources(improvementPlanId, failedIndicators, questionnaire);
    
    // Crear actividades específicas para cada indicador
    await createAutomaticActivities(improvementPlanId, failedIndicators, questionnaire);
    
    return {
      id: improvementPlanId,
      student_name: student.student_name,
      title: title,
      failed_indicators_count: failedIndicators.length,
      deadline: deadlineStr
    };
    
  } catch (error) {
    console.error(`❌ Error creando plan automático para ${student.student_name}:`, error);
    return null;
  }
};

/**
 * Genera una descripción automática para el plan de mejoramiento
 */
const generateAutomaticDescription = ({ student, questionnaire, failedIndicators, studentScore }) => {
  const subjects = [...new Set(failedIndicators.map(i => i.subject))];
  const categories = [...new Set(failedIndicators.map(i => i.category).filter(c => c))];
  
  let description = `Plan de recuperación académica para ${student.student_name} del grado ${student.grade}.\n\n`;
  
  description += `**Situación Actual:**\n`;
  description += `• Cuestionario: ${questionnaire.title}\n`;
  description += `• Materia: ${questionnaire.subject}\n`;
  description += `• Nota obtenida: ${studentScore}\n`;
  description += `• Indicadores no alcanzados: ${failedIndicators.length}\n\n`;
  
  if (subjects.length > 0) {
    description += `**Áreas de Mejora:**\n`;
    subjects.forEach(subject => {
      description += `• ${subject}\n`;
    });
    description += '\n';
  }
  
  if (categories.length > 0) {
    description += `**Categorías Específicas:**\n`;
    categories.forEach(category => {
      description += `• ${category}\n`;
    });
    description += '\n';
  }
  
  description += `**Objetivo:**\n`;
  description += `Reforzar los conocimientos en las áreas identificadas para alcanzar los indicadores de logro requeridos y mejorar el rendimiento académico.\n\n`;
  
  description += `**Metodología:**\n`;
  description += `Este plan incluye recursos multimedia, actividades prácticas y evaluaciones específicas diseñadas para abordar cada indicador no alcanzado.`;
  
  return description;
};

/**
 * Genera actividades automáticas basadas en los indicadores fallidos
 */
const generateAutomaticActivities = (failedIndicators, questionnaire) => {
  const activities = [];
  
  // Agrupar por materia
  const subjectsMap = {};
  failedIndicators.forEach(indicator => {
    if (!subjectsMap[indicator.subject]) {
      subjectsMap[indicator.subject] = [];
    }
    subjectsMap[indicator.subject].push(indicator);
  });
  
  Object.entries(subjectsMap).forEach(([subject, indicators]) => {
    activities.push(`**${subject}:**`);
    activities.push(`1. Revisión de conceptos fundamentales`);
    activities.push(`2. Ejercicios prácticos específicos`);
    activities.push(`3. Evaluación de refuerzo`);
    activities.push(`4. Consulta con el docente`);
    activities.push('');
  });
  
  activities.push(`**Actividades Generales:**`);
  activities.push(`• Lectura y análisis de material de apoyo`);
  activities.push(`• Participación en sesiones de refuerzo`);
  activities.push(`• Entrega de trabajos complementarios`);
  activities.push(`• Evaluación final de recuperación`);
  
  return activities.join('\n');
};

/**
 * Crea recursos automáticos para el plan de mejoramiento
 */
const createAutomaticResources = async (improvementPlanId, failedIndicators, questionnaire) => {
  try {
    console.log(`📚 Creando recursos automáticos para plan ${improvementPlanId}`);
    
    // Recursos generales por materia
    const subjectsMap = {};
    failedIndicators.forEach(indicator => {
      if (!subjectsMap[indicator.subject]) {
        subjectsMap[indicator.subject] = [];
      }
      subjectsMap[indicator.subject].push(indicator);
    });
    
    let orderIndex = 1;
    
    // Crear recursos por materia
    for (const [subject, indicators] of Object.entries(subjectsMap)) {
      // Video educativo general
      await pool.query(`
        INSERT INTO recovery_resources (
          improvement_plan_id, resource_type, title, description, url,
          difficulty_level, order_index, is_required, created_at
        ) VALUES (?, 'video', ?, ?, ?, 'basic', ?, 1, NOW())
      `, [
        improvementPlanId,
        `Video educativo - ${subject}`,
        `Recurso multimedia para reforzar conceptos básicos de ${subject}`,
        getSubjectVideoUrl(subject),
        orderIndex++
      ]);
      
      // Documento de apoyo
      await pool.query(`
        INSERT INTO recovery_resources (
          improvement_plan_id, resource_type, title, description, url,
          difficulty_level, order_index, is_required, created_at
        ) VALUES (?, 'document', ?, ?, ?, 'basic', ?, 1, NOW())
      `, [
        improvementPlanId,
        `Guía de estudio - ${subject}`,
        `Material de apoyo con ejercicios y explicaciones detalladas`,
        getSubjectDocumentUrl(subject),
        orderIndex++
      ]);
      
      // Enlace a recursos externos
      await pool.query(`
        INSERT INTO recovery_resources (
          improvement_plan_id, resource_type, title, description, url,
          difficulty_level, order_index, is_required, created_at
        ) VALUES (?, 'link', ?, ?, ?, 'intermediate', ?, 1, NOW())
      `, [
        improvementPlanId,
        `Recursos adicionales - ${subject}`,
        `Enlaces a sitios web educativos especializados`,
        getSubjectExternalUrl(subject),
        orderIndex++
      ]);
    }
    
    console.log(`✅ Recursos automáticos creados para plan ${improvementPlanId}`);
    
  } catch (error) {
    console.error(`❌ Error creando recursos automáticos:`, error);
  }
};

/**
 * Crea actividades específicas para el plan de mejoramiento
 */
const createAutomaticActivities = async (improvementPlanId, failedIndicators, questionnaire) => {
  try {
    console.log(`🎯 Creando actividades automáticas para plan ${improvementPlanId}`);
    
    let orderIndex = 1;
    
    // Crear actividad para cada indicador fallido
    for (const indicator of failedIndicators) {
      await pool.query(`
        INSERT INTO recovery_activities (
          improvement_plan_id, indicator_id, questionnaire_id, activity_type,
          title, description, instructions, due_date, max_attempts,
          passing_score, weight, status, created_at
        ) VALUES (?, ?, ?, 'exercise', ?, ?, ?, ?, 3, ?, 1.00, 'pending', NOW())
      `, [
        improvementPlanId,
        indicator.indicator_id,
        questionnaire.id,
        `Ejercicio de refuerzo - ${indicator.description}`,
        `Actividad específica para alcanzar el indicador: ${indicator.description}`,
        `Realizar los ejercicios propuestos y demostrar comprensión del tema. Consultar con el docente si hay dudas.`,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        indicator.passing_score
      ]);
      
      orderIndex++;
    }
    
    // Crear evaluación final
    await pool.query(`
      INSERT INTO recovery_activities (
        improvement_plan_id, questionnaire_id, activity_type,
        title, description, instructions, due_date, max_attempts,
        passing_score, weight, status, created_at
      ) VALUES (?, ?, 'quiz', ?, ?, ?, ?, 2, 3.5, 2.00, 'pending', NOW())
    `, [
      improvementPlanId,
      questionnaire.id,
      `Evaluación de recuperación - ${questionnaire.title}`,
      `Evaluación final para verificar el logro de los indicadores`,
      `Realizar la evaluación con calma y aplicar los conocimientos reforzados durante el plan de recuperación.`,
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 días
    ]);
    
    console.log(`✅ Actividades automáticas creadas para plan ${improvementPlanId}`);
    
  } catch (error) {
    console.error(`❌ Error creando actividades automáticas:`, error);
  }
};

/**
 * Obtiene URLs de videos educativos por materia
 */
const getSubjectVideoUrl = (subject) => {
  const videoUrls = {
    'Español': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Ejemplo
    'Matemáticas': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'Física': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'Química': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'Biología': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'Historia': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'Geografía': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  };
  
  return videoUrls[subject] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
};

/**
 * Obtiene URLs de documentos por materia
 */
const getSubjectDocumentUrl = (subject) => {
  const documentUrls = {
    'Español': 'https://www.ejemplo.com/documentos/espanol.pdf',
    'Matemáticas': 'https://www.ejemplo.com/documentos/matematicas.pdf',
    'Física': 'https://www.ejemplo.com/documentos/fisica.pdf',
    'Química': 'https://www.ejemplo.com/documentos/quimica.pdf',
    'Biología': 'https://www.ejemplo.com/documentos/biologia.pdf',
    'Historia': 'https://www.ejemplo.com/documentos/historia.pdf',
    'Geografía': 'https://www.ejemplo.com/documentos/geografia.pdf'
  };
  
  return documentUrls[subject] || 'https://www.ejemplo.com/documentos/general.pdf';
};

/**
 * Obtiene URLs de recursos externos por materia
 */
const getSubjectExternalUrl = (subject) => {
  const externalUrls = {
    'Español': 'https://www.rae.es/',
    'Matemáticas': 'https://www.khanacademy.org/math',
    'Física': 'https://www.physicsclassroom.com/',
    'Química': 'https://www.chemguide.co.uk/',
    'Biología': 'https://www.biologycorner.com/',
    'Historia': 'https://www.history.com/',
    'Geografía': 'https://www.nationalgeographic.com/'
  };
  
  return externalUrls[subject] || 'https://www.educacion.gob.es/';
};

/**
 * Procesa automáticamente un estudiante específico para un cuestionario
 */
export const processStudentImprovementPlan = async (studentId, questionnaireId) => {
  try {
    console.log(`🔄 Procesando plan automático para estudiante ${studentId} en cuestionario ${questionnaireId}`);
    
    // Verificar si ya existe un plan para este estudiante y cuestionario
    const [existingPlan] = await pool.query(`
      SELECT id FROM improvement_plans 
      WHERE student_id = ? AND title LIKE ?
    `, [studentId, `%Cuestionario ${questionnaireId}%`]);
    
    if (existingPlan.length > 0) {
      console.log(`⚠️ Ya existe un plan de mejoramiento para este estudiante y cuestionario`);
      return {
        success: false,
        message: 'Ya existe un plan de mejoramiento para este estudiante y cuestionario',
        existing_plan_id: existingPlan[0].id
      };
    }
    
    // Obtener información del estudiante
    const [studentInfo] = await pool.query(`
      SELECT s.*, us.name as student_name, c.name as course_name
      FROM students s
      JOIN users us ON s.user_id = us.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.id = ?
    `, [studentId]);
    
    if (studentInfo.length === 0) {
      throw new Error(`Estudiante ${studentId} no encontrado`);
    }
    
    const student = studentInfo[0];
    
    // Obtener información del cuestionario
    const [questionnaireInfo] = await pool.query(`
      SELECT q.*, t.id as teacher_id, ut.name as teacher_name
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users ut ON t.user_id = ut.id
      WHERE q.id = ?
    `, [questionnaireId]);
    
    if (questionnaireInfo.length === 0) {
      throw new Error(`Cuestionario ${questionnaireId} no encontrado`);
    }
    
    const questionnaire = questionnaireInfo[0];
    
    // Obtener resultado del estudiante
    const [evaluationResult] = await pool.query(`
      SELECT best_score FROM evaluation_results
      WHERE student_id = ? AND questionnaire_id = ?
    `, [studentId, questionnaireId]);
    
    if (evaluationResult.length === 0) {
      throw new Error(`No se encontró evaluación para el estudiante ${studentId} en el cuestionario ${questionnaireId}`);
    }
    
    const studentScore = evaluationResult[0].best_score;
    
    // Obtener indicadores fallidos
    const failedIndicators = await getFailedIndicators(studentId, questionnaireId);
    
    if (failedIndicators.length === 0) {
      return {
        success: false,
        message: 'El estudiante alcanzó todos los indicadores requeridos',
        student_score: studentScore
      };
    }
    
    // Crear plan de mejoramiento
    const improvementPlan = await createAutomaticImprovementPlan({
      student: student,
      questionnaire: questionnaire,
      failedIndicators: failedIndicators,
      studentScore: studentScore
    });
    
    return {
      success: true,
      student_name: student.student_name,
      questionnaire_title: questionnaire.title,
      student_score: studentScore,
      failed_indicators_count: failedIndicators.length,
      improvement_plan: improvementPlan
    };
    
  } catch (error) {
    console.error(`❌ Error procesando plan automático para estudiante ${studentId}:`, error);
    throw error;
  }
};