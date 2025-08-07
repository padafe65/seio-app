// pages/results/ResultList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Search, FileText, Filter } from 'lucide-react';
import api from '../../config/axios';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ResultList = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [phases, setPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState('');
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchResults = async () => {
      console.log('🔍 Iniciando fetchResults');
      if (!user) {
        console.log('⚠️ No hay usuario autenticado');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        let url;
        const params = new URLSearchParams();
        console.log('👤 Rol del usuario:', user.role);
        console.log('🆔 ID del profesor (si aplica):', user.teacher_id);

        if (user.role === 'docente' && user.teacher_id) {
          url = `${API_URL}/api/evaluation-results`;
          params.append('teacherId', user.teacher_id);
          if (selectedCourse) {
            params.append('courseId', selectedCourse);
            console.log('📌 Curso seleccionado:', selectedCourse);
          }
          url += `?${params.toString()}`;
          console.log('🌐 URL de la API (docente):', url);
        } else if (user.role === 'estudiante') {
          console.log('👨‍🎓 Usuario es estudiante, obteniendo ID de estudiante...');
          const studentResponse = await api.get(`/api/students/by-user/${user.id}`);
          console.log('📋 Respuesta de /api/students/by-user:', studentResponse);
          
          if (studentResponse.data && studentResponse.data.id) {
            url = `${API_URL}/api/evaluation-results/student/${studentResponse.data.id}`;
            console.log('🌐 URL de la API (estudiante):', url);
          } else {
            console.warn('⚠️ No se pudo obtener el ID del estudiante');
            setResults([]);
            setLoading(false);
            return;
          }
        } else {
          console.warn('⚠️ Usuario sin rol válido o sin ID de profesor');
          setResults([]);
          setLoading(false);
          return;
        }

        console.log('🔄 Realizando petición a:', url);
        const response = await api.get(url);
        console.log('✅ Respuesta de la API:', response);
        
        // Mapear los resultados para que coincidan con la estructura que espera el componente
        const resultsWithDetails = response.data.map(result => ({
          ...result,
          student: { name: result.student_name, course_name: result.course_name },
          questionnaire: { title: result.questionnaire_title },
          attempt: { phase: result.phase }
        }));

        setResults(resultsWithDetails);
        
        const uniquePhases = [...new Set(response.data.map(r => r.phase).filter(Boolean))];
        setPhases(uniquePhases.sort((a, b) => a - b));
        
      } catch (error) {
        console.error('Error al cargar resultados:', error);
        setError('No se pudieron cargar los resultados. Por favor, intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    const fetchCourses = async () => {
      console.log('🔍 Iniciando fetchCourses');
      if (!user) {
        console.log('⚠️ No hay usuario autenticado');
        return;
      }
      if (user.role !== 'docente') {
        console.log('⚠️ El usuario no es un docente, no se cargarán cursos');
        return;
      }
      
      try {
        console.log('👨‍🏫 Obteniendo ID del docente para el usuario:', user.id);
        const teacherResponse = await api.get(`/api/teachers/by-user/${user.id}`);
        console.log('📋 Respuesta de /api/teachers/by-user:', teacherResponse);
        
        if (teacherResponse.data && teacherResponse.data.id) {
          const teacherId = teacherResponse.data.id;
          console.log('📚 Obteniendo cursos para el docente ID:', teacherId);
          const url = `/api/teacher-courses/teacher/${teacherId}`;
          console.log('🌐 URL de la API de cursos:', url);
          
          try {
            const response = await api.get(url);
            console.log('✅ Cursos obtenidos:', response.data);
            setCourses(response.data);
          } catch (error) {
            console.error('❌ Error al obtener cursos:', error);
            // Intentar con la ruta alternativa
            const altUrl = `/api/teacher-courses?teacherId=${teacherId}`;
            console.log('🔄 Intentando con ruta alternativa:', altUrl);
            try {
              const altResponse = await api.get(altUrl);
              console.log('✅ Cursos obtenidos (ruta alternativa):', altResponse.data);
              setCourses(altResponse.data);
            } catch (altError) {
              console.error('❌ Error en ruta alternativa:', altError);
              throw altError; // Relanzar el error para que lo maneje el catch externo
            }
          }
        } else {
          console.warn('⚠️ No se pudo obtener el ID del docente');
        }
      } catch (error) {
        console.error('❌ Error al cargar cursos:', error);
        console.error('Detalles del error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers
          }
        });
      }
    };
    
    fetchResults();
    fetchCourses();
  }, [user, selectedCourse]);
  
  // Filtrar resultados por término de búsqueda y fase
  const filteredResults = results.filter(result => {
    const matchesSearch = 
      result.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.questionnaire?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(result.best_score)?.includes(searchTerm);
    
    const matchesPhase = !selectedPhase || String(result.attempt?.phase) === String(selectedPhase);
    
    return matchesSearch && matchesPhase;
  });
  
  // Función para formatear la fecha
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Función para formatear el puntaje de manera segura
  const formatScore = (score) => {
    try {
      const numScore = parseFloat(score);
      return !isNaN(numScore) ? numScore.toFixed(2) : 'N/A';
    } catch (error) {
      return 'N/A';
    }
  };
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Resultados de Evaluaciones</h4>
        {user && user.role === 'docente' && (
          <Link to="/reportes" className="btn btn-primary d-flex align-items-center">
            <FileText size={18} className="me-2" /> Generar Reportes
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
          <div className="row mb-3">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar por estudiante o cuestionario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="col-md-3">
              {user && user.role === 'docente' && (
                <div className="input-group">
                  <span className="input-group-text">
                    <Filter size={18} />
                  </span>
                  <select 
                    className="form-select"
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                  >
                    <option value="">Todos los cursos</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="col-md-3">
              <div className="input-group">
                <span className="input-group-text">
                  <Filter size={18} />
                </span>
                <select 
                  className="form-select"
                  value={selectedPhase}
                  onChange={(e) => setSelectedPhase(e.target.value)}
                >
                  <option value="">Todas las fases</option>
                  {phases.map(phase => (
                    <option key={phase} value={phase}>
                      Fase {phase}
                    </option>
                  ))}
                </select>
              </div>
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
                    <th>Estudiante</th>
                    <th>Cuestionario</th>
                    <th>Curso</th>
                    <th>Fase</th>
                    <th>Mejor Puntaje</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length > 0 ? filteredResults.map((result) => (
                    <tr key={result.id}>
                      <td>{result.student?.name || 'N/A'}</td>
                      <td>{result.questionnaire?.title || 'N/A'}</td>
                      <td>{result.student?.course_name || 'N/A'}</td>
                      <td>{result.attempt?.phase || 'N/A'}</td>
                      <td>
                        <span className={`badge ${parseFloat(result.best_score) >= 3.5 ? 'bg-success' : 'bg-danger'}`}>
                          {formatScore(result.best_score)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          result.status === 'completed' ? 'bg-success' : 
                          result.status === 'in_progress' ? 'bg-warning text-dark' : 'bg-secondary'
                        }`}>
                          {result.status === 'completed' ? 'Completado' : 
                           result.status === 'in_progress' ? 'En progreso' : 'Pendiente'}
                        </span>
                      </td>
                      <td>{formatDate(result.recorded_at)}</td>
                      <td className="text-end">
                        <div className="btn-group">
                          <Link to={`/resultados/${result.id}`} className="btn btn-sm btn-outline-info">
                            <Eye size={16} className="me-1" /> Ver Detalles
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="8" className="text-center">No se encontraron resultados que coincidan con los filtros.</td>
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

export default ResultList;
