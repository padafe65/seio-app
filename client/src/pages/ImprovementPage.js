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
          const hasAllFourPhases = [1, 2, 3, 4].every(phase =>
            gradeRows.some(row => row[`phase${phase}`] != null && Number.isFinite(Number(row[`phase${phase}`])))
          );
          setIsPromoted(hasAllFourPhases && Number.isFinite(finalGrade) ? finalGrade >= 3.0 : null);
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
          Sigue esforzándote para alcanzar los objetivos de aprendizaje. El docente realizará la entrega del plan de mejoramiento de forma física o a través de correo electrónico en los próximos días. Por favor, está atento a las comunicaciones del docente.
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
