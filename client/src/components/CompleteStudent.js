import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const notiMySwal = withReactContent(Swal);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const CompletarEstudiante = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Buscar primero en temp_user_id (registro por docente) y luego en user_id (registro normal)
  const userId = localStorage.getItem('temp_user_id') || localStorage.getItem('user_id') || '';
  
  // Determinar si el usuario actual es admin, super_admin o docente
  const isAdminOrTeacher = user && (
    user.role === 'super_administrador' || 
    user.role === 'administrador' || 
    user.role === 'docente'
  );
  
  // Si fue creado por admin, también considerar como admin
  const createdByAdmin = localStorage.getItem('created_by_admin') === 'true';
  const isTeacherRegistration = localStorage.getItem('is_teacher_registration') === 'true';
  
  // Verificar si es para completar un registro existente (incompleto)
  const isCompletingExisting = localStorage.getItem('completing_student_id') || localStorage.getItem('completing_user_id');
  
  // Los campos deben ser requeridos si es admin/teacher quien crea
  // IMPORTANTE: Si está completando un registro existente desde Super Admin, también debe requerirse
  const shouldRequireCourseAndTeacher = isAdminOrTeacher || createdByAdmin || isTeacherRegistration || isCompletingExisting;
  
  // Debug: Log para verificar la lógica
  console.log('🔍 CompleteStudent - Contexto:', {
    isAdminOrTeacher,
    createdByAdmin,
    isTeacherRegistration,
    isCompletingExisting,
    shouldRequireCourseAndTeacher,
    userRole: user?.role
  });

  const [student, setStudent] = useState({
    contact_phone: '',
    contact_email: '',
    age: '',
    grade: '',
    course_id: '',
    user_id: userId,
    teacher_id: '' // Nuevo campo para el profesor
  });
  
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]); // Nuevo estado para profesores
  const [filteredTeachers, setFilteredTeachers] = useState([]); // Profesores filtrados por curso/grado
  const [userInstitution, setUserInstitution] = useState(null); // Institución del usuario/estudiante
  const [loading, setLoading] = useState(true);

  // Cargar la lista de cursos y profesores al montar el componente
  // También verificar si hay datos existentes si es un registro incompleto
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Obtener token para autenticación
        const token = localStorage.getItem('authToken');
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        
        const coursesResponse = await axios.get(`${API_URL}/api/courses`, config);
        console.log('📚 Cursos cargados:', coursesResponse.data);
        setCourses(coursesResponse.data || []);
        
        // Cargar todos los profesores inicialmente (sin filtro)
        const teachersResponse = await axios.get(`${API_URL}/api/teachers/list`, config);
        console.log('👨‍🏫 Profesores cargados:', teachersResponse.data);
        setTeachers(teachersResponse.data || []);
        setFilteredTeachers(teachersResponse.data || []);
        
        // Obtener la institución del usuario/estudiante
        if (userId) {
          console.log('🔍 Obteniendo institución para user_id:', userId);
          try {
            // Primero intentar obtener datos del estudiante (que incluye la institución del usuario)
            const studentResponse = await axios.get(`${API_URL}/api/students/user/${userId}`, config);
            if (studentResponse.data) {
              // Si el estudiante ya existe, usar su institución
              if (studentResponse.data.institution || studentResponse.data.user_institution) {
                const institution = studentResponse.data.institution || studentResponse.data.user_institution;
                setUserInstitution(institution);
                console.log('🏫 Institución del estudiante/usuario:', institution);
              }
              
              // Si es para completar un registro existente, cargar todos los datos
              if (isCompletingExisting) {
                console.log('📋 Datos existentes del estudiante:', studentResponse.data);
                setStudent(prev => ({
                  ...prev,
                  ...studentResponse.data,
                  user_id: userId
                }));
              }
            }
          } catch (error) {
            console.log('⚠️ No se encontraron datos de estudiante, intentando obtener institución del usuario directamente');
            // Si no hay datos de estudiante, obtener solo la institución del usuario
            try {
              const institutionResponse = await axios.get(`${API_URL}/api/users/${userId}/institution`, config);
              if (institutionResponse.data && institutionResponse.data.institution) {
                setUserInstitution(institutionResponse.data.institution);
                console.log('🏫 Institución del usuario:', institutionResponse.data.institution);
              } else {
                console.log('⚠️ El usuario no tiene institución asignada');
              }
            } catch (institutionError) {
              console.log('❌ No se pudo obtener la institución del usuario:', institutionError.response?.data || institutionError.message);
            }
          }
        } else {
          console.log('⚠️ No hay userId disponible para obtener la institución');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('❌ Error al cargar datos:', error);
        console.error('Detalles:', error.response?.data || error.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, isCompletingExisting]);

  // Filtrar profesores cuando cambia el curso, grado o institución
  useEffect(() => {
    const filterTeachers = async () => {
      const token = localStorage.getItem('authToken');
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      
      try {
        let filtered = [];
        let queryParams = [];
        
        console.log('🔍 Filtrando profesores con:', {
          course_id: student.course_id,
          grade: student.grade,
          institution: userInstitution
        });
        
        // Construir parámetros de consulta
        // IMPORTANTE: Si hay course_id, usarlo (tiene prioridad sobre grade)
        if (student.course_id) {
          queryParams.push(`course_id=${student.course_id}`);
        } else if (student.grade) {
          queryParams.push(`grade=${student.grade}`);
        }
        
        // Agregar institución si está disponible
        if (userInstitution) {
          queryParams.push(`institution=${encodeURIComponent(userInstitution)}`);
        }
        
        // Si hay filtros, hacer la consulta filtrada
        if (queryParams.length > 0) {
          const queryString = queryParams.join('&');
          console.log('🌐 Consultando:', `${API_URL}/api/teachers/list?${queryString}`);
          const response = await axios.get(`${API_URL}/api/teachers/list?${queryString}`, config);
          filtered = response.data || [];
          console.log('👨‍🏫 Profesores filtrados:', { 
            filters: { course_id: student.course_id, grade: student.grade, institution: userInstitution },
            count: filtered.length,
            teachers: filtered.map(t => ({ id: t.id, name: t.name, institution: t.institution, subject: t.subject }))
          });
        }
        // Si no hay filtro, mostrar todos
        else {
          console.log('ℹ️ Sin filtros, mostrando todos los profesores');
          filtered = teachers;
        }
        
        setFilteredTeachers(filtered);
        
        // Si el profesor actual no está en la lista filtrada, limpiar la selección
        if (student.teacher_id && filtered.length > 0) {
          const teacherExists = filtered.some(t => t.id.toString() === student.teacher_id.toString());
          if (!teacherExists) {
            console.log('⚠️ El profesor seleccionado no está en la lista filtrada, limpiando selección');
            setStudent(prev => ({ ...prev, teacher_id: '' }));
          }
        }
      } catch (error) {
        console.error('❌ Error al filtrar profesores:', error);
        console.error('📌 Detalles del error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          url: error.config?.url
        });
        // En caso de error, mostrar todos los profesores
        setFilteredTeachers(teachers);
      }
    };

    if (teachers.length > 0) {
      filterTeachers();
    } else {
      console.log('⚠️ No hay profesores cargados aún, esperando...');
    }
  }, [student.course_id, student.grade, userInstitution, teachers]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStudent({ ...student, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevenir el comportamiento predeterminado del formulario
    
    // Validar campos requeridos según el contexto
    if (shouldRequireCourseAndTeacher) {
      if (!student.course_id) {
        notiMySwal.fire({
          icon: 'warning',
          title: 'Campo requerido',
          text: 'Por favor selecciona un curso'
        });
        return;
      }
      if (!student.teacher_id) {
        notiMySwal.fire({
          icon: 'warning',
          title: 'Campo requerido',
          text: 'Por favor selecciona un profesor'
        });
        return;
      }
    }
    
    try {
      // Obtener token para autenticación
      const token = localStorage.getItem('authToken');
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      
      // Preparar datos para enviar (convertir course_id vacío a null si no es requerido)
      const studentData = {
        ...student,
        course_id: student.course_id || null
      };
      
      let studentId;
      const completingStudentId = localStorage.getItem('completing_student_id');
      
      // Si es para completar un registro existente, actualizar
      if (completingStudentId) {
        // Actualizar estudiante existente
        await axios.put(`${API_URL}/api/students/${completingStudentId}`, studentData, config);
        studentId = completingStudentId;
      } else {
        // Crear nuevo estudiante
        const studentResponse = await axios.post(`${API_URL}/api/students`, studentData, config);
        studentId = studentResponse.data.studentId;
      }
      
      // Si se seleccionó un profesor, crear/actualizar la relación en teacher_students
      if (student.teacher_id) {
        try {
          // Primero intentar eliminar relaciones existentes (si hay)
          try {
            await axios.delete(`${API_URL}/api/teacher/student/${studentId}/teacher`, config);
          } catch (deleteError) {
            // Ignorar 404 (no hay relaciones previas) u otros errores no críticos
            if (deleteError.response?.status !== 404) {
              console.log('⚠️ Error al eliminar relación previa (continuando):', deleteError.message);
            }
          }
          
          // Crear nueva relación
          await axios.post(`${API_URL}/api/teacher/assign-student`, {
            teacher_id: student.teacher_id,
            student_id: studentId
          }, config);
        } catch (relError) {
          console.error('❌ Error al manejar relación teacher_students:', relError);
          // No lanzar el error - la relación es importante pero no debería romper el guardado
        }
      }

      // Verificar si fue registro por docente o por admin ANTES de eliminar las banderas
      const isTeacherRegistration = localStorage.getItem('is_teacher_registration') === 'true';
      const createdByAdmin = localStorage.getItem('created_by_admin') === 'true';
      
      // Limpiar localStorage
      localStorage.removeItem('user_id');
      localStorage.removeItem('temp_user_id');
      localStorage.removeItem('is_teacher_registration');
      localStorage.removeItem('created_by_admin');
      localStorage.removeItem('completing_student_id');
      localStorage.removeItem('completing_user_id');
      
      // Mensaje de éxito
      notiMySwal.fire({
        icon: 'success',
        title: completingStudentId ? 'Registro actualizado' : 'Registro completo',
        html: `<i><strong>¡Bien hecho!</strong><br>${completingStudentId ? 'Los datos del estudiante han sido actualizados' : 'El registro del estudiante ha sido completado'} con éxito.</i>`,
        imageUrl: "img/estudiante.gif",
        imageWidth: 100,
        imageHeight: 100,
        confirmButtonText: 'Continuar',
        confirmButtonColor: '#3085d6'
      }).then(() => {
        // Redirigir dentro del callback de SweetAlert
        if (createdByAdmin) {
          navigate('/admin/users');
        } else if (isTeacherRegistration) {
          navigate('/estudiantes');
        } else if (isAdminOrTeacher) {
          navigate('/admin/students');
        } else {
          navigate('/');
        }
      });

    } catch (error) {
      console.error('Error al registrar/actualizar estudiante:', error);
      notiMySwal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Hubo un problema al guardar los datos. Por favor, intenta nuevamente.'
      });
    }
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando datos disponibles...</p>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="card">
        <div className="card-header bg-primary text-white">
          <h2 className="mb-0">Completar Datos de Estudiante</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="contact_phone" className="form-label">Teléfono de contacto</label>
              <input
                type="text"
                id="contact_phone"
                name="contact_phone"
                placeholder="Ej: 3168564142"
                onChange={handleChange}
                className="form-control"
                required
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="contact_email" className="form-label">Correo de contacto</label>
              <input
                type="email"
                id="contact_email"
                name="contact_email"
                placeholder="correo@ejemplo.com"
                onChange={handleChange}
                className="form-control"
                required
              />
            </div>
            
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="age" className="form-label">Edad</label>
                <input
                  type="number"
                  id="age"
                  name="age"
                  placeholder="Ej: 14"
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>
              
              <div className="col-md-6">
                <label htmlFor="grade" className="form-label">Grado</label>
                <select
                  id="grade"
                  name="grade"
                  onChange={handleChange}
                  className="form-select"
                  required
                >
                  <option value="">Selecciona un grado</option>
                  <option value="7">7°</option>
                  <option value="8">8°</option>
                  <option value="9">9°</option>
                  <option value="10">10°</option>
                  <option value="11">11°</option>
                </select>
              </div>
            </div>
            
            {/* Curso - Siempre visible, requerido solo si es admin/teacher quien crea */}
            <div className="mb-3">
              <label htmlFor="course_id" className="form-label">
                Curso {shouldRequireCourseAndTeacher && <span className="text-danger">*</span>}
              </label>
              <select
                id="course_id"
                name="course_id"
                onChange={handleChange}
                className="form-select"
                required={shouldRequireCourseAndTeacher}
                value={student.course_id}
              >
                <option value="">Selecciona un curso</option>
                {courses.length > 0 ? (
                  courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name} - Grado {course.grade}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No hay cursos disponibles</option>
                )}
              </select>
              {!shouldRequireCourseAndTeacher && (
                <small className="form-text text-muted">
                  Selecciona el curso al que perteneces. Si no estás seguro, un administrador lo asignará después.
                </small>
              )}
            </div>
            
            {/* Profesor - Siempre visible, requerido solo si es admin/teacher quien crea */}
            <div className="mb-3">
              <label htmlFor="teacher_id" className="form-label">
                Profesor {shouldRequireCourseAndTeacher && <span className="text-danger">*</span>}
                {userInstitution && (
                  <span className="badge bg-info ms-2" title={`Filtrado por institución: ${userInstitution}`}>
                    {userInstitution}
                  </span>
                )}
              </label>
              <select
                id="teacher_id"
                name="teacher_id"
                onChange={handleChange}
                className="form-select"
                required={shouldRequireCourseAndTeacher}
                value={student.teacher_id}
                disabled={!student.grade && !student.course_id && !userInstitution}
              >
                <option value="">
                  {!student.grade && !student.course_id && !userInstitution
                    ? 'Primero selecciona un grado, curso o verifica la institución' 
                    : 'Selecciona un profesor'}
                </option>
                {filteredTeachers.length > 0 ? (
                  filteredTeachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.subject}
                      {teacher.institution && ` (${teacher.institution})`}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    {student.grade || student.course_id || userInstitution
                      ? `No hay profesores disponibles${userInstitution ? ` de ${userInstitution}` : ''}${student.grade ? ` para grado ${student.grade}°` : ''}${student.course_id ? ' para este curso' : ''}`
                      : 'No hay profesores disponibles'}
                  </option>
                )}
              </select>
              <small className="form-text text-muted">
                {!student.grade && !student.course_id && !userInstitution
                  ? 'Primero selecciona un grado o curso para ver los profesores disponibles.'
                  : userInstitution
                    ? `Mostrando profesores de la institución "${userInstitution}"${student.grade ? ` del grado ${student.grade}°` : ''}${student.course_id ? ' de este curso' : ''}.`
                    : shouldRequireCourseAndTeacher 
                      ? 'Selecciona el profesor que estará a cargo del estudiante.'
                      : 'Selecciona tu profesor principal. Si no estás seguro, un administrador lo asignará después.'}
              </small>
            </div>
            
            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-success">
                Guardar y Completar Registro
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/')}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompletarEstudiante;
