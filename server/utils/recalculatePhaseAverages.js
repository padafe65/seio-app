import pool from '../config/db.js';

/**
 * Recalcula los average_score en phase_averages basándose en evaluation_results
 * @param {number} studentId - ID del estudiante
 * @param {number} teacherId - ID del profesor (opcional, se busca automáticamente si no se proporciona)
 */
export const recalculatePhaseAverages = async (studentId, teacherId = null) => {
  try {
    console.log(`🔄 Recalculando phase_averages para estudiante ${studentId}`);
    
    // Obtener año académico actual para filtrar
    const currentAcademicYear = new Date().getFullYear();
    
    // Si no se proporciona teacherId, buscarlo (filtrado por academic_year)
    if (!teacherId) {
      const [teacherData] = await pool.query(
        'SELECT teacher_id FROM teacher_students WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)',
        [studentId, currentAcademicYear]
      );
      
      if (teacherData.length === 0) {
        console.warn(`⚠️ No se encontró profesor asignado para el estudiante ${studentId}`);
        return {
          success: false,
          error: `No se encontró profesor asignado para el estudiante ${studentId}`
        };
      }
      
      teacherId = teacherData[0].teacher_id;
      console.log(`📚 Profesor encontrado para estudiante ${studentId}: ${teacherId}`);
    }
    
    // 1. Obtener las mejores notas por cuestionario para cada fase (filtradas por academic_year)
    // EXCLUIR cuestionarios tipo Prueba Saber del cálculo de promedios
    const [questionnairesByPhase] = await pool.query(`
      SELECT 
        q.id as questionnaire_id,
        q.phase,
        q.title as questionnaire_title,
        COALESCE(er.best_score, 0) as best_score,
        CASE WHEN er.id IS NOT NULL THEN 1 ELSE 0 END as has_evaluation
      FROM questionnaires q
      LEFT JOIN evaluation_results er ON q.id = er.questionnaire_id 
        AND er.student_id = ? 
        AND (er.academic_year = ? OR er.academic_year IS NULL)
      WHERE (q.is_prueba_saber = FALSE OR q.is_prueba_saber IS NULL)
      ORDER BY q.phase, q.id
    `, [studentId, currentAcademicYear]);
    
    // 2. Agrupar por fase y calcular promedios
    const phaseData = {};
    
    questionnairesByPhase.forEach(q => {
      if (!phaseData[q.phase]) {
        phaseData[q.phase] = {
          phase: q.phase,
          questionnaires: [],
          totalEvaluations: 0,
          totalScore: 0,
          avgScore: 0
        };
      }
      
      phaseData[q.phase].questionnaires.push(q);
      
      if (q.has_evaluation) {
        phaseData[q.phase].totalEvaluations++;
        phaseData[q.phase].totalScore += parseFloat(q.best_score);
      }
    });
    
    // 3. Calcular promedio por fase
    const evalsByPhase = Object.values(phaseData).map(phase => {
      if (phase.totalEvaluations > 0) {
        phase.avgScore = parseFloat((phase.totalScore / phase.totalEvaluations).toFixed(2));
      }
      return {
        phase: phase.phase,
        avg_score: phase.avgScore,
        total_evaluations: phase.totalEvaluations,
        questionnaires: phase.questionnaires
      };
    }).filter(phase => phase.total_evaluations > 0);
    
    console.log(`📊 Evaluaciones encontradas para estudiante ${studentId}:`, evalsByPhase);
    
    // 4. Obtener todas las notas manuales individuales y promediarlas por fase.
    const [existingPhaseRows] = await pool.query(
      'SELECT phase, average_score, average_score_manual FROM phase_averages WHERE student_id = ? AND teacher_id = ?',
      [studentId, teacherId]
    );
    const [manualRows] = await pool.query(
      `SELECT phase, AVG(score) AS manual_average
       FROM manual_phase_grades
       WHERE student_id = ? AND teacher_id = ?
       GROUP BY phase`,
      [studentId, teacherId]
    );
    const manualByPhase = {};
    manualRows.forEach(r => { manualByPhase[r.phase] = parseFloat(parseFloat(r.manual_average).toFixed(2)); });

    // 5. Calcular definitiva por fase: sistema solo, manual solo, o promedio
    // de ambos cuando existen. Incluir registros manuales sin evaluación virtual.
    const systemByPhase = {};
    evalsByPhase.forEach(p => { systemByPhase[p.phase] = parseFloat(p.avg_score); });
    const phaseGrades = {};
    const knownPhases = new Set([
      ...Object.keys(systemByPhase).map(Number),
      ...Object.keys(manualByPhase).map(Number),
      ...existingPhaseRows.map(r => Number(r.phase))
    ]);
    for (const phase of knownPhases) {
      const system = systemByPhase[phase];
      const manual = manualByPhase[phase];
      const hasSystem = system != null && !isNaN(system);
      const hasManual = manual != null && !isNaN(parseFloat(manual));
      let definitive = null;
      if (hasSystem && hasManual) {
        definitive = parseFloat(((system + parseFloat(manual)) / 2).toFixed(2));
      } else if (hasSystem) {
        definitive = system;
      } else if (hasManual) {
        definitive = parseFloat(parseFloat(manual).toFixed(2));
      }
      phaseGrades[`phase${phase}`] = definitive;
    }

    // 6. Verificar si existe registro en grades (filtrado por academic_year)
    const [existingGrade] = await pool.query(
      'SELECT * FROM grades WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)',
      [studentId, currentAcademicYear]
    );
    
    if (existingGrade.length > 0) {
      // Actualizar registro existente
      const updateFields = [];
      const updateValues = [];
      
      for (const [phaseColumn, score] of Object.entries(phaseGrades)) {
        updateFields.push(`${phaseColumn} = ?`);
        updateValues.push(score);
      }
      
      if (updateFields.length > 0) {
        await pool.query(
          `UPDATE grades SET ${updateFields.join(', ')} WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)`,
          [...updateValues, studentId, currentAcademicYear]
        );
        console.log(`✅ Actualizado grades con fases:`, phaseGrades);
      }
    } else {
      // Crear nuevo registro
      const phaseColumns = Object.keys(phaseGrades);
      const phaseValues = Object.values(phaseGrades);
      const placeholders = phaseColumns.map(() => '?').join(', ');
      
      if (phaseColumns.length > 0) {
        await pool.query(
          `INSERT INTO grades (student_id, questionnaire_id, ${phaseColumns.join(', ')}, created_at, academic_year)
           VALUES (?, NULL, ${placeholders}, NOW(), ?)`,
          [studentId, ...phaseValues, currentAcademicYear]
        );
        console.log(`✅ Creado grades con fases:`, phaseGrades);
      }
    }
    
    // 7. Recalcular el promedio general en grades
    const [currentGrades] = await pool.query(
      'SELECT * FROM grades WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)',
      [studentId, currentAcademicYear]
    );
    if (currentGrades.length > 0) {
      const grades = currentGrades[0];
      const validPhases = [grades.phase1, grades.phase2, grades.phase3, grades.phase4]
        .filter(phase => phase !== null && phase !== undefined && !isNaN(parseFloat(phase)));
      
      let overallAverage = 0;
      if (validPhases.length > 0) {
        const sum = validPhases.reduce((acc, curr) => acc + parseFloat(curr), 0);
        overallAverage = sum / validPhases.length;
      }
      
      await pool.query(
        'UPDATE grades SET average = ? WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)',
        [overallAverage.toFixed(2), studentId, currentAcademicYear]
      );
      
      console.log(`✅ Promedio general calculado: ${overallAverage.toFixed(2)} (${validPhases.length} fases válidas)`);
    }
    
    // 8. Persistir promedios manuales y virtuales por fase.
    for (const phase of knownPhases) {
      const evalData = evalsByPhase.find(row => Number(row.phase) === Number(phase));
      const avgScore = evalData ? parseFloat(evalData.avg_score) : null;
      const evaluationsCompleted = evalData ? evalData.total_evaluations : 0;
      const manualAverage = manualByPhase[phase] ?? null;
      const [existingPhaseAvg] = await pool.query(
        'SELECT id FROM phase_averages WHERE student_id = ? AND teacher_id = ? AND phase = ?',
        [studentId, teacherId, phase]
      );
      
      if (existingPhaseAvg.length > 0) {
        await pool.query(
          'UPDATE phase_averages SET average_score = ?, average_score_manual = ?, evaluations_completed = ? WHERE student_id = ? AND teacher_id = ? AND phase = ?',
          [avgScore, manualAverage, evaluationsCompleted, studentId, teacherId, phase]
        );
        console.log(`✅ Actualizado phase_averages fase ${phase}: sistema=${avgScore}, manual=${manualAverage}`);
      } else {
        await pool.query(
          'INSERT INTO phase_averages (student_id, teacher_id, phase, average_score, average_score_manual, evaluations_completed) VALUES (?, ?, ?, ?, ?, ?)',
          [studentId, teacherId, phase, avgScore, manualAverage, evaluationsCompleted]
        );
        console.log(`✅ Creado phase_averages fase ${phase}: sistema=${avgScore}, manual=${manualAverage}`);
      }
    }
    
    return {
      success: true,
      message: `Phase averages recalculadas para estudiante ${studentId}`,
      phases: evalsByPhase
    };
    
  } catch (error) {
    console.error(`❌ Error recalculando phase_averages para estudiante ${studentId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Recalcula phase_averages para todos los estudiantes de un profesor
 * @param {number} teacherId - ID del profesor
 */
export const recalculateAllStudentsPhaseAverages = async (teacherId) => {
  try {
    console.log(`🔄 Recalculando phase_averages para todos los estudiantes del profesor ${teacherId}`);
    
    // Obtener todos los estudiantes del profesor
    const [students] = await pool.query(
      'SELECT DISTINCT student_id FROM teacher_students WHERE teacher_id = ?',
      [teacherId]
    );
    
    console.log(`📚 Encontrados ${students.length} estudiantes para el profesor ${teacherId}`);
    
    const results = [];
    
    for (const student of students) {
      const result = await recalculatePhaseAverages(student.student_id, teacherId);
      results.push({
        studentId: student.student_id,
        ...result
      });
    }
    
    return {
      success: true,
      message: `Phase averages recalculadas para ${students.length} estudiantes`,
      results
    };
    
  } catch (error) {
    console.error(`❌ Error recalculando phase_averages para profesor ${teacherId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  recalculatePhaseAverages,
  recalculateAllStudentsPhaseAverages
};
