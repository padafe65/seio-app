/**
 * Sincronización automática de datos cuando existe una relación teacher_students
 * 
 * Esta función sincroniza automáticamente:
 * - institution entre docente y estudiante (y tablas relacionadas)
 * - academic_year en diferentes tablas
 * - course_id y grade desde courses si están disponibles
 */

import pool from '../config/db.js';

/**
 * Sincroniza automáticamente institution, academic_year, course_id y grade
 * cuando existe una relación teacher_students
 * 
 * @param {number} teacherId - ID del docente (teachers.id)
 * @param {number} studentId - ID del estudiante (students.id)
 * @param {number|null} academicYear - Año académico (opcional, se usa el actual si es null)
 * @returns {Promise<Object>} Resultado de la sincronización
 */
export async function syncTeacherStudentData(teacherId, studentId, academicYear = null) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Obtener año académico actual si no se proporciona
    const currentAcademicYear = academicYear || new Date().getFullYear();

    console.log(`🔄 Iniciando sincronización automática: teacher_id=${teacherId}, student_id=${studentId}, academic_year=${currentAcademicYear}`);

    // 1. Obtener datos del estudiante
    const [studentRows] = await connection.query(
      'SELECT id, user_id, course_id, grade, institution FROM students WHERE id = ?',
      [studentId]
    );

    if (studentRows.length === 0) {
      throw new Error(`Estudiante con id ${studentId} no encontrado`);
    }

    const student = studentRows[0];

    // 2. Obtener datos del docente
    const [teacherRows] = await connection.query(
      'SELECT id, user_id, institution FROM teachers WHERE id = ?',
      [teacherId]
    );

    if (teacherRows.length === 0) {
      throw new Error(`Docente con id ${teacherId} no encontrado`);
    }

    const teacher = teacherRows[0];

    // 3. Obtener institution del usuario del estudiante
    let studentUserInstitution = null;
    try {
      const [userRows] = await connection.query(
        'SELECT institution FROM users WHERE id = ?',
        [student.user_id]
      );
      if (userRows.length > 0) {
        studentUserInstitution = userRows[0].institution;
      }
    } catch (error) {
      console.log('⚠️ No se pudo obtener institution del usuario del estudiante:', error.message);
    }

    // 4. Obtener institution del usuario del docente
    let teacherUserInstitution = null;
    try {
      const [userRows] = await connection.query(
        'SELECT institution FROM users WHERE id = ?',
        [teacher.user_id]
      );
      if (userRows.length > 0) {
        teacherUserInstitution = userRows[0].institution;
      }
    } catch (error) {
      console.log('⚠️ No se pudo obtener institution del usuario del docente:', error.message);
    }

    // 5. Obtener datos del curso si existe course_id
    let courseInstitution = null;
    let courseGrade = null;
    if (student.course_id) {
      try {
        const [courseRows] = await connection.query(
          'SELECT institution, grade FROM courses WHERE id = ?',
          [student.course_id]
        );
        if (courseRows.length > 0) {
          courseInstitution = courseRows[0].institution;
          courseGrade = courseRows[0].grade;
        }
      } catch (error) {
        console.log('⚠️ No se pudo obtener datos del curso:', error.message);
      }
    }

    // 6. Determinar institution final (prioridad: estudiante > curso > docente)
    let finalInstitution = 
      student.institution || 
      studentUserInstitution || 
      courseInstitution || 
      teacher.institution || 
      teacherUserInstitution;

    // 7. Determinar grade final (prioridad: estudiante > curso)
    let finalGrade = student.grade || courseGrade;

    // 8. Verificar si el campo institution existe en las tablas
    let hasInstitutionInUsers = false;
    let hasInstitutionInStudents = false;
    try {
      const [usersCols] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitutionInUsers = usersCols.length > 0;

      const [studentsCols] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'students' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitutionInStudents = studentsCols.length > 0;
    } catch (error) {
      console.log('⚠️ No se pudo verificar existencia del campo institution:', error.message);
    }

    const syncResults = {
      institution: {},
      academic_year: {},
      grade: {},
      course_id: {}
    };

    // 9. Sincronizar institution si existe y hay un valor final
    if (finalInstitution) {
      // Actualizar users.institution del estudiante
      if (hasInstitutionInUsers) {
        await connection.query(
          'UPDATE users SET institution = ? WHERE id = ?',
          [finalInstitution, student.user_id]
        );
        syncResults.institution.student_user = finalInstitution;
        console.log(`✅ Institution actualizado en users (estudiante): ${finalInstitution}`);
      }

      // Actualizar students.institution
      if (hasInstitutionInStudents) {
        await connection.query(
          'UPDATE students SET institution = ? WHERE id = ?',
          [finalInstitution, studentId]
        );
        syncResults.institution.student = finalInstitution;
        console.log(`✅ Institution actualizado en students: ${finalInstitution}`);
      }

      // Actualizar users.institution del docente (si no tiene o es diferente)
      if (hasInstitutionInUsers && (!teacherUserInstitution || teacherUserInstitution !== finalInstitution)) {
        await connection.query(
          'UPDATE users SET institution = ? WHERE id = ?',
          [finalInstitution, teacher.user_id]
        );
        syncResults.institution.teacher_user = finalInstitution;
        console.log(`✅ Institution actualizado en users (docente): ${finalInstitution}`);
      }
    }

    // 10. Sincronizar grade si existe
    if (finalGrade && !student.grade) {
      await connection.query(
        'UPDATE students SET grade = ? WHERE id = ?',
        [finalGrade, studentId]
      );
      syncResults.grade.student = finalGrade;
      console.log(`✅ Grade actualizado en students: ${finalGrade}`);
    }

    // 11. Sincronizar course_id si viene del curso pero no está en el estudiante
    if (student.course_id && !student.course_id) {
      // Esto no debería pasar, pero por si acaso
      console.log('ℹ️ course_id ya existe en el estudiante');
    }

    // 12. Actualizar academic_year en teacher_students si es necesario
    const [tsRows] = await connection.query(
      'SELECT academic_year FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
      [teacherId, studentId]
    );

    if (tsRows.length > 0) {
      const existingAcademicYear = tsRows[0].academic_year;
      if (!existingAcademicYear || existingAcademicYear !== currentAcademicYear) {
        await connection.query(
          'UPDATE teacher_students SET academic_year = ? WHERE teacher_id = ? AND student_id = ?',
          [currentAcademicYear, teacherId, studentId]
        );
        syncResults.academic_year.teacher_students = currentAcademicYear;
        console.log(`✅ academic_year actualizado en teacher_students: ${currentAcademicYear}`);
      }
    }

    // 13. Actualizar academic_year en grades si existen registros
    try {
      const [gradesRows] = await connection.query(
        'SELECT id FROM grades WHERE student_id = ? AND (academic_year IS NULL OR academic_year != ?)',
        [studentId, currentAcademicYear]
      );

      if (gradesRows.length > 0) {
        await connection.query(
          'UPDATE grades SET academic_year = ? WHERE student_id = ? AND (academic_year IS NULL OR academic_year != ?)',
          [currentAcademicYear, studentId, currentAcademicYear]
        );
        syncResults.academic_year.grades = { updated: gradesRows.length };
        console.log(`✅ academic_year actualizado en ${gradesRows.length} registros de grades`);
      }
    } catch (error) {
      console.log('⚠️ No se pudo actualizar academic_year en grades:', error.message);
    }

    // 14. Actualizar academic_year en improvement_plans si existen
    try {
      const [plansRows] = await connection.query(
        'SELECT id FROM improvement_plans WHERE student_id = ? AND (academic_year IS NULL OR academic_year != ?)',
        [studentId, currentAcademicYear]
      );

      if (plansRows.length > 0) {
        await connection.query(
          'UPDATE improvement_plans SET academic_year = ? WHERE student_id = ? AND (academic_year IS NULL OR academic_year != ?)',
          [currentAcademicYear, studentId, currentAcademicYear]
        );
        syncResults.academic_year.improvement_plans = { updated: plansRows.length };
        console.log(`✅ academic_year actualizado en ${plansRows.length} registros de improvement_plans`);
      }
    } catch (error) {
      console.log('⚠️ No se pudo actualizar academic_year en improvement_plans:', error.message);
    }

    // 15. Actualizar academic_year en evaluation_results si existen
    try {
      const [evalRows] = await connection.query(
        'SELECT id FROM evaluation_results WHERE student_id = ? AND (academic_year IS NULL OR academic_year != ?)',
        [studentId, currentAcademicYear]
      );

      if (evalRows.length > 0) {
        await connection.query(
          'UPDATE evaluation_results SET academic_year = ? WHERE student_id = ? AND (academic_year IS NULL OR academic_year != ?)',
          [currentAcademicYear, studentId, currentAcademicYear]
        );
        syncResults.academic_year.evaluation_results = { updated: evalRows.length };
        console.log(`✅ academic_year actualizado en ${evalRows.length} registros de evaluation_results`);
      }
    } catch (error) {
      console.log('⚠️ No se pudo actualizar academic_year en evaluation_results:', error.message);
    }

    // 16. Actualizar academic_year en phase_averages si existen
    try {
      const [phaseRows] = await connection.query(
        'SELECT id FROM phase_averages WHERE student_id = ? AND (academic_year IS NULL OR academic_year != ?)',
        [studentId, currentAcademicYear]
      );

      if (phaseRows.length > 0) {
        await connection.query(
          'UPDATE phase_averages SET academic_year = ? WHERE student_id = ? AND (academic_year IS NULL OR academic_year != ?)',
          [currentAcademicYear, studentId, currentAcademicYear]
        );
        syncResults.academic_year.phase_averages = { updated: phaseRows.length };
        console.log(`✅ academic_year actualizado en ${phaseRows.length} registros de phase_averages`);
      }
    } catch (error) {
      console.log('⚠️ No se pudo actualizar academic_year en phase_averages:', error.message);
    }

    await connection.commit();

    console.log(`✅ Sincronización completada exitosamente para teacher_id=${teacherId}, student_id=${studentId}`);

    return {
      success: true,
      teacherId,
      studentId,
      academicYear: currentAcademicYear,
      syncResults,
      finalInstitution,
      finalGrade
    };

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error en sincronización automática:', error);
    throw error;
  } finally {
    connection.release();
  }
}
