// services/phaseEvaluationService.js
import pool from '../config/db.js';

// Función principal para evaluar estudiantes al final de una fase
export const evaluatePhaseResults = async (phase) => {
  try {
    console.log(`Iniciando evaluación de resultados para la fase ${phase}`);
    
    // 1. Obtener todos los estudiantes con sus calificaciones para esta fase
    const [students] = await pool.query(`
      SELECT 
        s.id as student_id, 
        s.user_id,
        s.grade,
        s.course_id,
        u.name as student_name,
        u.email as student_email,
        c.name as course_name,
        CASE 
          WHEN ${phase} = 1 THEN g.phase1
          WHEN ${phase} = 2 THEN g.phase2
          WHEN ${phase} = 3 THEN g.phase3
          WHEN ${phase} = 4 THEN g.phase4
        END as phase_score,
        g.average as overall_average
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN grades g ON s.id = g.student_id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE g.phase${phase} IS NOT NULL
    `);
    
    console.log(`Encontrados ${students.length} estudiantes con calificaciones para la fase ${phase}`);
    
    // 2. Para cada estudiante con nota < 3.5, generar plan de mejoramiento
    for (const student of students) {
      if (student.phase_score < 3.5) {
        await generateImprovementPlan(student, phase);
      }
      
      // Si es la fase final (4) y el promedio general es < 3.0, marcar como materia perdida
      if (phase === 4 && student.overall_average < 3.0) {
        await markFailedSubject(student);
      }
    }
    
    return { success: true, message: `Evaluación de fase ${phase} completada` };
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
    
    // 7. Insertar el plan en la base de datos
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
      passedAchievements,
    ]);
    
    console.log(`Plan de mejoramiento generado para ${student.student_name} en fase ${phase}`);
    
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
    
    // 4. Insertar el plan en la base de datos
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
    
  } catch (error) {
    console.error(`Error generando plan de habilitación:`, error);
    throw error;
  }
};

export default {
  evaluatePhaseResults,
  generateImprovementPlan
};
