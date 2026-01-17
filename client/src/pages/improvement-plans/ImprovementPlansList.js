// pages/improvement-plans/ImprovementPlansList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Eye, Edit, Trash2, Search, Filter, CheckCircle, XCircle } from 'lucide-react';
import axios from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';

const ImprovementPlansList = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  
  // Filtros adicionales para super_administrador
  const [filters, setFilters] = useState({
    institution: '',
    course: '',
    grade: '',
    teacher_name: '',
    student_name: '',
    activity_status: ''
  });
  
  const [institutions, setInstitutions] = useState([]);
  const [courses, setCourses] = useState([]);
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        let url;
        const params = new URLSearchParams();
        
        // Construir la URL según el rol
        if (user.role === 'docente') {
          url = `/improvement-plans/teacher/${user.id}`;
        } else if (user.role === 'estudiante') {
          url = `/improvement-plans/student/${user.id}`;
        } else {
          url = `/improvement-plans`;
          
          // Agregar filtros si es super_administrador o admin
          if ((user.role === 'super_administrador' || user.role === 'administrador') && filters) {
            Object.keys(filters).forEach(key => {
              if (filters[key]) {
                params.append(key, filters[key]);
              }
            });
          }
        }
        
        if (selectedStudent && user.role === 'docente') {
          url = `/improvement-plans/student/${selectedStudent}`;
        }
        
        // Agregar parámetros a la URL si existen
        const queryString = params.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
        
        const response = await axios.get(url);
        setPlans(Array.isArray(response.data) ? response.data : []);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar planes de mejoramiento:', error);
        setError('No se pudieron cargar los planes de mejoramiento. Por favor, intenta de nuevo.');
        setLoading(false);
      }
    };
    
    const fetchStudents = async () => {
      if (user.role === 'docente') {
        try {
          // Obtener el teacher_id asociado con el user_id
          const teacherResponse = await axios.get(`/teachers/by-user/${user.id}`);
          if (teacherResponse.data && teacherResponse.data.id) {
            const studentsResponse = await axios.get(`/teachers/${teacherResponse.data.id}/students`);
            setStudents(studentsResponse.data);
          }
        } catch (error) {
          console.error('Error al cargar estudiantes:', error);
        }
      }
    };
    
    const fetchFilterOptions = async () => {
      // Solo para super_administrador
      if (user.role === 'super_administrador' || user.role === 'administrador') {
        try {
          // Obtener instituciones únicas
          const usersResponse = await axios.get('/admin/users');
          const users = usersResponse.data.data || usersResponse.data || [];
          const uniqueInstitutions = [...new Set(users.map(u => u.institution).filter(Boolean))];
          setInstitutions(uniqueInstitutions.sort());
          
          // Obtener cursos únicos
          const coursesResponse = await axios.get('/courses');
          const allCourses = Array.isArray(coursesResponse.data) ? coursesResponse.data : [];
          const uniqueCourses = [...new Set(allCourses.map(c => c.name).filter(Boolean))];
          setCourses(uniqueCourses.sort());
        } catch (error) {
          console.error('Error al cargar opciones de filtro:', error);
        }
      }
    };
    
    fetchPlans();
    fetchStudents();
    fetchFilterOptions();
  }, [user, selectedStudent, filters]);
  
  const handleDelete = async (id) => {
    try {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede revertir",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });
      
      if (result.isConfirmed) {
        await axios.delete(`/improvement-plans/${id}`);
        setPlans(plans.filter(plan => plan.id !== id));
        
        Swal.fire(
          'Eliminado',
          'El plan de mejoramiento ha sido eliminado.',
          'success'
        );
      }
    } catch (error) {
      console.error('Error al eliminar plan:', error);
      Swal.fire(
        'Error',
        'No se pudo eliminar el plan de mejoramiento.',
        'error'
      );
    }
  };
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  const clearFilters = () => {
    setFilters({
      institution: '',
      course: '',
      grade: '',
      teacher_name: '',
      student_name: '',
      activity_status: ''
    });
    setSearchTerm('');
  };
  
  const filteredPlans = plans.filter(plan => 
    plan.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO');
  };
  
  const getStatusBadge = (plan) => {
    // Priorizar activity_status sobre completed
    if (plan.activity_status) {
      const statusConfig = {
        'pending': { label: 'Pendiente', class: 'bg-warning' },
        'in_progress': { label: 'En Progreso', class: 'bg-info' },
        'completed': { label: 'Completado', class: 'bg-success' },
        'failed': { label: 'Fallido', class: 'bg-danger' }
      };
      const config = statusConfig[plan.activity_status] || { label: plan.activity_status, class: 'bg-secondary' };
      return <span className={`badge ${config.class}`}>{config.label}</span>;
    }
    // Fallback a completed si no hay activity_status
    return plan.completed ? (
      <span className="badge bg-success">Completado</span>
    ) : (
      <span className="badge bg-warning">Pendiente</span>
    );
  };
  
  const showAdvancedFilters = user.role === 'super_administrador' || user.role === 'administrador';
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Planes de Mejoramiento</h4>
        {user.role === 'docente' && (
          <Link to="/planes-mejoramiento/nuevo" className="btn btn-primary d-flex align-items-center">
            <PlusCircle size={18} className="me-2" /> Nuevo Plan
          </Link>
        )}
      </div>
      
      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      )}
      
      <div className="card mb-4">
        <div className="card-body">
          {/* Búsqueda básica */}
          <div className="row mb-3">
            <div className={showAdvancedFilters ? "col-md-6" : "col-md-12"}>
              <div className="input-group">
                <span className="input-group-text">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar planes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {user.role === 'docente' && !showAdvancedFilters && (
              <div className="col-md-6">
                <div className="input-group">
                  <span className="input-group-text">
                    <Filter size={18} />
                  </span>
                  <select 
                    className="form-select"
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                  >
                    <option value="">Todos los estudiantes</option>
                    {students.map(student => (
                      <option key={student.user_id} value={student.user_id}>
                        {student.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
          
          {/* Filtros avanzados para super_administrador/administrador */}
          {showAdvancedFilters && (
            <>
              <div className="row mb-3">
                <div className="col-md-3">
                  <label className="form-label small text-muted">Institución</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Filtrar por institución..."
                    value={filters.institution}
                    onChange={(e) => handleFilterChange('institution', e.target.value)}
                    list="institutions-list"
                  />
                  <datalist id="institutions-list">
                    {institutions.map((inst, idx) => (
                      <option key={idx} value={inst} />
                    ))}
                  </datalist>
                </div>
                
                <div className="col-md-3">
                  <label className="form-label small text-muted">Curso</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Filtrar por curso..."
                    value={filters.course}
                    onChange={(e) => handleFilterChange('course', e.target.value)}
                    list="courses-list"
                  />
                  <datalist id="courses-list">
                    {courses.map((course, idx) => (
                      <option key={idx} value={course} />
                    ))}
                  </datalist>
                </div>
                
                <div className="col-md-2">
                  <label className="form-label small text-muted">Grado</label>
                  <select
                    className="form-select form-select-sm"
                    value={filters.grade}
                    onChange={(e) => handleFilterChange('grade', e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="7">7°</option>
                    <option value="8">8°</option>
                    <option value="9">9°</option>
                    <option value="10">10°</option>
                    <option value="11">11°</option>
                  </select>
                </div>
                
                <div className="col-md-2">
                  <label className="form-label small text-muted">Estado</label>
                  <select
                    className="form-select form-select-sm"
                    value={filters.activity_status}
                    onChange={(e) => handleFilterChange('activity_status', e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="pending">Pendiente</option>
                    <option value="in_progress">En Progreso</option>
                    <option value="completed">Completado</option>
                    <option value="failed">Fallido</option>
                  </select>
                </div>
                
                <div className="col-md-2">
                  <label className="form-label small text-muted">&nbsp;</label>
                  <button
                    className="btn btn-outline-secondary btn-sm w-100"
                    onClick={clearFilters}
                    title="Limpiar filtros"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
              
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label small text-muted">Docente</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Filtrar por docente..."
                    value={filters.teacher_name}
                    onChange={(e) => handleFilterChange('teacher_name', e.target.value)}
                  />
                </div>
                
                <div className="col-md-6">
                  <label className="form-label small text-muted">Estudiante</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Filtrar por estudiante..."
                    value={filters.student_name}
                    onChange={(e) => handleFilterChange('student_name', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
          
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Materia</th>
                    {user.role !== 'estudiante' && <th>Estudiante</th>}
                    {user.role !== 'docente' && <th>Docente</th>}
                    {showAdvancedFilters && (
                      <>
                        <th>Institución</th>
                        <th>Curso</th>
                        <th>Grado</th>
                      </>
                    )}
                    <th>Fecha Límite</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.length > 0 ? (
                    filteredPlans.map((plan) => (
                      <tr key={plan.id}>
                        <td>{plan.title}</td>
                        <td>{plan.subject}</td>
                        {user.role !== 'estudiante' && <td>{plan.student_name}</td>}
                        {user.role !== 'docente' && <td>{plan.teacher_name}</td>}
                        {showAdvancedFilters && (
                          <>
                            <td>{plan.institution || <span className="text-muted">-</span>}</td>
                            <td>{plan.course_name || <span className="text-muted">-</span>}</td>
                            <td>{plan.grade ? `${plan.grade}°` : <span className="text-muted">-</span>}</td>
                          </>
                        )}
                        <td>{formatDate(plan.deadline)}</td>
                        <td>{getStatusBadge(plan)}</td>
                        <td className="text-end">
                          <div className="btn-group">
                            <Link 
                              to={`/planes-mejoramiento/${plan.id}`} 
                              className="btn btn-sm btn-outline-info"
                            >
                              <Eye size={16} className="me-1" /> Ver
                            </Link>
                            {user.role === 'docente' && (
                              <>
                                <Link 
                                  to={`/planes-mejoramiento/${plan.id}/editar`} 
                                  className="btn btn-sm btn-outline-primary"
                                >
                                  <Edit size={16} className="me-1" /> Editar
                                </Link>
                                <button 
                                  onClick={() => handleDelete(plan.id)}
                                  className="btn btn-sm btn-outline-danger"
                                >
                                  <Trash2 size={16} className="me-1" /> Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={user.role === 'estudiante' ? 5 : (showAdvancedFilters ? 9 : 6)} className="text-center py-3">
                        No se encontraron planes de mejoramiento
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImprovementPlansList;
