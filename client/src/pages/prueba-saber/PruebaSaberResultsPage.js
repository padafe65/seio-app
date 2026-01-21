// pages/prueba-saber/PruebaSaberResultsPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { GraduationCap, Filter, Eye, Download, Users } from 'lucide-react';

const PruebaSaberResultsPage = () => {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    level: '',
    student_id: '',
    course_id: '',
    institution: ''
  });

  useEffect(() => {
    fetchResults();
  }, [filters]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.level) params.append('level', filters.level);
      if (filters.student_id) params.append('student_id', filters.student_id);
      if (filters.course_id) params.append('course_id', filters.course_id);
      if (filters.institution) params.append('institution', filters.institution);
      
      const response = await axiosClient.get(`/prueba-saber/results?${params.toString()}`);
      setResults(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar resultados Prueba Saber:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los resultados de Prueba Saber'
      });
    } finally {
      setLoading(false);
    }
  };

  // Agrupar resultados por nivel
  const resultsByLevel = results.reduce((acc, result) => {
    const level = result.prueba_saber_level || 'Sin nivel';
    if (!acc[level]) acc[level] = [];
    acc[level].push(result);
    return acc;
  }, {});

  const levels = [3, 5, 9, 11];

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="mb-4">
        <h2 className="mb-3">
          <GraduationCap className="me-2" size={28} />
          Resultados de Prueba Saber
        </h2>
        <p className="text-muted">
          Consulta los resultados de las Pruebas Saber aplicadas
        </p>
      </div>

      {/* Filtros */}
      {(user?.role === 'docente' || user?.role === 'administrador' || user?.role === 'super_administrador') && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">
              <Filter size={18} className="me-2" />
              Filtros
            </h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Nivel de Prueba Saber</label>
                <select
                  className="form-select"
                  value={filters.level}
                  onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                >
                  <option value="">Todos los niveles</option>
                  <option value="3">Grado 3°</option>
                  <option value="5">Grado 5°</option>
                  <option value="9">Grado 9°</option>
                  <option value="11">Grado 11°</option>
                </select>
              </div>
              {(user?.role === 'administrador' || user?.role === 'super_administrador') && (
                <div className="col-md-3">
                  <label className="form-label">Institución</label>
                  <input
                    type="text"
                    className="form-control"
                    value={filters.institution}
                    onChange={(e) => setFilters({ ...filters, institution: e.target.value })}
                    placeholder="Filtrar por institución"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title">Total Resultados</h5>
              <h3 className="text-primary">{results.length}</h3>
            </div>
          </div>
        </div>
        {levels.map(level => {
          const count = results.filter(r => r.prueba_saber_level === level).length;
          const avgScore = results.filter(r => r.prueba_saber_level === level)
            .reduce((sum, r) => sum + parseFloat(r.best_score || 0), 0) / count || 0;
          
          return (
            <div key={level} className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Grado {level}°</h5>
                  <h3 className="text-info">{count}</h3>
                  {count > 0 && (
                    <small className="text-muted">Promedio: {avgScore.toFixed(2)}</small>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista de resultados agrupados por nivel */}
      {results.length === 0 ? (
        <div className="alert alert-info">
          <h5>No hay resultados de Prueba Saber aún</h5>
          <p>Los resultados aparecerán aquí una vez que los estudiantes presenten las Pruebas Saber.</p>
        </div>
      ) : (
        <div>
          {levels.map(level => {
            const levelResults = resultsByLevel[level] || [];
            if (levelResults.length === 0 && filters.level) return null;
            
            return (
              <div key={level} className="card mb-4">
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">
                    <GraduationCap size={18} className="me-2" />
                    Grado {level}° - {levelResults.length} resultado{levelResults.length !== 1 ? 's' : ''}
                  </h5>
                </div>
                <div className="card-body">
                  {levelResults.length === 0 ? (
                    <p className="text-muted">No hay resultados para este nivel</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Estudiante</th>
                            <th>Cuestionario</th>
                            <th>Materia</th>
                            <th>Curso</th>
                            <th>Mejor Nota</th>
                            <th>Intentos</th>
                            <th>Fecha</th>
                            {(user?.role === 'docente' || user?.role === 'administrador' || user?.role === 'super_administrador') && (
                              <th>Acciones</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {levelResults.map((result) => (
                            <tr key={result.id}>
                              <td>
                                <strong>{result.student_name}</strong>
                                <br />
                                <small className="text-muted">Grado {result.student_grade}°</small>
                              </td>
                              <td>
                                <small>{result.questionnaire_title}</small>
                              </td>
                              <td>
                                <span className="badge bg-secondary">{result.subject || 'N/A'}</span>
                              </td>
                              <td>
                                <small>{result.course_name || 'N/A'}</small>
                              </td>
                              <td>
                                <strong className={`text-${parseFloat(result.best_score) >= 3.5 ? 'success' : 'danger'}`}>
                                  {parseFloat(result.best_score).toFixed(2)} / 5.0
                                </strong>
                              </td>
                              <td>
                                <span className="badge bg-info">
                                  {result.total_attempts || result.attempts?.length || 0} / 2
                                </span>
                                {result.attempts && result.attempts.length > 0 && (
                                  <div className="mt-1">
                                    {result.attempts.map((attempt, idx) => (
                                      <small key={attempt.id} className="d-block text-muted">
                                        Intento {attempt.attempt_number}: {parseFloat(attempt.score).toFixed(2)}
                                      </small>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td>
                                <small>
                                  {new Date(result.recorded_at).toLocaleDateString()}
                                </small>
                              </td>
                              {(user?.role === 'docente' || user?.role === 'administrador' || user?.role === 'super_administrador') && (
                                <td>
                                  <button
                                    className="btn btn-sm btn-outline-info"
                                    onClick={() => {
                                      Swal.fire({
                                        title: `Resultado: ${result.questionnaire_title}`,
                                        html: `
                                          <div class="text-start">
                                            <p><strong>Estudiante:</strong> ${result.student_name}</p>
                                            <p><strong>Grado:</strong> ${result.student_grade}°</p>
                                            <p><strong>Curso:</strong> ${result.course_name || 'N/A'}</p>
                                            <p><strong>Mejor Nota:</strong> ${parseFloat(result.best_score).toFixed(2)} / 5.0</p>
                                            <p><strong>Intentos:</strong> ${result.total_attempts || result.attempts?.length || 0} / 2</p>
                                            <hr />
                                            ${result.attempts && result.attempts.length > 0 ? `
                                              <h6>Detalle de Intentos:</h6>
                                              ${result.attempts.map((attempt, idx) => `
                                                <p>
                                                  <strong>Intento ${attempt.attempt_number}:</strong> 
                                                  ${parseFloat(attempt.score).toFixed(2)} / 5.0 
                                                  <small class="text-muted">(${new Date(attempt.created_at).toLocaleDateString()})</small>
                                                </p>
                                              `).join('')}
                                            ` : '<p>Sin intentos registrados</p>'}
                                          </div>
                                        `,
                                        icon: 'info',
                                        confirmButtonText: 'Cerrar'
                                      });
                                    }}
                                    title="Ver detalles"
                                  >
                                    <Eye size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PruebaSaberResultsPage;
