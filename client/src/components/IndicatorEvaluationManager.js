import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const IndicatorEvaluationManager = ({ questionnaireId, questionnaireTitle }) => {
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);

  const getAuthConfig = () => {
    const token = localStorage.getItem('authToken');
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/indicator-evaluation/questionnaire/${questionnaireId}/statistics`,
        getAuthConfig()
      );
      setStatistics(response.data.data);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      Swal.fire('Error', 'No se pudieron cargar las estadísticas de indicadores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const evaluateAllStudents = async () => {
    try {
      const result = await Swal.fire({
        title: '¿Evaluar indicadores?',
        text: 'Esto evaluará los indicadores de todos los estudiantes que tengan evaluación para este cuestionario.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, evaluar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        setLoading(true);
        
        const response = await axios.post(
          `${API_URL}/api/indicator-evaluation/evaluate-questionnaire/${questionnaireId}`,
          {},
          getAuthConfig()
        );

        setEvaluationResults(response.data.data);
        
        Swal.fire({
          title: '¡Evaluación completada!',
          text: `Se evaluaron los indicadores de ${response.data.data.total_students} estudiantes`,
          icon: 'success',
          timer: 3000
        });

        // Recargar estadísticas
        await loadStatistics();
      }
    } catch (error) {
      console.error('Error al evaluar indicadores:', error);
      Swal.fire('Error', 'No se pudieron evaluar los indicadores', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (questionnaireId) {
      loadStatistics();
    }
  }, [questionnaireId]);

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card mt-4">
      <div className="card-header bg-success text-white">
        <h5 className="mb-0">Evaluación de Indicadores: {questionnaireTitle}</h5>
      </div>
      <div className="card-body">
        {/* Estadísticas Generales */}
        {statistics && (
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card bg-primary text-white">
                <div className="card-body text-center">
                  <h4>{statistics.general_stats.total_students}</h4>
                  <p className="mb-0">Estudiantes Evaluados</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-info text-white">
                <div className="card-body text-center">
                  <h4>{statistics.general_stats.total_evaluations}</h4>
                  <p className="mb-0">Total Evaluaciones</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-success text-white">
                <div className="card-body text-center">
                  <h4>{statistics.general_stats.approved_count}</h4>
                  <p className="mb-0">Indicadores Aprobados</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-warning text-white">
                <div className="card-body text-center">
                  <h4>{statistics.general_stats.approval_rate}%</h4>
                  <p className="mb-0">Tasa de Aprobación</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botón de Evaluación */}
        <div className="text-center mb-4">
          <button
            className="btn btn-success btn-lg"
            onClick={evaluateAllStudents}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Evaluando...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Evaluar Indicadores de Todos los Estudiantes
              </>
            )}
          </button>
        </div>

        {/* Resultados de la Evaluación */}
        {evaluationResults && (
          <div className="alert alert-info">
            <h6><strong>Resultados de la Evaluación:</strong></h6>
            <p>Se evaluaron <strong>{evaluationResults.total_students}</strong> estudiantes.</p>
            
            {evaluationResults.results && evaluationResults.results.length > 0 && (
              <div className="mt-3">
                <h6>Resumen por Estudiante:</h6>
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Estudiante ID</th>
                        <th>Mejor Puntaje</th>
                        <th>Total Indicadores</th>
                        <th>Aprobados</th>
                        <th>Tasa de Aprobación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluationResults.results.map((result, index) => (
                        <tr key={index}>
                          <td>{result.student_id}</td>
                          <td>
                            <span className={`badge ${result.best_score >= 3.5 ? 'bg-success' : 'bg-danger'}`}>
                              {result.best_score}
                            </span>
                          </td>
                          <td>{result.total_indicators}</td>
                          <td>
                            <span className={`badge ${result.approved_indicators > 0 ? 'bg-success' : 'bg-danger'}`}>
                              {result.approved_indicators}
                            </span>
                          </td>
                          <td>{result.approval_rate.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estadísticas por Indicador */}
        {statistics && statistics.indicator_stats && statistics.indicator_stats.length > 0 && (
          <div>
            <h6 className="mt-4">Estadísticas por Indicador:</h6>
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Descripción</th>
                    <th>Materia</th>
                    <th>Total Estudiantes</th>
                    <th>Aprobados</th>
                    <th>Reprobados</th>
                    <th>Tasa de Aprobación</th>
                    <th>Nota Mínima</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.indicator_stats.map((stat, index) => (
                    <tr key={index}>
                      <td>{stat.indicator_id}</td>
                      <td>{stat.description}</td>
                      <td>{stat.subject}</td>
                      <td>{stat.total_students}</td>
                      <td>
                        <span className="badge bg-success">{stat.approved_students}</span>
                      </td>
                      <td>
                        <span className="badge bg-danger">{stat.failed_students}</span>
                      </td>
                      <td>
                        <div className="progress" style={{ height: '20px' }}>
                          <div 
                            className={`progress-bar ${stat.approval_rate >= 70 ? 'bg-success' : stat.approval_rate >= 50 ? 'bg-warning' : 'bg-danger'}`}
                            style={{ width: `${stat.approval_rate}%` }}
                          >
                            {stat.approval_rate}%
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-info">{stat.avg_passing_score}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IndicatorEvaluationManager;
