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
    
    if (evalsByPhase.length === 0) {
      console.warn(`⚠️ No se encontraron evaluaciones completadas para el estudiante ${studentId}`);
      return {
        success: true,
        message: `No se encontraron evaluaciones completadas para el estudiante ${studentId}`,
        phases: []
      };
    }
    
    // 4. Obtener average_score_manual existente por fase (no sobrescribir)
    const [existingPhaseRows] = await pool.query(
      'SELECT phase, average_score_manual FROM phase_averages WHERE student_id = ? AND teacher_id = ?',
      [studentId, teacherId]
    );
    const manualByPhase = {};
    existingPhaseRows.forEach(r => { manualByPhase[r.phase] = r.average_score_manual; });

    // 5. Calcular definitiva por fase: sistema solo, o (sistema + manual) / 2
    const phaseGrades = {};
    for (const phase of evalsByPhase) {
      const manual = manualByPhase[phase.phase];
      const definitive = (manual != null && !isNaN(parseFloat(manual)))
        ? parseFloat(((phase.avg_score + parseFloat(manual)) / 2).toFixed(2))
        : phase.avg_score;
      phaseGrades[`phase${phase.phase}`] = definitive;
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
          `INSERT INTO grades (student_id, ${phaseColumns.join(', ')}, created_at, academic_year) 
           VALUES (?, ${placeholders}, NOW(), ?)`,
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
        .filter(phase => phase !== null && phase !== undefined && phase > 0);
      
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
    
    // 8. Actualizar phase_averages: solo average_score y evaluations_completed (preservar average_score_manual)
    for (const evalData of evalsByPhase) {
      const phase = evalData.phase;
      const avgScore = parseFloat(evalData.avg_score);
      const evaluationsCompleted = evalData.total_evaluations;
      
      const [existingPhaseAvg] = await pool.query(
        'SELECT id, average_score_manual FROM phase_averages WHERE student_id = ? AND teacher_id = ? AND phase = ?',
        [studentId, teacherId, phase]
      );
      
      if (existingPhaseAvg.length > 0) {
        await pool.query(
          'UPDATE phase_averages SET average_score = ?, evaluations_completed = ? WHERE student_id = ? AND teacher_id = ? AND phase = ?',
          [avgScore, evaluationsCompleted, studentId, teacherId, phase]
        );
        console.log(`✅ Actualizado phase_averages fase ${phase}: ${avgScore} (${evaluationsCompleted} evaluaciones), manual preservado`);
      } else {
        await pool.query(
          'INSERT INTO phase_averages (student_id, teacher_id, phase, average_score, evaluations_completed) VALUES (?, ?, ?, ?, ?)',
          [studentId, teacherId, phase, avgScore, evaluationsCompleted]
        );
        console.log(`✅ Creado phase_averages fase ${phase}: ${avgScore} (${evaluationsCompleted} evaluaciones)`);
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
