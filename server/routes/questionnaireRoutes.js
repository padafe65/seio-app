// routes/questionnaireRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { ensureSubjectCategoryExists } from '../utils/syncSubjectCategories.js';
import { verifyToken, validateTeacherSubject } from '../middleware/authMiddleware.js';
import { logCreate, logUpdate, logDelete } from '../utils/auditLogger.js';

const router = express.Router();

// Obtener todos los cuestionarios
// Si el usuario es super_administrador: devuelve todos
// Si el usuario es docente: devuelve solo los que creó
router.get('/', verifyToken, async (req, res) => {
  try {
    const { created_by, phase, grade, studentId, description } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    
    let params = [];
    let conditions = [];
    // Verificar si el campo institution existe en users
    let hasInstitution = false;
    try {
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    const institutionField = hasInstitution ? ', u.institution as teacher_institution' : '';
    
    // Construir la consulta base
    let query = `
      SELECT 
        q.id, q.title, q.subject, q.category, q.grade, q.phase, q.created_at, q.course_id, q.questions_to_answer, q.time_limit_minutes, q.created_by, q.description,
        q.is_prueba_saber, q.prueba_saber_level, q.prueba_saber_type,
        u.name as created_by_name${institutionField},
        COALESCE(c.name, 'Todos los cursos') as course_name,
        (SELECT COUNT(*) FROM questions WHERE questionnaire_id = q.id) as question_count
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN courses c ON q.course_id = c.id
    `;
    
    // Si hay un studentId en el query string (para otros roles que consultan por estudiante)
    // Pero si el usuario autenticado ES estudiante, se maneja en la lógica de roles
    if (studentId && userRole !== 'estudiante') {
      // Obtener el grado y course_id del estudiante
      const [studentRows] = await pool.query(
        'SELECT grade, course_id FROM students WHERE user_id = ?',
        [studentId]
      );

      if (studentRows.length > 0) {
        const studentGrade = studentRows[0].grade;
        
        // Filtrar cuestionarios por el grado del estudiante
        conditions.push('q.grade = ?');
        params.push(studentGrade);
      } else {
        // Si no se encuentra el estudiante, devolver un array vacío
        return res.json([]);
      }
    }
    
    // Lógica de roles: super_administrador y administrador ven todos, docente solo los suyos, estudiante solo los de sus docentes
    if (userRole === 'super_administrador' || userRole === 'administrador') {
      // Super administrador y administrador pueden ver todos los cuestionarios
      // Si hay created_by en el query, respetarlo; si no, mostrar todos
      if (created_by) {
        const [teacherRows] = await pool.query(
          'SELECT id FROM teachers WHERE user_id = ?',
          [created_by]
        );
        
        if (teacherRows.length > 0) {
          const teacherId = teacherRows[0].id;
          conditions.push('q.created_by = ?');
          params.push(teacherId);
        }
      }
      // Si no hay created_by, no agregar filtro (mostrar todos)
    } else if (userRole === 'docente') {
      // Docente solo puede ver sus propios cuestionarios
      // Obtener el teacher_id del usuario autenticado
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [userId]
      );
      
      if (teacherRows.length > 0) {
        const teacherId = teacherRows[0].id;
        conditions.push('q.created_by = ?');
        params.push(teacherId);
        console.log(`🔒 Filtrando cuestionarios para docente (teacher_id: ${teacherId})`);
      } else {
        // Si el docente no tiene registro en teachers, devolver vacío
        console.warn(`⚠️ Docente ${userId} no tiene registro en teachers`);
        return res.json([]);
      }
    } else if (userRole === 'estudiante') {
      // Estudiante solo puede ver cuestionarios de sus docentes asignados
      // Obtener el student_id del usuario autenticado
      const [studentRows] = await pool.query(
        'SELECT id, course_id, grade FROM students WHERE user_id = ?',
        [userId]
      );
      
      if (studentRows.length === 0) {
        console.warn(`⚠️ Estudiante ${userId} no tiene registro en students`);
        return res.json([]);
      }
      
      const studentId = studentRows[0].id;
      const studentCourseId = studentRows[0].course_id;
      const studentGrade = studentRows[0].grade;
      
      // Obtener año académico actual para filtrar
      const currentAcademicYear = new Date().getFullYear();
      
      // Obtener cuestionarios que el estudiante ya ha intentado (filtrados por academic_year)
      const [attemptedQuestionnaires] = await pool.query(
        'SELECT DISTINCT questionnaire_id FROM quiz_attempts WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)',
        [studentId, currentAcademicYear]
      );
      const attemptedQuestionnaireIds = attemptedQuestionnaires.map(aq => aq.questionnaire_id);
      
      // Obtener los teacher_id de los docentes asignados a este estudiante (filtrados por academic_year)
      const [teacherStudentRows] = await pool.query(
        'SELECT teacher_id FROM teacher_students WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)',
        [studentId, currentAcademicYear]
      );
      
      const teacherIds = teacherStudentRows.length > 0 
        ? teacherStudentRows.map(ts => ts.teacher_id)
        : [];
      
      // Si no hay docentes asignados ni cuestionarios intentados, devolver vacío
      if (teacherIds.length === 0 && attemptedQuestionnaireIds.length === 0) {
        console.warn(`⚠️ Estudiante ${studentId} no tiene docentes asignados ni cuestionarios intentados`);
        return res.json([]);
      }
      
      if (teacherIds.length === 0 && attemptedQuestionnaireIds.length > 0) {
        console.log(`ℹ️ Estudiante ${studentId} no tiene docentes asignados, pero tiene ${attemptedQuestionnaireIds.length} cuestionario(s) intentado(s): ${attemptedQuestionnaireIds.join(', ')}`);
      }
      
      // Construir la condición base: cuestionarios de docentes asignados con filtros O cuestionarios ya intentados (sin filtros restrictivos)
      let mainCondition = '';
      
      // Condición para cuestionarios de docentes asignados (con filtros de curso/grado/institución)
      if (teacherIds.length > 0) {
        let teacherFilterCondition = `q.created_by IN (${teacherIds.map(() => '?').join(',')})`;
        const teacherFilterParams = [...teacherIds];
        
        // Filtrar por curso del estudiante (solo para cuestionarios de docentes asignados)
        // Incluir cuestionarios "para todo el grado" (course_id IS NULL)
        if (studentCourseId) {
          teacherFilterCondition += ' AND (q.course_id = ? OR q.course_id IS NULL)';
          teacherFilterParams.push(studentCourseId);
        }
        
        // Filtrar por grado del estudiante (solo para cuestionarios de docentes asignados)
        if (studentGrade) {
          teacherFilterCondition += ' AND q.grade = ?';
          teacherFilterParams.push(studentGrade);
        }
        
        // Filtrar por institución si existe (solo para cuestionarios de docentes asignados)
        if (hasInstitution) {
          const [studentUserRows] = await pool.query(
            'SELECT institution FROM users WHERE id = ?',
            [userId]
          );
          
          if (studentUserRows.length > 0 && studentUserRows[0].institution) {
            const studentInstitution = studentUserRows[0].institution;
            teacherFilterCondition += ' AND (u.institution = ? OR u.institution IS NULL)';
            teacherFilterParams.push(studentInstitution);
          }
        }
        
        mainCondition = `${teacherFilterCondition}`;
        params.push(...teacherFilterParams);
      }
      
      // Agregar cuestionarios ya intentados (sin filtros restrictivos - el estudiante debe poder verlos para hacer el segundo intento)
      if (attemptedQuestionnaireIds.length > 0) {
        if (mainCondition) {
          mainCondition += ` OR q.id IN (${attemptedQuestionnaireIds.map(() => '?').join(',')})`;
        } else {
          mainCondition = `q.id IN (${attemptedQuestionnaireIds.map(() => '?').join(',')})`;
        }
        params.push(...attemptedQuestionnaireIds);
      }
      
      if (mainCondition) {
        conditions.push(`(${mainCondition})`);
      }
      
      console.log(`🔒 Filtrando cuestionarios para estudiante ${studentId} (docentes: ${teacherIds.join(', ')}, cuestionarios intentados: ${attemptedQuestionnaireIds.join(', ') || 'ninguno'}, curso: ${studentCourseId}, grado: ${studentGrade})`);
    } else {
      // Otros roles no pueden ver cuestionarios aquí
      return res.status(403).json({ 
        success: false,
        message: 'No tienes permiso para ver cuestionarios' 
      });
    }
    
    // Si hay created_by en el query y el usuario no es super_administrador, ignorarlo
    // (ya se filtró arriba por el rol)
    if (created_by && userRole !== 'super_administrador') {
      console.log('⚠️ Parámetro created_by ignorado para usuario no administrador');
    }
    
    // Para estudiantes, los filtros de phase/grade del query string son opcionales
    // y solo afectan a cuestionarios NO intentados (los intentados ya están incluidos)
    // Para otros roles, aplicar filtros normalmente
    if (phase) {
      conditions.push('q.phase = ?');
      params.push(phase);
    }
    
    if (grade && userRole !== 'estudiante') {
      // Para estudiantes, el filtro de grado ya se aplicó arriba en teacherFilterCondition
      // Solo aplicar aquí para otros roles
      conditions.push('q.grade = ?');
      params.push(grade);
    }

    if (description) {
      conditions.push('q.description = ?');
      params.push(description);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY q.created_at DESC';
    
    const [rows] = await pool.query(query, params);
    
    // Enriquecer los resultados con el nombre de la materia
    const enrichedRows = rows.map(q => {
      const parts = q.category?.split('_') || [];
      return {
        ...q,
        subject_name: parts[1] || '',
      };
    });
    
    res.json(enrichedRows);
  } catch (error) {
    console.error('❌ Error al obtener cuestionarios:', error);
    res.status(500).json({ message: 'Error al obtener cuestionarios' });
  }
});

// Obtener un cuestionario específico por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        q.id, q.title, q.subject, q.category, q.grade, q.phase, q.created_at, q.course_id, q.questions_to_answer, q.time_limit_minutes, q.created_by, q.description,
        q.is_prueba_saber, q.prueba_saber_level, q.prueba_saber_type,
        u.name as created_by_name,
        COALESCE(c.name, 'Todos los cursos') as course_name
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE q.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado' });
    }
    
    const questionnaire = rows[0];
    
    // Asegurar que la combinación subject-category existe en subject_categories
    await ensureSubjectCategoryExists(questionnaire.subject, questionnaire.category);
    
    // Obtener las preguntas asociadas al cuestionario
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ?',
      [id]
    );
    
    res.json({
      questionnaire,
      questions
    });
  } catch (error) {
    console.error('❌ Error al obtener cuestionario:', error);
    res.status(500).json({ message: 'Error al obtener cuestionario' });
  }
});

// Crear un nuevo cuestionario
// 🔒 Validación: Docentes solo pueden crear contenido de SU materia
router.post('/', verifyToken, validateTeacherSubject, async (req, res) => {
  try {
    // created_by debe ser el user_id del docente autenticado
    const created_by = req.user.id;
    const { title, subject, category, grade, phase, course_id, description, questions_to_answer, time_limit_minutes } = req.body;
    
    console.log('Datos recibidos para crear cuestionario:', req.body);
    
    // Normalizar course_id:
    // - null/undefined => "Todos los cursos"
    // - 'ALL'/'all' => null
    // - '' => null
    const normalizedCourseId =
      course_id === 'ALL' || course_id === 'all' || course_id === '' || course_id === null || course_id === undefined
        ? null
        : course_id;

    // Normalizar questions_to_answer (NULL => todas las preguntas)
    const normalizedQuestionsToAnswer =
      questions_to_answer === '' || questions_to_answer === null || questions_to_answer === undefined
        ? null
        : parseInt(questions_to_answer, 10);

    if (normalizedQuestionsToAnswer !== null) {
      if (Number.isNaN(normalizedQuestionsToAnswer) || normalizedQuestionsToAnswer <= 0) {
        return res.status(400).json({
          message: 'questions_to_answer debe ser un entero positivo o NULL',
          received: questions_to_answer
        });
      }
    }

    const normalizedTimeLimitMinutes =
      time_limit_minutes === '' || time_limit_minutes === null || time_limit_minutes === undefined
        ? null
        : parseInt(time_limit_minutes, 10);

    if (normalizedTimeLimitMinutes !== null) {
      if (Number.isNaN(normalizedTimeLimitMinutes) || normalizedTimeLimitMinutes <= 0) {
        return res.status(400).json({
          message: 'time_limit_minutes debe ser un entero positivo o NULL',
          received: time_limit_minutes
        });
      }
    }

    // Validar que todos los campos necesarios estén presentes (description es opcional)
    if (!title || !grade || !phase) {
      console.log('Faltan campos requeridos:', { title, subject, category, grade, phase, course_id: normalizedCourseId, description, questions_to_answer: normalizedQuestionsToAnswer });
      return res.status(400).json({ 
        message: 'Faltan campos requeridos', 
        received: { title, subject, category, grade, phase, course_id: normalizedCourseId, description, questions_to_answer: normalizedQuestionsToAnswer } 
      });
    }
    
    // El subject ya está validado y forzado por validateTeacherSubject
    // Obtener el ID del profesor (teacher_id ya está en req.body por el middleware)
    const teacherId = req.body.teacher_id;
    const finalSubject = req.body.subject; // Subject validado por middleware
    
    // Asegurar que la combinación subject-category existe en subject_categories
    await ensureSubjectCategoryExists(finalSubject, category);
    
    const { is_prueba_saber, prueba_saber_level } = req.body;
    
    // Validar nivel de Prueba Saber si es tipo Prueba Saber
    let finalPruebaSaberLevel = null;
    if (is_prueba_saber === 'true' || is_prueba_saber === true) {
      const validLevels = [3, 5, 9, 11];
      const level = parseInt(prueba_saber_level);
      if (!validLevels.includes(level)) {
        return res.status(400).json({ 
          message: 'El nivel de Prueba Saber debe ser 3, 5, 9 o 11',
          received: prueba_saber_level
        });
      }
      finalPruebaSaberLevel = level;
    }
    
    const [result] = await pool.query(
      `INSERT INTO questionnaires (title, subject, category, grade, phase, course_id, questions_to_answer, time_limit_minutes, created_by, description, is_prueba_saber, prueba_saber_level) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, 
        finalSubject || null, 
        category || null, 
        grade, 
        phase, 
        normalizedCourseId, 
        normalizedQuestionsToAnswer,
        normalizedTimeLimitMinutes,
        teacherId, 
        description || null,
        is_prueba_saber === 'true' || is_prueba_saber === true ? 1 : 0,
        finalPruebaSaberLevel
      ]
    );
    
    // 📝 Registrar en auditoría
    await logCreate(
      'questionnaires',
      result.insertId,
      req.user.id,
      req.user.role,
      req.user.name || 'Usuario',
      { title, subject: finalSubject, category, grade, phase, course_id: normalizedCourseId, description },
      req
    );
    
    res.status(201).json({ 
      message: 'Cuestionario creado correctamente', 
      id: result.insertId 
    });
  } catch (error) {
    console.error('❌ Error al crear cuestionario:', error);
    res.status(500).json({ message: 'Error al crear cuestionario' });
  }
});

// Actualizar un cuestionario existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, category, grade, phase, course_id, description, is_prueba_saber, prueba_saber_level, questions_to_answer, time_limit_minutes } = req.body;

    const normalizedCourseId =
      course_id === 'ALL' || course_id === 'all' || course_id === '' || course_id === null || course_id === undefined
        ? null
        : course_id;

    const normalizedQuestionsToAnswer =
      questions_to_answer === '' || questions_to_answer === null || questions_to_answer === undefined
        ? null
        : parseInt(questions_to_answer, 10);

    if (normalizedQuestionsToAnswer !== null) {
      if (Number.isNaN(normalizedQuestionsToAnswer) || normalizedQuestionsToAnswer <= 0) {
        return res.status(400).json({
          message: 'questions_to_answer debe ser un entero positivo o NULL',
          received: questions_to_answer
        });
      }
    }

    const normalizedTimeLimitMinutes =
      time_limit_minutes === '' || time_limit_minutes === null || time_limit_minutes === undefined
        ? null
        : parseInt(time_limit_minutes, 10);

    if (normalizedTimeLimitMinutes !== null) {
      if (Number.isNaN(normalizedTimeLimitMinutes) || normalizedTimeLimitMinutes <= 0) {
        return res.status(400).json({
          message: 'time_limit_minutes debe ser un entero positivo o NULL',
          received: time_limit_minutes
        });
      }
    }
    
    // Asegurar que la combinación subject-category existe en subject_categories
    await ensureSubjectCategoryExists(subject, category);
    
    // Obtener valores antiguos para auditoría
    const [oldQuestionnaire] = await pool.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [id]
    );
    
    if (oldQuestionnaire.length === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado' });
    }
    
    const oldValues = {
      title: oldQuestionnaire[0].title,
      subject: oldQuestionnaire[0].subject,
      category: oldQuestionnaire[0].category,
      grade: oldQuestionnaire[0].grade,
      phase: oldQuestionnaire[0].phase,
      course_id: oldQuestionnaire[0].course_id,
      description: oldQuestionnaire[0].description
    };
    
    // Validar nivel de Prueba Saber si es tipo Prueba Saber
    let finalPruebaSaberLevel = null;
    if (is_prueba_saber === 'true' || is_prueba_saber === true) {
      const validLevels = [3, 5, 9, 11];
      const level = parseInt(prueba_saber_level);
      if (!validLevels.includes(level)) {
        return res.status(400).json({ 
          message: 'El nivel de Prueba Saber debe ser 3, 5, 9 o 11',
          received: prueba_saber_level
        });
      }
      finalPruebaSaberLevel = level;
    }
    
    const [result] = await pool.query(
      `UPDATE questionnaires 
       SET title = ?, subject = ?, category = ?, grade = ?, phase = ?, course_id = ?, questions_to_answer = ?, time_limit_minutes = ?, description = ?, 
           is_prueba_saber = ?, prueba_saber_level = ? 
       WHERE id = ?`,
      [
        title, 
        subject || null, 
        category || null, 
        grade, 
        phase, 
        normalizedCourseId,
        normalizedQuestionsToAnswer,
        normalizedTimeLimitMinutes,
        description || null,
        is_prueba_saber === 'true' || is_prueba_saber === true ? 1 : 0,
        finalPruebaSaberLevel,
        id
      ]
    );
    
    // 📝 Registrar en auditoría
    await logUpdate(
      'questionnaires',
      parseInt(id),
      req.user.id,
      req.user.role,
      req.user.name || 'Usuario',
      oldValues,
      { title, subject, category, grade, phase, course_id: normalizedCourseId, description },
      req
    );
    
    res.json({ message: 'Cuestionario actualizado correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar cuestionario:', error);
    res.status(500).json({ message: 'Error al actualizar cuestionario' });
  }
});

// Eliminar un cuestionario
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener datos del cuestionario para auditoría antes de eliminar
    const [questionnaire] = await pool.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [id]
    );
    
    if (questionnaire.length === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado' });
    }
    
    const deletedQuestionnaireData = {
      title: questionnaire[0].title,
      subject: questionnaire[0].subject,
      category: questionnaire[0].category,
      grade: questionnaire[0].grade,
      phase: questionnaire[0].phase,
      course_id: questionnaire[0].course_id,
      description: questionnaire[0].description
    };
    
    // Primero eliminar las preguntas asociadas
    await pool.query('DELETE FROM questions WHERE questionnaire_id = ?', [id]);
    
    // Luego eliminar el cuestionario
    await pool.query('DELETE FROM questionnaires WHERE id = ?', [id]);
    
    // 📝 Registrar en auditoría
    await logDelete(
      'questionnaires',
      parseInt(id),
      req.user.id,
      req.user.role,
      req.user.name || 'Usuario',
      deletedQuestionnaireData,
      req
    );
    
    res.json({ message: 'Cuestionario y sus preguntas eliminados correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar cuestionario:', error);
    res.status(500).json({ message: 'Error al eliminar cuestionario' });
  }
});



export default router;
