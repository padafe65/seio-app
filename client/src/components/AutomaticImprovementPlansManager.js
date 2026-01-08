import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

const AutomaticImprovementPlansManager = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState('');
  const [autoStats, setAutoStats] = useState(null);
  const [autoPlans, setAutoPlans] = useState([]);
  const [processingResults, setProcessingResults] = useState(null);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    fetchQuestionnaires();
    fetchAutoStats();
    fetchAutoPlans();
  }, []);

  const fetchQuestionnaires = async () => {
    try {
      const response = await axiosClient.get('/questionnaires');
      setQuestionnaires(response.data);
    } catch (error) {
      console.error('Error obteniendo cuestionarios:', error);
    }
  };

  const fetchAutoStats = async () => {
    try {
      const response = await axiosClient.get('/improvement-plans/auto-stats');
      setAutoStats(response.data.data);
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      // Si hay error de autenticación, mostrar mensaje amigable
      if (error.response?.status === 401) {
        console.log('⚠️ Se requiere autenticación para ver estadísticas automáticas');
        setAuthError(true);
      }
    }
  };

  const fetchAutoPlans = async () => {
    try {
      const response = await axiosClient.get('/improvement-plans/auto-view');
      setAutoPlans(response.data.data);
    } catch (error) {
      console.error('Error obteniendo planes automáticos:', error);
      // Si hay error de autenticación, mostrar mensaje amigable
      if (error.response?.status === 401) {
        console.log('⚠️ Se requiere autenticación para ver planes automáticos');
        setAuthError(true);
      }
    }
  };

  const processQuestionnaire = async () => {
    if (!selectedQuestionnaire) {
      Swal.fire({
        icon: 'warning',
        title: 'Selecciona un cuestionario',
        text: 'Por favor selecciona un cuestionario para procesar automáticamente.'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axiosClient.post(`/improvement-plans/process-questionnaire/${selectedQuestionnaire}`);
      
      setProcessingResults(response.data.data);
      
      Swal.fire({
        icon: 'success',
        title: 'Procesamiento Completado',
        html: `
          <div style="text-align: left;">
            <p><strong>Cuestionario:</strong> ${response.data.data.questionnaire_id}</p>
            <p><strong>Estudiantes procesados:</strong> ${response.data.data.students_processed}</p>
            <p><strong>Planes creados:</strong> ${response.data.data.improvement_plans_created}</p>
          </div>
        `,
        confirmButtonText: 'Entendido'
      });

      // Actualizar estadísticas y planes
      fetchAutoStats();
      fetchAutoPlans();
      
    } catch (error) {
      console.error('Error procesando cuestionario:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error procesando el cuestionario automáticamente'
      });
    } finally {
      setLoading(false);
    }
  };

  const executeProcedure = async () => {
    if (!selectedQuestionnaire) {
      Swal.fire({
        icon: 'warning',
        title: 'Selecciona un cuestionario',
        text: 'Por favor selecciona un cuestionario para ejecutar el procedimiento.'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axiosClient.post(`/improvement-plans/execute-procedure/${selectedQuestionnaire}`);
      
      Swal.fire({
        icon: 'success',
        title: 'Procedimiento Ejecutado',
        text: response.data.data[0]?.result || 'Procedimiento ejecutado correctamente',
        confirmButtonText: 'Entendido'
      });

      // Actualizar estadísticas y planes
      fetchAutoStats();
      fetchAutoPlans();
      
    } catch (error) {
      console.error('Error ejecutando procedimiento:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error ejecutando el procedimiento'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending': 'warning',
      'in_progress': 'info',
      'completed': 'success',
      'failed': 'danger'
    };
    return badges[status] || 'secondary';
  };

  const getStatusText = (status) => {
    const texts = {
      'pending': 'Pendiente',
      'in_progress': 'En Progreso',
      'completed': 'Completado',
      'failed': 'Fallido'
    };
    return texts[status] || status;
  };

  const getAgeBadge = (age) => {
    const badges = {
      'RECIENTE': 'success',
      'ACTIVO': 'info',
      'ANTIGUO': 'secondary'
    };
    return badges[age] || 'secondary';
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <i className="fas fa-robot mr-2"></i>
                Sistema Automático de Planes de Mejoramiento
              </h3>
              <div className="card-tools">
                <button 
                  type="button" 
                  className="btn btn-tool" 
                  onClick={() => {
                    setAuthError(false);
                    fetchAutoStats();
                    fetchAutoPlans();
                  }}
                >
                  <i className="fas fa-sync-alt"></i>
                </button>
              </div>
            </div>
            <div className="card-body">
              
              {/* Mensaje de autenticación */}
              {authError && (
                <div className="alert alert-warning alert-dismissible fade show" role="alert">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  <strong>Información:</strong> Algunas funciones requieren autenticación. 
                  Asegúrate de estar logueado como profesor o administrador para acceder a todas las funcionalidades.
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setAuthError(false)}
                  ></button>
                </div>
              )}
              
              {/* Panel de Control */}
              <div className="row mb-4">
                <div className="col-md-8">
                  <div className="card">
                    <div className="card-header">
                      <h5 className="card-title">Panel de Control</h5>
                    </div>
                    <div className="card-body">
                      <div className="form-group">
                        <label htmlFor="questionnaireSelect">Seleccionar Cuestionario:</label>
                        <select 
                          id="questionnaireSelect"
                          className="form-control"
                          value={selectedQuestionnaire}
                          onChange={(e) => setSelectedQuestionnaire(e.target.value)}
                        >
                          <option value="">Selecciona un cuestionario...</option>
                          {questionnaires.map(q => (
                            <option key={q.id} value={q.id}>
                              {q.title} - {q.subject} (Grado {q.grade})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="row">
                        <div className="col-md-6">
                          <button 
                            className="btn btn-primary btn-block"
                            onClick={processQuestionnaire}
                            disabled={loading || !selectedQuestionnaire}
                          >
                            {loading ? (
                              <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                Procesando...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-cogs mr-2"></i>
                                Procesar Automáticamente
                              </>
                            )}
                          </button>
                        </div>
                        <div className="col-md-6">
                          <button 
                            className="btn btn-info btn-block"
                            onClick={executeProcedure}
                            disabled={loading || !selectedQuestionnaire}
                          >
                            {loading ? (
                              <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                Ejecutando...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-database mr-2"></i>
                                Ejecutar Procedimiento
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="col-md-4">
                  <div className="card">
                    <div className="card-header">
                      <h5 className="card-title">Estadísticas Rápidas</h5>
                    </div>
                    <div className="card-body">
                      {autoStats ? (
                        <>
                          <div className="row text-center">
                            <div className="col-6">
                              <div className="info-box">
                                <span className="info-box-icon bg-primary">
                                  <i className="fas fa-clipboard-list"></i>
                                </span>
                                <div className="info-box-content">
                                  <span className="info-box-text">Total Planes</span>
                                  <span className="info-box-number">{autoStats.general.total_plans}</span>
                                </div>
                              </div>
                            </div>
                            <div className="col-6">
                              <div className="info-box">
                                <span className="info-box-icon bg-success">
                                  <i className="fas fa-robot"></i>
                                </span>
                                <div className="info-box-content">
                                  <span className="info-box-text">Automáticos</span>
                                  <span className="info-box-number">{autoStats.general.auto_generated_plans}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="row text-center">
                            <div className="col-6">
                              <div className="info-box">
                                <span className="info-box-icon bg-warning">
                                  <i className="fas fa-clock"></i>
                                </span>
                                <div className="info-box-content">
                                  <span className="info-box-text">Pendientes</span>
                                  <span className="info-box-number">{autoStats.general.pending_plans}</span>
                                </div>
                              </div>
                            </div>
                            <div className="col-6">
                              <div className="info-box">
                                <span className="info-box-icon bg-info">
                                  <i className="fas fa-check-circle"></i>
                                </span>
                                <div className="info-box-content">
                                  <span className="info-box-text">Completados</span>
                                  <span className="info-box-number">{autoStats.general.completed_plans}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center">
                          <i className="fas fa-spinner fa-spin fa-2x"></i>
                          <p>Cargando estadísticas...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resultados del Procesamiento */}
              {processingResults && (
                <div className="row mb-4">
                  <div className="col-12">
                    <div className="card">
                      <div className="card-header">
                        <h5 className="card-title">Resultados del Procesamiento</h5>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-3">
                            <div className="info-box">
                              <span className="info-box-icon bg-info">
                                <i className="fas fa-users"></i>
                              </span>
                              <div className="info-box-content">
                                <span className="info-box-text">Estudiantes Procesados</span>
                                <span className="info-box-number">{processingResults.students_processed}</span>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="info-box">
                              <span className="info-box-icon bg-success">
                                <i className="fas fa-plus-circle"></i>
                              </span>
                              <div className="info-box-content">
                                <span className="info-box-text">Planes Creados</span>
                                <span className="info-box-number">{processingResults.improvement_plans_created}</span>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="info-box">
                              <span className="info-box-icon bg-primary">
                                <i className="fas fa-clipboard-check"></i>
                              </span>
                              <div className="info-box-content">
                                <span className="info-box-text">Cuestionario ID</span>
                                <span className="info-box-number">{processingResults.questionnaire_id}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de Planes Automáticos */}
              <div className="row">
                <div className="col-12">
                  <div className="card">
                    <div className="card-header">
                      <h5 className="card-title">Planes Automáticos Generados</h5>
                    </div>
                    <div className="card-body">
                      {autoPlans.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Estudiante</th>
                                <th>Grado</th>
                                <th>Materia</th>
                                <th>Cuestionario</th>
                                <th>Nota</th>
                                <th>Estado</th>
                                <th>Antigüedad</th>
                                <th>Días Restantes</th>
                                <th>Fecha Creación</th>
                              </tr>
                            </thead>
                            <tbody>
                              {autoPlans.map(plan => (
                                <tr key={plan.plan_id}>
                                  <td>{plan.plan_id}</td>
                                  <td>{plan.student_name}</td>
                                  <td>{plan.grade}</td>
                                  <td>{plan.subject}</td>
                                  <td>{plan.questionnaire_title || 'N/A'}</td>
                                  <td>
                                    <span className={`badge badge-${plan.student_score >= 3.5 ? 'success' : 'danger'}`}>
                                      {plan.student_score || 'N/A'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge badge-${getStatusBadge(plan.activity_status)}`}>
                                      {getStatusText(plan.activity_status)}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge badge-${getAgeBadge(plan.plan_age)}`}>
                                      {plan.plan_age}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge badge-${plan.days_remaining > 7 ? 'success' : plan.days_remaining > 0 ? 'warning' : 'danger'}`}>
                                      {plan.days_remaining} días
                                    </span>
                                  </td>
                                  <td>{new Date(plan.created_at).toLocaleDateString('es-CO')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <i className="fas fa-robot fa-3x text-muted mb-3"></i>
                          <h5 className="text-muted">No hay planes automáticos generados</h5>
                          <p className="text-muted">Los planes automáticos aparecerán aquí cuando se procesen cuestionarios con estudiantes que no alcancen los indicadores requeridos.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomaticImprovementPlansManager;
