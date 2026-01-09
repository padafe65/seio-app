import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import StudentGradesEditor from '../../components/StudentGradesEditor';

const StudentForm = ({ isViewMode = false }) => {
  console.log('🚀 [StudentForm] Componente montado/actualizado');
  const { id } = useParams();
  console.log('📝 [StudentForm] Parámetro id de la URL:', id);
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  console.log('👤 [StudentForm] Estado de autenticación:', { 
    user: user ? { id: user.id, role: user.role } : null, 
    isAuthReady 
  });
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [showGradesEditor, setShowGradesEditor] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    contact_email: '',
    contact_phone: '',
    age: '',
    grade: '',
    course_id: '',
    teacher_id: ''
  });

  useEffect(() => {
    console.log('🔄 [StudentForm] useEffect ejecutado', { isAuthReady, user: user?.role, id });
    
    // Si isAuthReady es false por más de 5 segundos, mostrar un mensaje
    const authTimeout = setTimeout(() => {
      if (!isAuthReady) {
        console.error('❌ [StudentForm] Timeout esperando autenticación');
        setLoading(false);
      }
    }, 5000);
    
    // Esperar a que la autenticación esté lista
    if (!isAuthReady) {
      console.log('⏳ [StudentForm] Esperando autenticación...');
      return () => clearTimeout(authTimeout);
    }
    
    clearTimeout(authTimeout);
    
    // Si no hay usuario después de que la autenticación esté lista, redirigir
    if (!user) {
      console.log('❌ [StudentForm] No hay usuario, redirigiendo...');
      navigate('/');
      return;
    }
    
    // Verificar permisos: solo admin, super_administrador o docente pueden acceder
    if (!['admin', 'super_administrador', 'docente'].includes(user.role)) {
      console.log('❌ [StudentForm] Usuario sin permisos, redirigiendo...', user.role);
      navigate('/dashboard');
      return;
    }
    
    console.log('✅ [StudentForm] Permisos verificados, iniciando carga de datos...');

    const fetchCourses = async () => {
      try {
        const response = await axiosClient.get('/courses');
        setCourses(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error al cargar cursos:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los cursos. Por favor, intente más tarde.'
        });
      }
    };

    const fetchTeachers = async (currentTeacherId = null) => {
      console.log('🔍 Iniciando fetchTeachers...');
      
      try {
        // Realizar la petición para obtener la lista de docentes
        console.log('🌐 Solicitando lista de docentes a /teachers');
        
        let response;
        try {
          response = await axiosClient.get('/teachers');
          console.log('✅ Petición a /teachers exitosa');
        } catch (error) {
          // Manejar errores de red o de la API
          console.error('❌ Error en la petición a /api/teachers:', {
            message: error.message,
            response: error.response ? {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data
            } : 'No hay respuesta del servidor',
            request: error.request,
            config: error.config
          });
          
          // Proporcionar un mensaje más amigable según el tipo de error
          if (!error.response) {
            error.message = 'No se pudo conectar al servidor. Verifique su conexión a internet.';
          } else if (error.response.status === 401) {
            error.message = 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.';
            localStorage.removeItem('authToken');
            window.location.href = '/login';
          } else if (error.response.status === 403) {
            error.message = 'No tiene permisos para acceder a esta información.';
          } else if (error.response.status === 404) {
            error.message = 'El recurso solicitado no fue encontrado.';
          } else if (error.response.status >= 500) {
            error.message = 'Error interno del servidor. Por favor, intente más tarde.';
          }
          
          throw error;
        }
        
        // Verificar si la respuesta tiene el formato esperado
        if (!response.data) {
          throw new Error('La respuesta del servidor no contiene datos');
        }
        
        // Manejar diferentes formatos de respuesta
        let teachersList = [];
        if (Array.isArray(response.data)) {
          console.log('📋 Formato de respuesta: Array directo');
          teachersList = response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          console.log('📋 Formato de respuesta: Objeto con propiedad data');
          teachersList = response.data.data;
        } else {
          console.warn('⚠️ Formato de respuesta inesperado:', response.data);
          throw new Error('Formato de respuesta inesperado del servidor');
        }
        
        console.log('Docentes obtenidos del servidor:', teachersList);
        
        // 2. Si hay un ID de docente actual, asegurarse de que esté en la lista
        let currentTeacher = null;
        if (currentTeacherId) {
          console.log('Buscando docente con ID:', currentTeacherId);
          
          // Primero intentar encontrar el docente por user_id (que es lo que usa la relación)
          currentTeacher = teachersList.find(t => 
            (t.user_id && t.user_id.toString() === currentTeacherId.toString()) ||
            (t.id && t.id.toString() === currentTeacherId.toString())
          );
          
          // Si no está en la lista, intentar obtenerlo por separado
          if (!currentTeacher) {
            console.log('Docente no encontrado en la lista, buscando individualmente...');
            try {
              const teacherResponse = await axiosClient.get(`/teachers/${currentTeacherId}`);
              currentTeacher = teacherResponse.data?.data || teacherResponse.data;
              
              if (currentTeacher) {
                console.log('Docente encontrado individualmente:', currentTeacher);
                // Agregar el docente actual a la lista
                teachersList.unshift(currentTeacher);
              }
            } catch (teacherError) {
              console.warn('No se pudo cargar el docente actual:', teacherError);
            }
          } else {
            console.log('Docente encontrado en la lista:', currentTeacher);
          }
        }
        
        // 3. Mapear los datos para asegurar que tengan el formato esperado
        const formattedTeachers = teachersList.map(teacher => {
          // Aplanar la estructura si es necesario
          const teacherData = teacher.user ? {
            ...teacher,
            name: teacher.user.name,
            email: teacher.user.email,
            phone: teacher.user.phone
          } : teacher;
          
          // IMPORTANTE: Usar teachers.id (NO user_id) como ID principal
          // teachers.id es lo que se usa en teacher_students.teacher_id
          const teacherId = teacherData.id;
          
          return {
            id: teacherId,  // Este es teachers.id
            user_id: teacherData.user_id,  // Este es users.id (solo para referencia)
            name: teacherData.user_name || teacherData.name || `Docente #${teacherId}`,
            email: teacherData.user_email || teacherData.email || '',
            phone: teacherData.phone || ''
          };
        });
        
        console.log('Total de docentes cargados:', formattedTeachers.length);
        console.log('Lista de docentes formateada:', formattedTeachers);
        
        // 4. Si hay un docente actual, asegurarse de que esté seleccionado
        if (currentTeacher) {
          // Usar teachers.id (NO user_id)
          const teacherId = currentTeacher.id;
          if (teacherId) {
            setFormData(prev => ({
              ...prev,
              teacher_id: String(teacherId)
            }));
          }
        }
        
        setTeachers(formattedTeachers);
        return formattedTeachers;
      } catch (error) {
        console.error('Error al cargar profesores:', error);
        // Devolver lista vacía en caso de error
        setTeachers([]);
        return [];
      }
    };

    const fetchStudentData = async () => {
      if (!id) {
        console.log('⚠️ [StudentForm] No hay ID de estudiante');
        return;
      }
      
      try {
        console.log('🔍 [fetchStudentData] Obteniendo datos del estudiante con ID:', id);
        
        // 1. Obtener los datos del estudiante
        let studentData;
        try {
          console.log(`🌐 [fetchStudentData] Solicitando datos del estudiante con ID: ${id}`);
          const studentResponse = await axiosClient.get(`/students/${id}`);
          console.log('📦 [fetchStudentData] Respuesta recibida:', studentResponse);
          studentData = studentResponse.data?.data || studentResponse.data;
          console.log('✅ [fetchStudentData] Datos del estudiante obtenidos:', studentData);
          
          if (!studentData) {
            throw new Error('No se encontraron datos del estudiante');
          }
        } catch (error) {
          console.error('❌ Error al obtener datos del estudiante:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
          });
          
          let errorMessage = 'Error al cargar los datos del estudiante';
          if (error.response?.status === 404) {
            errorMessage = 'El estudiante solicitado no existe';
          } else if (error.response?.status === 403) {
            errorMessage = 'No tiene permisos para ver este estudiante';
          } else if (!error.response) {
            errorMessage = 'No se pudo conectar al servidor. Verifique su conexión a internet.';
          }
          
          throw new Error(errorMessage);
        }
        
        // 2. Inicializar el estado del formulario con los datos básicos del estudiante
        const initialFormData = {
          name: studentData.user_name || studentData.name || '',
          phone: studentData.user_phone || studentData.phone || '',
          email: studentData.user_email || studentData.email || '',
          contact_email: studentData.contact_email || '',
          contact_phone: studentData.contact_phone || '',
          age: studentData.age || '',
          grade: studentData.grade || '',
          course_id: studentData.course_id ? String(studentData.course_id) : '',
          teacher_id: studentData.teacher_id ? String(studentData.teacher_id) : ''
        };
        
        // 3. Establecer los datos iniciales del formulario
        setFormData(initialFormData);
        
        // 4. Verificar si el estudiante ya tiene un docente asignado
        let mainTeacherId = null;
        
        // Opción 1: Verificar si el estudiante tiene teacher_id directamente
        if (studentData.teacher_id) {
          mainTeacherId = studentData.teacher_id;
          console.log('👨\u200d🏫 Docente asignado encontrado en studentData.teacher_id:', mainTeacherId);
        } 
        // Opción 2: Verificar si hay un docente en la relación teacher_students
        else if (studentData.teachers && studentData.teachers.length > 0) {
          mainTeacherId = studentData.teachers[0].id || studentData.teachers[0].user_id;
          console.log('👨\u200d🏫 Docente asignado encontrado en relación teacher_students:', mainTeacherId);
        }
        
        // Depuración: Mostrar los datos completos del estudiante
        console.log('📋 Datos completos del estudiante:', studentData);
        console.log('🔍 Buscando teacher_id en studentData.teacher_id:', studentData.teacher_id);
        console.log('🔍 Buscando teacher_id en studentData.teacher_id (alternativa):', studentData.teacher_id);
        
        // 5. Si hay un docente asignado, actualizar el formulario
        if (mainTeacherId) {
          console.log(`🔄 Actualizando formulario con docente ID: ${mainTeacherId}`);
          setFormData(prev => ({
            ...prev,
            teacher_id: String(mainTeacherId)
          }));
          
          // Cargar la lista de docentes con énfasis en el docente actual
          console.log('🔄 Cargando lista de docentes con el docente principal...');
          await fetchTeachers(mainTeacherId);
          return; // Salir de la función después de cargar los docentes
        }
        
        // 6. Si no hay docente asignado o hubo un error, cargar la lista completa
        console.log('ℹ️ No se encontró docente asignado o hubo un error, cargando lista completa...');
        await fetchTeachers();
        
      } catch (error) {
        console.error('❌ Error al cargar datos del estudiante:', error);
        
        // Mostrar mensaje de error al usuario
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'No se pudo cargar la información del estudiante. Por favor, intente nuevamente.'
        });
        
        throw error; // Relanzar el error para manejarlo en loadData
      }
    };

    const loadData = async () => {
      try {
        console.log('🔄 [StudentForm] Iniciando carga de datos...', { id });
        setLoading(true);
        
        // 1. Cargar cursos
        console.log('📚 [StudentForm] Cargando cursos...');
        await fetchCourses();
        
        // 2. Si hay un ID, cargar datos del estudiante
        if (id) {
          console.log('👤 [StudentForm] Cargando datos del estudiante ID:', id);
          await fetchStudentData();
        } else {
          console.log('➕ [StudentForm] Nuevo estudiante, cargando docentes...');
          // Si es un nuevo estudiante, solo cargar la lista de docentes
          await fetchTeachers();
        }
        
        console.log('✅ [StudentForm] Datos cargados correctamente');
      } catch (error) {
        console.error('❌ [StudentForm] Error al cargar datos:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'No se pudieron cargar los datos. Por favor, intente nuevamente.'
        });
      } finally {
        console.log('🏁 [StudentForm] Finalizando carga, estableciendo loading = false');
        setLoading(false);
      }
    };

    loadData();
  }, [id, user, isAuthReady, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`Campo cambiado: ${name} = ${value}`);
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      console.log("Enviando datos:", formData);
      setLoading(true);

      // Validar datos requeridos
      if (!formData.name || !formData.email) {
        throw new Error('Nombre y correo electrónico son campos requeridos');
      }

      // Preparar los datos para enviar
      const studentData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || '',
        contact_email: formData.contact_email || '',
        contact_phone: formData.contact_phone || '',
        age: formData.age || null,
        grade: formData.grade || '',
        course_id: formData.course_id ? parseInt(formData.course_id) : null,
        // Asegurarse de que teacher_id sea un número o null
        teacher_id: formData.teacher_id ? parseInt(formData.teacher_id) : null
      };

      console.log("Datos a enviar al servidor:", studentData);

      if (!id) {
        // CREAR: Enviar todos los datos a la ruta de creación de estudiantes
        const response = await axiosClient.post('/students', studentData);
        console.log("Respuesta de creación:", response.data);

        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Estudiante creado correctamente',
          showConfirmButton: false,
          timer: 1500
        });

        navigate('/estudiantes');
      } else {
        // ACTUALIZAR: Usar PATCH para enviar solo los campos modificados
        const response = await axiosClient.patch(`/students/${id}`, studentData);
        console.log("Respuesta de actualización:", response.data);

        Swal.fire({
          icon: 'success',
          title: '¡Actualizado!',
          text: 'Estudiante actualizado correctamente',
          showConfirmButton: false,
          timer: 1500
        }).then(() => {
          // Redirigir según el rol del usuario
          let redirectPath = '/estudiantes';
          if (user?.role === 'docente') {
            redirectPath = '/mis-estudiantes';
          } else if (user?.role === 'super_administrador' || user?.role === 'admin') {
            redirectPath = '/estudiantes';
          }
          navigate(redirectPath);
        });
      }
    } catch (error) {
      console.error('Error completo:', error);
      
      let errorMessage = 'Hubo un problema al guardar los datos';
      
      if (error.response) {
        console.error('Detalles del error:', error.response.data);
        errorMessage = error.response.data?.message || 
                      error.response.data?.error || 
                      `Error ${error.response.status}: ${error.response.statusText}`;
      } else if (error.request) {
        console.error('No se recibió respuesta del servidor:', error.request);
        errorMessage = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
      }

      Swal.fire({
        icon: 'error',
        title: 'Error',
        html: `
          <div class="text-start">
            <p class="mb-2">${errorMessage}</p>
            ${error.response?.data?.details && typeof error.response.data.details === 'string' ? 
              `<p class="mb-1"><strong>Detalles:</strong> ${error.response.data.details}</p>` : 
              error.response?.data?.details && typeof error.response.data.details === 'object' ?
              `<p class="mb-1 fw-bold">Detalles:</p>
              <ul class="mb-0">
                ${Object.entries(error.response.data.details)
                  .map(([field, message]) => `<li><strong>${field}:</strong> ${message}</li>`)
                  .join('')}
              </ul>` : ''}
          </div>
        `,
        confirmButtonText: 'Entendido'
      });
    } finally {
      setLoading(false);
    }
  };

  console.log('🎨 [StudentForm] Renderizando componente', { 
    loading, 
    hasFormData: !!formData.name,
    id,
    user: user ? { id: user.id, role: user.role } : null,
    isAuthReady 
  });

  if (loading) {
    console.log('⏳ [StudentForm] Mostrando spinner de carga...');
    return (
      <div className="d-flex flex-column justify-content-center align-items-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-3 text-muted">Cargando datos del estudiante...</p>
      </div>
    );
  }

  console.log('✅ [StudentForm] Renderizando formulario completo');

  return (
    <div className="container my-4">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">
            {isViewMode 
              ? 'Detalles del Estudiante' 
              : id 
                ? 'Editar Estudiante' 
                : 'Registrar Nuevo Estudiante'}
          </h5>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="name" className="form-label">Nombre completo</label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                />
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="contact_email" className="form-label">Correo electrónico contacto</label>
                <input
                  type="email"
                  className="form-control"
                  id="contact_email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                />
              </div>
            </div>
            
            <div className="row">

              <div className="col-md-6 mb-3">
                              <label htmlFor="phone" className="form-label">Teléfono estudiante</label>
                              <input
                                type="text"
                                className="form-control"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                disabled={isViewMode}
                              />
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="contact_phone" className="form-label">Teléfono de contacto</label>
                <input
                  type="text"
                  className="form-control"
                  id="contact_phone"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                />
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="email" className="form-label">Correo electrónico estudiante</label>
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                />
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="age" className="form-label">Edad</label>
                <input
                  type="number"
                  className="form-control"
                  id="age"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                />
              </div>
            </div>
            
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="grade" className="form-label">Grado</label>
                <select
                  className="form-select"
                  id="grade"
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                >
                  <option value="">Seleccionar grado</option>
                  <option value="7">7°</option>
                  <option value="8">8°</option>
                  <option value="9">9°</option>
                  <option value="10">10°</option>
                  <option value="11">11°</option>
                </select>
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="teacher_id" className="form-label">Docente Asignado</label>
                {loading ? (
                  <div className="d-flex align-items-center">
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                    <span>Cargando docentes...</span>
                  </div>
                ) : (
                  <>
                    <select
                      id="teacher_id"
                      name="teacher_id"
                      className={`form-select ${!formData.teacher_id && 'is-invalid'}`}
                      value={formData.teacher_id || ''}
                      onChange={handleChange}
                      required
                      disabled={isViewMode || teachers.length === 0}
                    >
                      <option value="">Seleccione un docente</option>
                      {teachers.length > 0 ? (
                        teachers.map((teacher) => {
                          // Manejar tanto teacher.id como teacher.user_id
                          const teacherId = teacher.id || teacher.user_id;
                          const isSelected = formData.teacher_id === teacherId?.toString();
                          // Usar el nombre del usuario si está disponible, de lo contrario un valor por defecto
                          const displayName = teacher.user_name || teacher.name || `Docente #${teacherId}`;
                          
                          return (
                            <option 
                              key={teacherId}
                              value={teacherId}
                              className={isSelected ? 'fw-bold' : ''}
                            >
                              {isSelected ? '✓ ' : ''}{displayName}
                            </option>
                          );
                        })
                      ) : (
                        <option value="" disabled>No hay docentes disponibles</option>
                      )}
                    </select>
                    <div className="form-text">
                      {formData.teacher_id ? (
                        <span className="text-success">
                          <i className="bi bi-check-circle-fill me-1"></i>
                          Docente seleccionado correctamente
                        </span>
                      ) : (
                        <span className="text-warning">
                          <i className="bi bi-exclamation-triangle-fill me-1"></i>
                          {teachers.length === 0 ? 
                            'No hay docentes disponibles para asignar' : 
                            'Seleccione un docente para este estudiante'}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {!isViewMode && (
              <div className="d-flex justify-content-end mt-4">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary me-2"
                  onClick={() => navigate('/estudiantes')}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {id ? 'Actualizar' : 'Registrar'}
                </button>
              </div>
            )}

            {/* Botón para editar notas (solo cuando se está editando un estudiante existente) */}
            {id && !isViewMode && (
              <div className="d-flex justify-content-start mt-3">
                <button 
                  type="button" 
                  className="btn btn-outline-info"
                  onClick={() => setShowGradesEditor(!showGradesEditor)}
                >
                  {showGradesEditor ? 'Ocultar Editor de Notas' : 'Editar Notas del Estudiante'}
                </button>
              </div>
            )}
            
            {isViewMode && (
              <div className="d-flex justify-content-end mt-4">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary me-2"
                  onClick={() => navigate('/estudiantes')}
                >
                  Volver
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => navigate(`/estudiantes/${id}/editar`)}
                >
                  Editar
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Editor de notas */}
      {showGradesEditor && id && (
        <StudentGradesEditor 
          studentId={id} 
          onGradesUpdated={() => {
            // Callback opcional para refrescar datos si es necesario
            console.log('Notas actualizadas');
          }}
        />
      )}
    </div>
  );
};

export default StudentForm;
