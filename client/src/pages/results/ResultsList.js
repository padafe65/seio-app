// pages/results/ResultList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Search, FileText, Filter } from 'lucide-react';
import axios from 'axios';
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
      try {
        let url = `${API_URL}/api/evaluation-results`;
        
        // Si es estudiante, filtrar solo sus resultados
        if (user && user.role === 'estudiante') {
          // Obtener el student_id asociado con el user_id
          const studentResponse = await axios.get(`${API_URL}/api/students/by-user/${user.id}`);
          if (studentResponse.data && studentResponse.data.id) {
            url = `${API_URL}/api/evaluation-results/student/${studentResponse.data.id}`;
          }
        }
        // Si es docente y ha seleccionado un curso, filtrar por curso
        else if (user && user.role === 'docente' && selectedCourse) {
          url = `${API_URL}/api/evaluation-results/course/${selectedCourse}`;
        }
        
        const response = await axios.get(url);
        
        // Obtener detalles de los intentos para cada resultado
        const resultsWithDetails = await Promise.all(
          response.data.map(async (result) => {
            try {
              // Obtener detalles del intento seleccionado
              const attemptResponse = await axios.get(
                `${API_URL}/api/quiz-attempts/${result.selected_attempt_id}`
              );
              
              // Obtener detalles del cuestionario
              let questionnaireData = null;
              if (attemptResponse.data && attemptResponse.data.questionnaire_id) {
                const questionnaireResponse = await axios.get(
                  `${API_URL}/api/questionnaires/${attemptResponse.data.questionnaire_id}`
                );
                questionnaireData = questionnaireResponse.data.questionnaire || questionnaireResponse.data;
              }
              
              // Obtener detalles del estudiante
              let studentData = null;
              if (attemptResponse.data && attemptResponse.data.student_id) {
                const studentResponse = await axios.get(
                  `${API_URL}/api/students/${attemptResponse.data.student_id}`
                );
                studentData = studentResponse.data;
              }
              
              return {
                ...result,
                attempt: attemptResponse.data,
                questionnaire: questionnaireData,
                student: studentData
              };
            } catch (err) {
              console.error('Error al obtener detalles:', err);
              return result;
            }
          })
        );
        
        setResults(resultsWithDetails);
        
        // Extraer fases únicas de los resultados
        const uniquePhases = [...new Set(resultsWithDetails.map(r => r.attempt?.phase).filter(Boolean))];
        setPhases(uniquePhases.sort((a, b) => a - b));
        
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar resultados:', error);
        setError('No se pudieron cargar los resultados. Por favor, intenta de nuevo.');
        setLoading(false);
      }
    };
    
    const fetchCourses = async () => {
      try {
        // Si es docente, obtener solo sus cursos asignados
        let url = `${API_URL}/api/courses`;
        if (user && user.role === 'docente') {
          // Obtener el teacher_id asociado con el user_id
          const teacherResponse = await axios.get(`${API_URL}/api/teachers/by-user/${user.id}`);
          if (teacherResponse.data && teacherResponse.data.id) {
            url = `${API_URL}/api/teachers/${teacherResponse.data.id}/courses`;
          }
        }
        
        const response = await axios.get(url);
        setCourses(response.data);
      } catch (error) {
        console.error('Error al cargar cursos:', error);
      }
    };
    
    fetchResults();
    fetchCourses();
  }, [user, selectedCourse, selectedPhase]);
  
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
                      <th>Curso</th> {/* Nueva columna */}
                      <th>Fase</th>
                      <th>Mejor Puntaje</th>
                      <th>Fecha</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                {filteredResults.length > 0 ? (
                  filteredResults.map((result) => (
                    <tr key={result.id}>
                      <td>{result.student?.name || 'N/A'}</td>
                      <td>{result.questionnaire?.title || 'N/A'}</td>
                      <td>{result.student?.course_name || 'N/A'}</td> {/* Nueva celda */}
                      <td>{result.attempt?.phase || 'N/A'}</td>
                      <td>
                        <span className={`badge ${parseFloat(result.best_score) >= 3.5 ? 'bg-success' : 'bg-danger'}`}>
                          {formatScore(result.best_score)}
                        </span>
                      </td>
                      <td>{formatDate(result.recorded_at)}</td>
                      <td className="text-end">
                        <div className="btn-group">
                          <Link 
                            to={`/resultados/${result.id}`} 
                            className="btn btn-sm btn-outline-info"
                          >
                            <Eye size={16} className="me-1" /> Ver Detalles
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-3">
                      No se encontraron resultados
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

export default ResultList;
