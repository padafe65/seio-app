// src/pages/ResultsPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ResultsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [evaluationResults, setEvaluationResults] = useState([]);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [phaseAverages, setPhaseAverages] = useState([]);
  const [activeTab, setActiveTab] = useState('evaluations');
  const [selectedPhase, setSelectedPhase] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Obtener los mejores resultados (evaluation_results)
        const evaluationsResponse = await axios.get(`${API_URL}/api/student/evaluation-results/${user.id}`);
        setEvaluationResults(evaluationsResponse.data);
        
        // Obtener todos los intentos (quiz_attempts)
        const attemptsResponse = await axios.get(`${API_URL}/api/student/attempts/${user.id}`);
        setQuizAttempts(attemptsResponse.data);
        
        // Obtener promedios por fase
        const phaseResponse = await axios.get(`${API_URL}/api/quiz/evaluations-by-phase/${user.id}`);
        setPhaseAverages(phaseResponse.data);
        
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar resultados:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);

  // Función para formatear fechas
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('es-ES', options);
  };

  // Filtrar resultados por fase si se selecciona una
  const filteredEvaluations = selectedPhase 
    ? evaluationResults.filter(evaluacion => eval.phase === parseInt(selectedPhase))
    : evaluationResults;
    
  const filteredAttempts = selectedPhase 
    ? quizAttempts.filter(attempt => attempt.phase === parseInt(selectedPhase))
    : quizAttempts;

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Resultados de Evaluaciones</h2>
        <Link to="/student/dashboard" className="btn btn-outline-secondary">
          Volver al Dashboard
        </Link>
      </div>
      
      {/* Resumen de promedios por fase */}
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">Resumen de Promedios por Fase</h5>
        </div>
        <div className="card-body">
          <div className="row">
            {phaseAverages.map((phase) => (
              <div key={phase.phase} className="col-md-3 mb-3">
                <div className="card h-100">
                  <div className="card-body text-center">
                    <h5 className="card-title">Fase {phase.phase}</h5>
                    <p className="display-4">{parseFloat(phase.phase_average).toFixed(2)}</p>
                    <p className="text-muted">Evaluaciones: {phase.total_evaluations}</p>
                    <div className="progress mt-2">
                      <div 
                        className={`progress-bar ${parseFloat(phase.phase_average) >= 3 ? 'bg-success' : 'bg-danger'}`}
                        role="progressbar" 
                        style={{ width: `${(phase.phase_average / 5) * 100}%` }}
                        aria-valuenow={phase.phase_average} 
                        aria-valuemin="0" 
                        aria-valuemax="5">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="col-md-3 mb-3">
              <div className="card h-100 bg-light">
                <div className="card-body text-center">
                  <h5 className="card-title">Promedio General</h5>
                  <p className="display-4">
                    {phaseAverages.length > 0 
                      ? parseFloat(phaseAverages[0]?.overall_average).toFixed(2) 
                      : 'N/A'}
                  </p>
                  <p className="text-muted">Todas las fases</p>
                  {phaseAverages.length > 0 && (
                    <div className="progress mt-2">
                      <div 
                        className={`progress-bar ${parseFloat(phaseAverages[0]?.overall_average) >= 3 ? 'bg-success' : 'bg-danger'}`}
                        role="progressbar" 
                        style={{ width: `${(phaseAverages[0]?.overall_average / 5) * 100}%` }}
                        aria-valuenow={phaseAverages[0]?.overall_average} 
                        aria-valuemin="0" 
                        aria-valuemax="5">
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filtro por fase */}
      <div className="mb-4">
        <div className="d-flex align-items-center">
          <label className="me-2">Filtrar por fase:</label>
          <select 
            className="form-select w-auto" 
            value={selectedPhase || ''} 
            onChange={(e) => setSelectedPhase(e.target.value || null)}
          >
            <option value="">Todas las fases</option>
            <option value="1">Fase 1</option>
            <option value="2">Fase 2</option>
            <option value="3">Fase 3</option>
            <option value="4">Fase 4</option>
          </select>
        </div>
      </div>
      
      {/* Pestañas para cambiar entre mejores resultados y todos los intentos */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'evaluations' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluations')}
          >
            Mejores Resultados
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'attempts' ? 'active' : ''}`}
            onClick={() => setActiveTab('attempts')}
          >
            Historial de Intentos
          </button>
        </li>
      </ul>
      
      {/* Tabla de mejores resultados (evaluation_results) */}
      {activeTab === 'evaluations' && (
        <div className="card">
          <div className="card-header bg-white">
            <h5 className="mb-0">Mejores Resultados por Evaluación</h5>
          </div>
          <div className="card-body">
            {filteredEvaluations.length === 0 ? (
              <p className="text-center text-muted">No hay resultados disponibles</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Evaluación</th>
                      <th>Fase</th>
                      <th>Mejor Calificación</th>
                      <th>Intento</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvaluations.map((result) => (
                      <tr key={result.id}>
                        <td>{result.title}</td>
                        <td>Fase {result.phase}</td>
                        <td>
                          <span className={`badge ${parseFloat(result.best_score) >= 3 ? 'bg-success' : 'bg-danger'}`}>
                            {parseFloat(result.best_score).toFixed(2)}
                          </span>
                        </td>
                        <td>{result.attempt_number}</td>
                        <td>{formatDate(result.recorded_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Tabla de todos los intentos (quiz_attempts) */}
      {activeTab === 'attempts' && (
        <div className="card">
          <div className="card-header bg-white">
            <h5 className="mb-0">Historial de Intentos</h5>
          </div>
          <div className="card-body">
            {filteredAttempts.length === 0 ? (
              <p className="text-center text-muted">No hay intentos registrados</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Evaluación</th>
                      <th>Fase</th>
                      <th>Intento</th>
                      <th>Calificación</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttempts.map((attempt) => (
                      <tr key={attempt.attempt_id}>
                        <td>{attempt.title}</td>
                        <td>Fase {attempt.phase}</td>
                        <td>{attempt.attempt_number}</td>
                        <td>
                          <span className={`badge ${parseFloat(attempt.score) >= 3 ? 'bg-success' : 'bg-danger'}`}>
                            {parseFloat(attempt.score).toFixed(2)}
                          </span>
                        </td>
                        <td>{formatDate(attempt.attempted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
