// pages/ImprovementPage.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, FileText, Download } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

const ImprovementPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indicators, setIndicators] = useState([]);
  const [isPromoted, setIsPromoted] = useState(null);
  const [needsReinforcement, setNeedsReinforcement] = useState(false);
  const [phasesNeedingPlan, setPhasesNeedingPlan] = useState([]);
  const [phasesAwaitingPdf, setPhasesAwaitingPdf] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Obtener el student_id asociado al user_id actual
        const studentResponse = await axiosClient.get(`/students/by-user/${user.id}`);
        if (!studentResponse.data || !studentResponse.data.id) {
          throw new Error('No se pudo obtener la información del estudiante');
        }
        
        const studentId = studentResponse.data.id;
        
        // Obtener planes de mejoramiento para este estudiante usando student_id, no user.id
        const plansResponse = await axiosClient.get(`/improvement-plans/student-id/${studentId}`);
        setPlans(plansResponse.data || []);
        
        // Esta ruta devuelve todos los indicadores asignados, logrados y pendientes,
        // sin asumir de antemano cuántas fases tiene el curso.
        const indicatorsResponse = await axiosClient.get(`/indicators/student/${user.id}`);
        const indicatorsData = indicatorsResponse.data?.data;
        setIndicators(Array.isArray(indicatorsData) ? indicatorsData : []);

        try {
          const gradesResponse = await axiosClient.get(`/reports/generate-grade-report?studentId=${studentId}`);
          const gradeRows = Array.isArray(gradesResponse.data) ? gradesResponse.data : [];
          const finalGradeValue = gradeRows.find(row => row.final_grade != null)?.final_grade;
          const finalGrade = finalGradeValue == null ? NaN : Number(finalGradeValue);
          setNeedsReinforcement(Number.isFinite(finalGrade) && finalGrade >= 3.0 && finalGrade < 3.5);
          const hasAllFourPhases = [1, 2, 3, 4].every(phase =>
            gradeRows.some(row => row[`phase${phase}`] != null && Number.isFinite(Number(row[`phase${phase}`])))
          );
          setIsPromoted(hasAllFourPhases && Number.isFinite(finalGrade) ? finalGrade >= 3.0 : null);
          const failedPhases = [1, 2, 3, 4].filter(phase =>
            gradeRows.some(row => row[`phase${phase}`] != null && Number(row[`phase${phase}`]) < 3.5)
          );
          const phaseOfPlan = plan => {
            const match = String(plan.teacher_notes || '').match(/AUTO_PHASE:(\d+)/i) || String(plan.title || '').match(/fase\s+(\d+)/i);
            return match ? Number(match[1]) : null;
          };
          setPhasesNeedingPlan(failedPhases.filter(phase => !plansResponse.data?.some(plan => phaseOfPlan(plan) === phase)));
          setPhasesAwaitingPdf(failedPhases.filter(phase => plansResponse.data?.some(plan => phaseOfPlan(plan) === phase && !plan.plan_pdf_path)));
        } catch (gradeError) {
          console.error('No se pudo determinar el resultado final del estudiante:', gradeError);
          setIsPromoted(null);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setError('No se pudieron cargar los datos. Por favor, intenta de nuevo.');
        setLoading(false);
      }
    };
    
    if (user && user.id) {
      fetchData();
    }
  }, [user]);
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO');
  };

  const downloadPlanPdf = async plan => {
    try {
      const response = await axiosClient.get(`/improvement-plans/${plan.id}/plan-pdf`, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = plan.plan_pdf_original_name || 'plan-mejoramiento.pdf';
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      console.error('No se pudo descargar el PDF del plan:', downloadError);
    }
  };

  const achievedIndicators = indicators.filter(indicator => indicator.achieved === true || Number(indicator.achieved) === 1);
  const failedIndicators = indicators.filter(indicator => indicator.achieved === false || Number(indicator.achieved) === 0);
  
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
      <h2 className="mb-4">Plan de Mejora</h2>
      
      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      )}
      
      <div className="row">
        <div className="col-lg-6 mb-4">
          <div className="card h-100">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Planes de Mejoramiento Asignados</h5>
            </div>
            <div className="card-body">
              {plans.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Título</th>
                        <th>Materia</th>
                        <th>Fecha Límite</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map(plan => (
                        <tr key={plan.id}>
                          <td>{plan.title}</td>
                          <td>{plan.subject}</td>
                          <td>{formatDate(plan.deadline)}</td>
                          <td>
                            <span className={`badge ${plan.completed ? 'bg-success' : 'bg-warning'}`}>
                              {plan.completed ? 'Completado' : 'Pendiente'}
                            </span>
                          </td>
                          <td>
                            <div className="btn-group">
                              <Link 
                                to={`/student/planes-mejoramiento/${plan.id}`} 
                                className="btn btn-sm btn-outline-info"
                              >
                                <Eye size={16} className="me-1" /> Ver
                              </Link>
                              {plan.file_url && (
                                <a 
                                  href={plan.file_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-outline-primary"
                                >
                                  <Download size={16} className="me-1" /> Descargar
                                </a>
                              )}
                              {plan.plan_pdf_path && (
                                <button type="button" onClick={() => downloadPlanPdf(plan)} className="btn btn-sm btn-outline-primary">
                                  <Download size={16} className="me-1" /> PDF del plan
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="mb-0">No tienes planes de mejoramiento asignados.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="col-lg-6 mb-4">
          <div className="card h-100">
            <div className="card-header bg-danger text-white">
              <h5 className="mb-0">Indicadores No Alcanzados</h5>
            </div>
            <div className="card-body">
              {failedIndicators.length > 0 ? (
                <ul className="list-group">
                  {failedIndicators.map(indicator => (
                    <li key={indicator.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <p className="mb-1">{indicator.description}</p>
                          <small className="text-muted">Materia: {indicator.subject}</small>
                        </div>
                        <span className="badge bg-danger">Fase {indicator.phase}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-4">
                  <p className="mb-0">No tienes indicadores pendientes por alcanzar.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header bg-success text-white">
          <h5 className="mb-0">Indicadores Alcanzados</h5>
        </div>
        <div className="card-body">
          {achievedIndicators.length > 0 ? (
            <>
              <div className="alert alert-success">
                ¡Felicitaciones por tu esfuerzo y por alcanzar estos objetivos de aprendizaje! Sigue avanzando en {achievedIndicators.map(i => i.subject).filter((s, idx, all) => s && all.indexOf(s) === idx).join(', ') || 'tus materias'}.
              </div>
              <ul className="list-group">
                {achievedIndicators.map(indicator => (
                  <li key={indicator.student_indicator_id || `${indicator.id}-${indicator.phase}`} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <p className="mb-1">{indicator.description}</p>
                      <small className="text-muted">Materia: {indicator.subject || '—'}</small>
                    </div>
                    <span className="badge bg-success">Fase {indicator.phase}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mb-0 text-muted">Aún no hay indicadores alcanzados registrados.</p>
          )}
        </div>
      </div>

      {isPromoted === false && (
        <div className="alert alert-info mt-4" role="status">
          Tu definitiva es inferior a 3,0 y no fuiste promovido en la materia. Revisa los planes asignados y comunícate con el docente si falta el plan de alguna fase.
        </div>
      )}
      {isPromoted === true && needsReinforcement && (
        <div className="alert alert-success mt-4" role="status">
          Fuiste promovido en la materia con una definitiva entre 3,0 y menos de 3,5. Refuerza los temas vistos durante el período académico y revisa los indicadores que aún tienes pendientes.
        </div>
      )}
      {phasesNeedingPlan.length > 0 && (
        <div className="alert alert-warning mt-4" role="status">
          <strong>Solicita tu plan de mejoramiento:</strong> tienes fase(s) {phasesNeedingPlan.join(', ')} con nota inferior a 3,5 y todavía no aparece un plan asignado. Comunícate con el docente de la materia para solicitarlo.
        </div>
      )}
      {phasesAwaitingPdf.length > 0 && (
        <div className="alert alert-warning mt-4" role="status">
          El docente ya registró un plan para la(s) fase(s) {phasesAwaitingPdf.join(', ')}, pero todavía no ha publicado el PDF. Comunícate con él para solicitar el material.
        </div>
      )}
      
      <div className="card mt-4">
        <div className="card-header bg-info text-white">
          <h5 className="mb-0">Recursos de Apoyo</h5>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6 mb-3">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">
                    <FileText size={20} className="me-2" />
                    Material de Estudio
                  </h5>
                  <p className="card-text">Accede a material complementario para mejorar tu desempeño académico.</p>
                  <Link to="/student/educational-resources" className="btn btn-outline-primary">Ver Materiales</Link>
                </div>
              </div>
            </div>
            <div className="col-md-6 mb-3">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">
                    <FileText size={20} className="me-2" />
                    Ejercicios Prácticos
                  </h5>
                  <p className="card-text">Practica con ejercicios adicionales para reforzar tus conocimientos.</p>
                  <Link to="/student/educational-resources" className="btn btn-outline-primary">Ver Ejercicios</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImprovementPage;
