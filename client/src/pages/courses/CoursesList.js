// pages/courses/CoursesList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Edit, Trash2, Search } from 'lucide-react';
import axios from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';

const CoursesList = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInstitution, setFilterInstitution] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [institutions, setInstitutions] = useState([]);
  
  useEffect(() => {
    if (user && user.role === 'super_administrador') {
      fetchCourses();
      fetchInstitutions();
    }
  }, [user]);
  
  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/courses');
      setCourses(Array.isArray(response.data) ? response.data : []);
      setLoading(false);
    } catch (err) {
      console.error('Error al cargar cursos:', err);
      setError('No se pudieron cargar los cursos');
      setLoading(false);
    }
  };
  
  const fetchInstitutions = async () => {
    try {
      const response = await axios.get('/admin/users');
      const users = response.data.data || response.data || [];
      const uniqueInstitutions = [...new Set(users.map(u => u.institution).filter(Boolean))];
      setInstitutions(uniqueInstitutions.sort());
    } catch (err) {
      console.error('Error al cargar instituciones:', err);
    }
  };
  
  const handleDelete = async (id, courseName) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar curso?',
      html: `¿Estás seguro de que deseas eliminar el curso <b>${courseName}</b>?<br/><br/>Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await axios.delete(`/courses/${id}`);
        await fetchCourses();
        Swal.fire({
          icon: 'success',
          title: 'Curso eliminado',
          text: 'El curso ha sido eliminado exitosamente'
        });
      } catch (err) {
        console.error('Error al eliminar curso:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.response?.data?.message || 'No se pudo eliminar el curso'
        });
      }
    }
  };
  
  const filteredCourses = courses.filter(course => {
    const matchesSearch = 
      course.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.grade?.toString().includes(searchTerm);
    
    const matchesInstitution = !filterInstitution || 
      (course.institution || '').toLowerCase().includes(filterInstitution.toLowerCase());
    
    const matchesTeacher = !filterTeacher || 
      (course.teacher_name || '').toLowerCase().includes(filterTeacher.toLowerCase());
    
    return matchesSearch && matchesInstitution && matchesTeacher;
  });
  
  if (!user || user.role !== 'super_administrador') {
    return (
      <div className="alert alert-danger">
        No tienes permisos para acceder a esta página.
      </div>
    );
  }
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Gestión de Cursos</h4>
        <Link to="/cursos/nuevo" className="btn btn-primary d-flex align-items-center">
          <PlusCircle size={18} className="me-2" /> Nuevo Curso
        </Link>
      </div>
      
      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      )}
      
      <div className="card mb-4">
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar cursos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="Filtrar por institución..."
                value={filterInstitution}
                onChange={(e) => setFilterInstitution(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="Filtrar por docente..."
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
              />
            </div>
          </div>
          
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
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Grado</th>
                    <th>Institución</th>
                    <th>Docente Principal</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.length > 0 ? (
                    filteredCourses.map((course) => (
                      <tr key={course.id}>
                        <td>{course.id}</td>
                        <td>{course.name}</td>
                        <td>{course.grade}°</td>
                        <td>{course.institution || <span className="text-muted">-</span>}</td>
                        <td>
                          {course.teacher_name ? (
                            <span className="badge bg-primary">{course.teacher_name}</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="btn-group">
                            <Link 
                              to={`/cursos/${course.id}/editar`} 
                              className="btn btn-sm btn-outline-primary"
                            >
                              <Edit size={16} className="me-1" /> Editar
                            </Link>
                            <button 
                              onClick={() => handleDelete(course.id, course.name)}
                              className="btn btn-sm btn-outline-danger"
                            >
                              <Trash2 size={16} className="me-1" /> Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center py-3">
                        No se encontraron cursos
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

export default CoursesList;
