// pages/ImprovementPage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, FileText, Download } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ImprovementPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indicators, setIndicators] = useState([]);
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Obtener el student_id asociado al user_id actual
        const studentResponse = await axios.get(`${API_URL}/api/students/by-user/${user.id}`);
        if (!studentResponse.data || !studentResponse.data.id) {
          throw new Error('No se pudo obtener la información del estudiante');
        }
        
        const studentId = studentResponse.data.id;
        
        // Obtener planes de mejoramiento para este estudiante usando student_id, no user.id
        const plansResponse = await axios.get(`${API_URL}/api/improvement-plans/student-id/${studentId}`);
        setPlans(plansResponse.data || []);
        
        // Obtener indicadores no alcanzados para este estudiante
        const indicatorsResponse = await axios.get(
          `${API_URL}/api/improvement-plans/indicators/failed/${studentId}/${studentResponse.data.grade}/1`
        );
        setIndicators(indicatorsResponse.data || []);
        
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
              {indicators.length > 0 ? (
                <ul className="list-group">
                  {indicators.map(indicator => (
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
                  <a href="#" className="btn btn-outline-primary">Ver Materiales</a>
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
                  <button type="button" className="btn btn-outline-primary">Ver Ejercicios</button>
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
