// src/pages/students/TeacherStudentsList.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, Edit, Eye, Search } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const TeacherStudentsList = () => {
  const { user, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
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
      
      // Verificar si el docente tiene un ID válido
      if (!user.teacher_id) {
        console.error('❌ No se encontró el ID del docente en el objeto user:', user);
        setError('No se pudo cargar la información del docente. Por favor, cierre sesión y vuelva a iniciar.');
        setLoading(false);
        return;
      }
      
      console.log(`🔍 Usuario docente autenticado:`, {
        userId: user.id,
        teacherId: user.teacher_id,
        role: user.role
      });
      
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        
        console.log(`🔍 Solicitando estudiantes para el docente ID: ${user.teacher_id}`);
        const response = await axios.get(`${API_URL}/api/students/teacher/${user.teacher_id}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
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
  
  const filteredStudents = students.filter(student => 
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade?.toString().includes(searchTerm) ||
    student.course_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
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
        <Link to="/registro" className="btn btn-primary d-flex align-items-center">
          <PlusCircle size={18} className="me-2" /> Nuevo Estudiante
        </Link>
      </div>
      
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <Search size={18} className="text-muted" />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar por nombre, email o grado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          
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
