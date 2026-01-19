/**
 * Validación y sincronización automática de institution en teacher_students
 * 
 * Esta función valida la concordancia de institution entre docente y estudiante
 * cuando se consulta una relación teacher_students, y sincroniza automáticamente
 * si hay inconsistencias.
 * 
 * @param {number} teacherId - ID del docente (teachers.id)
 * @param {number} studentId - ID del estudiante (students.id)
 * @returns {Promise<Object>} Resultado de la validación y sincronización
 */

import pool from '../config/db.js';
import { syncTeacherStudentData } from './syncTeacherStudentData.js';

export async function validateTeacherStudentInstitution(teacherId, studentId) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    console.log(`🔍 Validando concordancia de institution: teacher_id=${teacherId}, student_id=${studentId}`);

    // 1. Obtener institution del estudiante (desde students y users)
    const [studentRows] = await connection.query(
      `SELECT s.id, s.user_id, s.institution as student_institution, s.course_id,
              u.institution as student_user_institution
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [studentId]
    );

    if (studentRows.length === 0) {
      throw new Error(`Estudiante con id ${studentId} no encontrado`);
    }

    const student = studentRows[0];
    const studentInstitution = student.student_institution || student.student_user_institution;

    // 2. Obtener institution del docente (desde teachers, users y teacher_institutions)
    const [teacherRows] = await connection.query(
      `SELECT t.id, t.user_id, t.institution as teacher_institution,
              u.institution as teacher_user_institution
       FROM teachers t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = ?`,
      [teacherId]
    );

    if (teacherRows.length === 0) {
      throw new Error(`Docente con id ${teacherId} no encontrado`);
    }

    const teacher = teacherRows[0];
    const teacherInstitution = teacher.teacher_institution || teacher.teacher_user_institution;

    // 3. Obtener instituciones activas del docente desde teacher_institutions
    const [licenseRows] = await connection.query(
      `SELECT institution 
       FROM teacher_institutions 
       WHERE teacher_id = ? AND license_status = 'active'`,
      [teacherId]
    );
    const teacherLicensedInstitutions = licenseRows.map(row => row.institution);

    // 4. Obtener institution del curso si existe
    let courseInstitution = null;
    if (student.course_id) {
      const [courseRows] = await connection.query(
        'SELECT institution FROM courses WHERE id = ?',
        [student.course_id]
      );
      if (courseRows.length > 0) {
        courseInstitution = courseRows[0].institution;
      }
    }

    // 5. Determinar institution final (prioridad: estudiante > curso > docente)
    const finalInstitution = 
      studentInstitution || 
      courseInstitution || 
      teacherInstitution;

    // 6. Validar concordancia
    let isValid = false;
    let needsSync = false;
    const validationResult = {
      isValid: false,
      needsSync: false,
      studentInstitution,
      teacherInstitution,
      courseInstitution,
      finalInstitution,
      teacherLicensedInstitutions,
      message: ''
    };

    // Si hay institution definida, validar concordancia
    if (finalInstitution) {
      // Verificar si el docente tiene licencia activa para esta institución
      const hasLicense = teacherLicensedInstitutions.length === 0 || 
                        teacherLicensedInstitutions.includes(finalInstitution);

      // Verificar si las instituciones coinciden
      if (studentInstitution && teacherInstitution) {
        isValid = studentInstitution === teacherInstitution && hasLicense;
      } else if (studentInstitution || teacherInstitution) {
        // Si solo uno tiene institution, usar la que existe
        isValid = hasLicense;
      } else {
        // Si ninguno tiene, usar la del curso o considerar válido si no hay restricciones
        isValid = hasLicense || teacherLicensedInstitutions.length === 0;
      }

      // Si no es válido o hay inconsistencias, necesita sincronización
      if (!isValid || 
          (studentInstitution && studentInstitution !== finalInstitution) ||
          (teacherInstitution && teacherInstitution !== finalInstitution) ||
          !studentInstitution || !teacherInstitution) {
        needsSync = true;
      }
    } else {
      // Si no hay institution definida, considerar válido pero podría necesitar sincronización
      isValid = true;
      if (!studentInstitution && !teacherInstitution) {
        needsSync = false; // No hay nada que sincronizar
      } else {
        needsSync = true; // Hay institution en alguna parte pero no está sincronizada
      }
    }

    validationResult.isValid = isValid;
    validationResult.needsSync = needsSync;

    // 7. Si necesita sincronización, ejecutarla
    if (needsSync) {
      console.log(`🔄 Sincronizando institution automáticamente...`);
      try {
        const syncResult = await syncTeacherStudentData(teacherId, studentId);
        validationResult.synced = true;
        validationResult.syncResult = syncResult;
        validationResult.message = 'Institution sincronizada automáticamente';
        console.log(`✅ Sincronización completada`);
      } catch (syncError) {
        console.error('⚠️ Error en sincronización automática:', syncError.message);
        validationResult.synced = false;
        validationResult.syncError = syncError.message;
        validationResult.message = 'Se detectó inconsistencia pero no se pudo sincronizar automáticamente';
      }
    } else {
      validationResult.message = 'Concordancia de institution válida';
    }

    await connection.commit();

    return validationResult;

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error en validación de institution:', error);
    throw error;
  } finally {
    connection.release();
  }
}
