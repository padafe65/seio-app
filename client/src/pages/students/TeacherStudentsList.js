// src/pages/students/TeacherStudentsList.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, Edit, Eye, Search, UserPlus, Users, BookOpen } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const TeacherStudentsList = () => {
  const { user, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [teacherId, setTeacherId] = useState(null);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    course: '',
    grade: ''
  });
  
  useEffect(() => {
    const fetchStudents = async () => {
      // Esperar a que la autenticación esté lista
      if (!isAuthReady) {
        console.log('🔄 Esperando a que la autenticación esté lista...');
        return;
      }

      // Verificar si el usuario está autenticado
      if (!user) {
        console.log('🔴 Usuario no autenticado');
        setError('Por favor inicia sesión para ver los estudiantes');
        setLoading(false);
        navigate('/login');
        return;
      }
      
      // Verificar si el usuario es docente
      if (user.role !== 'docente') {
        console.log(`🔴 El usuario no es un docente (rol: ${user.role})`);
        setError('Solo los docentes pueden ver esta sección');
        setLoading(false);
        navigate('/dashboard');
        return;
      }
      
      // Obtener el teacher_id si no está disponible en el objeto user
      let tid = user.teacher_id;
      
      if (!tid) {
        console.warn('⚠️ No se encontró teacher_id en el objeto user, intentando obtenerlo del backend...');
        try {
          const teacherResponse = await axiosClient.get(`/teachers/by-user/${user.id}`);
          
          // El endpoint devuelve { success: true, data: { id: ... } }
          if (teacherResponse.data && teacherResponse.data.success && teacherResponse.data.data && teacherResponse.data.data.id) {
            tid = teacherResponse.data.data.id;
            console.log(`✅ Teacher ID obtenido del backend: ${tid}`);
          } else {
            console.error('❌ Formato de respuesta inesperado:', teacherResponse.data);
            throw new Error('No se pudo obtener el ID del docente');
          }
        } catch (error) {
          console.error('❌ Error al obtener el ID del docente:', error);
          if (error.response) {
            console.error('📌 Detalles del error:', {
              status: error.response.status,
              data: error.response.data
            });
          }
          setError('No se pudo cargar la información del docente. Por favor, cierre sesión y vuelva a iniciar.');
          setLoading(false);
          return;
        }
      }
      
      setTeacherId(tid);
      
        console.log(`🔍 Usuario docente autenticado:`, {
        userId: user.id,
        teacherId: tid,
        role: user.role
      });
      
      try {
        setLoading(true);
        setError(null);
        
        console.log(`🔍 Solicitando estudiantes para el docente ID: ${tid}`);
        const response = await axiosClient.get(`/students/teacher/${tid}`);
        
        // Cargar cursos del docente
        const coursesResponse = await axiosClient.get(`/teacher-courses/teacher/${tid}`);
        if (coursesResponse.data && Array.isArray(coursesResponse.data)) {
          setCourses(coursesResponse.data);
        }
        
        console.log('📊 Respuesta del servidor:', response.data);
        
        if (response.data && response.data.success) {
          // Eliminar duplicados basados en el ID del estudiante
          const uniqueStudents = response.data.data.reduce((acc, current) => {
            const exists = acc.some(item => item.id === current.id);
            return exists ? acc : [...acc, current];
          }, []);
          
          setStudents(uniqueStudents);
          console.log(`✅ Se cargaron ${uniqueStudents.length} estudiantes únicos`);
        } else {
          throw new Error('Formato de respuesta inesperado del servidor');
        }
        
        // Cargar estudiantes sin profesor asignado
        fetchUnassignedStudents(tid);
        
      } catch (error) {
        console.error('❌ Error al cargar estudiantes:', error);
        
        let errorMessage = 'Error al cargar los estudiantes. Por favor intenta de nuevo más tarde.';
        
        if (error.response) {
          if (error.response.status === 401) {
            errorMessage = 'Sesión expirada. Por favor inicia sesión nuevamente.';
            navigate('/login');
          } else if (error.response.status === 403) {
            errorMessage = 'No tienes permiso para ver estos estudiantes';
          } else if (error.response.status === 404) {
            errorMessage = 'No se encontraron estudiantes asignados';
          }
          
          console.error('📌 Detalles del error:', {
            status: error.response.status,
            data: error.response.data
          });
        } else if (error.request) {
          console.error('🔌 No se pudo conectar con el servidor');
          errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
        }
        
        setError(errorMessage);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStudents();
  }, [user, isAuthReady, navigate]);
  
  // Función para cargar estudiantes sin profesor asignado
  const fetchUnassignedStudents = async (tid) => {
    if (!tid) return;
    
    try {
      setLoadingUnassigned(true);
      const response = await axiosClient.get('/students/unassigned');
      
      if (response.data && response.data.success) {
        setUnassignedStudents(response.data.data || []);
        console.log(`✅ Se cargaron ${response.data.data?.length || 0} estudiantes sin profesor`);
      }
    } catch (error) {
      console.error('❌ Error al cargar estudiantes sin profesor:', error);
    } finally {
      setLoadingUnassigned(false);
    }
  };
  
  // Función para asignar estudiante individual
  const handleAssignStudent = async (studentId) => {
    if (!teacherId) {
      Swal.fire('Error', 'No se pudo obtener el ID del docente', 'error');
      return;
    }
    
    const result = await Swal.fire({
      title: '¿Asignar estudiante?',
      text: 'Este estudiante será asignado a tu lista de estudiantes.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, asignar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await axiosClient.post('/teacher/assign-student', {
          teacher_id: teacherId,
          student_id: studentId
        });
        
        Swal.fire('Éxito', 'Estudiante asignado correctamente', 'success');
        
        // Recargar listas
        if (teacherId) {
          const response = await axiosClient.get(`/students/teacher/${teacherId}`);
          if (response.data && response.data.success) {
            setStudents(response.data.data || []);
          }
          fetchUnassignedStudents(teacherId);
        }
      } catch (error) {
        console.error('Error al asignar estudiante:', error);
        Swal.fire('Error', error.response?.data?.message || 'Error al asignar estudiante', 'error');
      }
    }
  };
  
  // Función para asignar curso completo
  const handleAssignCourse = async (courseId) => {
    if (!teacherId) {
      Swal.fire('Error', 'No se pudo obtener el ID del docente', 'error');
      return;
    }
    
    const course = courses.find(c => c.course_id === courseId || c.id === courseId);
    const courseName = course ? course.course_name : `Curso ID: ${courseId}`;
    
    const result = await Swal.fire({
      title: '¿Asignar curso completo?',
      html: `Se asignarán todos los estudiantes sin profesor del curso <strong>${courseName}</strong> a tu lista.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, asignar curso',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        const response = await axiosClient.post('/teacher/assign-course-students', {
          teacher_id: teacherId,
          course_id: courseId
        });
        
        if (response.data && response.data.success) {
          Swal.fire(
            'Éxito', 
            `Se asignaron ${response.data.assigned} estudiantes del curso correctamente`,
            'success'
          );
          
          // Recargar listas
          if (teacherId) {
            const studentsResponse = await axiosClient.get(`/students/teacher/${teacherId}`);
            if (studentsResponse.data && studentsResponse.data.success) {
              setStudents(studentsResponse.data.data || []);
            }
            fetchUnassignedStudents(teacherId);
          }
        }
      } catch (error) {
        console.error('Error al asignar curso:', error);
        Swal.fire('Error', error.response?.data?.message || 'Error al asignar curso', 'error');
      }
    }
  };
  
  const filteredStudents = students.filter(student => {
    // Filtro general (búsqueda rápida)
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      (student.name || '').toLowerCase().includes(searchLower) ||
      (student.email || '').toLowerCase().includes(searchLower) ||
      (student.grade || '').toString().includes(searchTerm) ||
      (student.course_name || '').toLowerCase().includes(searchLower)
    );

    // Filtros específicos
    const matchesName = !filters.name || (student.name || '').toLowerCase().includes(filters.name.toLowerCase());
    const matchesEmail = !filters.email || (student.email || '').toLowerCase().includes(filters.email.toLowerCase());
    const matchesCourse = !filters.course || (student.course_name || '').toLowerCase().includes(filters.course.toLowerCase());
    const matchesGrade = !filters.grade || (student.grade || '').toString() === filters.grade || (student.grade || '').toString().includes(filters.grade);

    return matchesSearch && matchesName && matchesEmail && matchesCourse && matchesGrade;
  });

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ name: '', email: '', course: '', grade: '' });
  };
  
  // Mostrar estado de carga
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="h5">Cargando estudiantes...</p>
        </div>
      </div>
    );
  }

  // Mostrar mensaje de error si hay alguno
  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">¡Error!</h4>
          <p>{error}</p>
          <hr />
          <p className="mb-0">
            Si el problema persiste, por favor contacta al administrador del sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Mis Estudiantes</h2>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-info d-flex align-items-center"
            onClick={() => setShowUnassigned(!showUnassigned)}
          >
            <Users size={18} className="me-2" />
            {showUnassigned ? 'Ocultar' : 'Ver'} Sin Asignar ({unassignedStudents.length})
          </button>
          <Link to="/registro" className="btn btn-primary d-flex align-items-center">
            <PlusCircle size={18} className="me-2" /> Nuevo Estudiante
          </Link>
        </div>
      </div>
      
      {/* Sección de estudiantes sin profesor asignado */}
      {showUnassigned && (
        <div className="card shadow-sm mb-4 border-warning">
          <div className="card-header bg-warning text-dark">
            <h5 className="mb-0 d-flex align-items-center">
              <UserPlus size={20} className="me-2" />
              Estudiantes Sin Profesor Asignado
            </h5>
          </div>
          <div className="card-body">
            {loadingUnassigned ? (
              <div className="text-center py-3">
                <div className="spinner-border text-warning" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
              </div>
            ) : unassignedStudents.length > 0 ? (
              <>
                <div className="mb-3">
                  <p className="text-muted mb-2">
                    Estos estudiantes se registraron pero no encontraron su profesor en la lista. Puedes asignarlos individualmente o asignar todo un curso.
                  </p>
                  {courses.length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <span className="text-muted small">Asignar curso completo:</span>
                      {courses.map(course => (
                        <button
                          key={course.course_id || course.id}
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleAssignCourse(course.course_id || course.id)}
                          title={`Asignar todos los estudiantes del curso ${course.course_name}`}
                        >
                          <BookOpen size={14} className="me-1" />
                          {course.course_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead className="table-warning">
                      <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Grado</th>
                        <th>Curso</th>
                        <th>Institución</th>
                        <th className="text-end">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unassignedStudents.map((student) => (
                        <tr key={`unassigned-${student.id}`}>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="me-2">
                                <div className="avatar-sm bg-light rounded-circle d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                                  <span className="fw-medium text-uppercase">
                                    {student.name ? student.name.charAt(0) : 'U'}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="fw-medium">{student.name || 'Sin nombre'}</div>
                                <small className="text-muted">{student.email}</small>
                              </div>
                            </div>
                          </td>
                          <td>{student.email || '-'}</td>
                          <td>{student.grade ? `${student.grade}°` : '-'}</td>
                          <td>{student.course_name || '-'}</td>
                          <td>{student.institution || '-'}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleAssignStudent(student.id)}
                              title="Asignar a mi lista"
                            >
                              <UserPlus size={16} className="me-1" />
                              Asignar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted mb-0">
                  <Users size={48} className="mb-3 text-muted" />
                  <br />
                  No hay estudiantes sin profesor asignado en este momento.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-12">
              <div className="input-group mb-3">
                <span className="input-group-text bg-white">
                  <Search size={18} className="text-muted" />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Búsqueda rápida (nombre, email, curso, grado)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <label className="form-label small text-muted">Filtrar por Nombre</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Nombre del estudiante"
                value={filters.name}
                onChange={(e) => handleFilterChange('name', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted">Filtrar por Email</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Email del estudiante"
                value={filters.email}
                onChange={(e) => handleFilterChange('email', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted">Filtrar por Curso</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Nombre del curso"
                value={filters.course}
                onChange={(e) => handleFilterChange('course', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted">Filtrar por Grado</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Ej: 1, 2, 3..."
                value={filters.grade}
                onChange={(e) => handleFilterChange('grade', e.target.value)}
              />
            </div>
          </div>
          
          {(searchTerm || Object.values(filters).some(f => f)) && (
            <div className="mb-3">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={clearFilters}
              >
                Limpiar Filtros
              </button>
            </div>
          )}
          
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Contacto</th>
                  <th>Grado</th>
                  <th>Curso</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <tr key={`student-${student.id}`}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="me-2">
                            <div className="avatar-sm bg-light rounded-circle d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                              <span className="fw-medium text-uppercase">
                                {student.name ? student.name.charAt(0) : 'U'}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="fw-medium">{student.name || 'Sin nombre'}</div>
                            <small className="text-muted">{student.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>{student.email || '-'}</td>
                      <td>{student.phone || '-'}</td>
                      <td>
                        <div className="small">
                          <div>{student.contact_phone || 'Sin teléfono'}</div>
                          <div className="text-muted">{student.contact_email || 'Sin email'}</div>
                        </div>
                      </td>
                      <td>{student.grade ? `${student.grade}°` : '-'}</td>
                      <td>{student.course_name || '-'}</td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <Link 
                            to={`/estudiantes/${student.id}`} 
                            className="btn btn-outline-primary" 
                            title="Ver detalles"
                          >
                            <Eye size={16} />
                          </Link>
                          <Link 
                            to={`/estudiantes/${student.id}/editar`} 
                            className="btn btn-outline-secondary" 
                            title="Editar"
                          >
                            <Edit size={16} />
                          </Link>
                          <Link 
                            to={`/estudiantes/${student.id}/calificaciones`} 
                            className="btn btn-outline-success" 
                            title="Ver calificaciones"
                          >
                            <span className="d-none d-md-inline">Calificaciones</span>
                            <span className="d-inline d-md-none">Notas</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="text-muted">
                        <Search size={48} className="mb-3" />
                        <h5>No se encontraron estudiantes</h5>
                        <p className="mb-0">
                          {searchTerm 
                            ? 'No hay coincidencias con tu búsqueda.' 
                            : 'Aún no hay estudiantes registrados.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {filteredStudents.length > 0 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div className="text-muted small">
                Mostrando {filteredStudents.length} de {students.length} estudiantes
              </div>
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                Volver arriba
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherStudentsList;
