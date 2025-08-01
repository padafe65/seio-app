import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/axios';

const StudentForm = ({ isViewMode = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth(); // Se mantiene por si se necesita en el futuro
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
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

  // Configuración para las peticiones HTTP
  const getAuthConfig = () => {
    const token = localStorage.getItem('authToken');
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await api.get('/api/courses', getAuthConfig());
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
      try {
        console.log('Obteniendo lista de docentes...');
        
        // 1. Obtener todos los docentes
        const response = await api.get('/api/teachers', getAuthConfig());
        
        // Manejar diferentes formatos de respuesta
        let teachersList = [];
        if (Array.isArray(response.data)) {
          teachersList = response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          teachersList = response.data.data;
        }
        
        console.log('Docentes obtenidos del servidor:', teachersList);
        
        // 2. Si hay un ID de docente actual, asegurarse de que esté en la lista
        if (currentTeacherId) {
          console.log('Buscando docente con ID:', currentTeacherId);
          
          // Verificar si el docente actual ya está en la lista
          const currentTeacher = teachersList.find(t => 
            (t.id && t.id.toString() === currentTeacherId.toString()) ||
            (t.user_id && t.user_id.toString() === currentTeacherId.toString())
          );
          
          // Si no está en la lista, intentar obtenerlo por separado
          if (!currentTeacher) {
            console.log('Docente no encontrado en la lista, buscando individualmente...');
            try {
              const teacherResponse = await api.get(`/api/teachers/${currentTeacherId}`, getAuthConfig());
              let teacherData = teacherResponse.data?.data || teacherResponse.data;
              
              // Si el docente viene con datos anidados de usuario, aplanarlos
              if (teacherData && teacherData.user) {
                teacherData = {
                  ...teacherData,
                  name: teacherData.user.name,
                  email: teacherData.user.email,
                  phone: teacherData.user.phone
                };
              }
              
              if (teacherData) {
                console.log('Docente encontrado individualmente:', teacherData);
                // Agregar al principio de la lista
                teachersList = [teacherData, ...teachersList];
              }
            } catch (teacherError) {
              console.warn('No se pudo cargar el docente actual:', teacherError);
            }
          } else {
            console.log('Docente encontrado en la lista:', currentTeacher);
          }
        }
        
        // 3. Mapear los datos para asegurar que tengan el formato esperado
        const formattedTeachers = teachersList.map(teacher => ({
          id: teacher.id,
          name: teacher.user_name || teacher.name || 'Docente sin nombre',
          email: teacher.user_email || teacher.email || '',
          phone: teacher.phone || '',
          user_id: teacher.user_id
        }));
        
        console.log('Total de docentes cargados:', formattedTeachers.length);
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
      if (!id) return;
      
      try {
        console.log('Obteniendo datos del estudiante con ID:', id);
        
        // 1. Obtener los datos del estudiante
        const studentResponse = await api.get(`/api/students/${id}`, getAuthConfig());
        console.log('Respuesta del servidor (estudiante):', studentResponse);
        
        // Extraer los datos del estudiante de la respuesta
        const studentData = studentResponse.data?.data || studentResponse.data;
        console.log('Datos del estudiante extraídos:', studentData);
        
        if (!studentData) {
          throw new Error('No se encontraron datos del estudiante');
        }
        
        // 2. Obtener los docentes asignados a este estudiante
        let mainTeacher = null;
        try {
          const teachersResponse = await api.get(`/api/students/${id}/teachers`, getAuthConfig());
          console.log('Docentes asignados al estudiante (respuesta cruda):', teachersResponse);
          
          // Asegurarse de que los datos vienen en el formato esperado
          const responseData = teachersResponse.data;
          const assignedTeachers = responseData.success && Array.isArray(responseData.data) ? 
            responseData.data : 
            (Array.isArray(responseData) ? responseData : []);
          
          console.log('Docentes asignados procesados:', assignedTeachers);
          
          // Tomar el primer docente como principal (si existe)
          mainTeacher = assignedTeachers.length > 0 ? assignedTeachers[0] : null;
          console.log('Docente principal encontrado:', mainTeacher);
          
          // Si hay un docente principal, cargar la lista de docentes con énfasis en él
          if (mainTeacher) {
            console.log('Cargando lista de docentes con el docente principal...');
            await fetchTeachers(mainTeacher.id);
          } else {
            console.log('No hay docente asignado, cargando lista completa de docentes...');
            await fetchTeachers();
          }
        } catch (teacherError) {
          console.warn('Error al cargar docentes asignados:', teacherError);
          // Si hay un error, cargar la lista de docentes de todos modos
          await fetchTeachers();
        }
        
        // 3. Establecer los datos del formulario
        const formDataToSet = {
          name: studentData.user_name || studentData.name || '',
          phone: studentData.user_phone || studentData.phone || '',
          email: studentData.user_email || studentData.email || '',
          contact_email: studentData.contact_email || '',
          contact_phone: studentData.contact_phone || '',
          age: studentData.age || '',
          grade: studentData.grade || '',
          course_id: studentData.course_id ? String(studentData.course_id) : '',
          teacher_id: mainTeacher ? String(mainTeacher.id) : ''
        };
        
        console.log('Datos del formulario a establecer:', formDataToSet);
        setFormData(formDataToSet);
        
      } catch (error) {
        console.error('Error al cargar datos del estudiante:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar la información del estudiante. Por favor, intente nuevamente.'
        });
        throw error; // Relanzar el error para manejarlo en loadData
      }
    };

    const loadData = async () => {
      try {
        setLoading(true);
        
        // 1. Cargar cursos
        await fetchCourses();
        
        // 2. Cargar datos del estudiante (que también cargará los docentes)
        await fetchStudentData();
        
      } catch (error) {
        console.error('Error al cargar datos:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los datos. Por favor, intente nuevamente.'
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

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

      if (!id) {
        // CREAR: Enviar todos los datos a la ruta de creación de estudiantes
        const response = await api.post('/api/students', formData, getAuthConfig());
        console.log("Respuesta de creación:", response.data);

        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Estudiante creado correctamente'
        });

        navigate('/estudiantes');
      } else {
        // ACTUALIZAR: La lógica de actualización ya es correcta.
        const response = await api.put(`/api/students/${id}`, formData, getAuthConfig());
        console.log("Respuesta de actualización:", response.data);

        Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: 'Estudiante actualizado correctamente'
        });

        navigate('/estudiantes');
      }
    } catch (error) {
      console.error('Error completo:', error);

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Hubo un problema al guardar los datos'
      });
    }
  };



  if (loading) {
    return (
      <div className="d-flex justify-content-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

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
                <select
                  id="teacher_id"
                  name="teacher_id"
                  className="form-select"
                  value={formData.teacher_id || ''}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                >
                  <option value="">Seleccione un docente</option>
                  {teachers.length > 0 ? (
                    teachers.map((teacher) => {
                      const teacherId = teacher.id || teacher.user_id; // Manejar ambos formatos de ID
                      const isSelected = formData.teacher_id === teacherId?.toString();
                      const displayName = teacher.name || `Docente #${teacherId}`;
                      
                      return (
                        <option 
                          key={teacherId}
                          value={teacherId}
                          className={isSelected ? 'fw-bold' : ''}
                        >
                          {isSelected ? '(Asignado) ' : ''}
                          {displayName}
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
                      No se ha seleccionado un docente
                    </span>
                  )}
                </div>
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
                  onClick={() => navigate(`/estudiantes/editar/${id}`)}
                >
                  Editar
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentForm;
