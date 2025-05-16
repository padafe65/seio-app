import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const StudentIndicators = () => {
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState('all');
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchIndicators = async () => {
      try {
        if (!user) return;
        
        const response = await axios.get(`/api/indicators/student/${user.id}`);
        setIndicators(response.data);
      } catch (error) {
        console.error('Error al cargar indicadores:', error);
        setError('Error al cargar indicadores. Intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchIndicators();
  }, [user]);
  
  const filteredIndicators = selectedPhase === 'all' 
    ? indicators 
    : indicators.filter(indicator => indicator.phase.toString() === selectedPhase);
  
  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }
  
  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }
  
  return (
    <div className="container">
      <h2 className="mb-4">Indicadores de Desempeño</h2>
      
      <div className="mb-4">
        <label htmlFor="phaseFilter" className="form-label">Filtrar por Fase:</label>
        <select 
          id="phaseFilter" 
          className="form-select" 
          value={selectedPhase}
          onChange={(e) => setSelectedPhase(e.target.value)}
        >
          <option value="all">Todas las Fases</option>
          <option value="1">Fase 1</option>
          <option value="2">Fase 2</option>
          <option value="3">Fase 3</option>
          <option value="4">Fase 4</option>
        </select>
      </div>
      
      {filteredIndicators.length === 0 ? (
        <div className="alert alert-info">
          No hay indicadores disponibles para {selectedPhase === 'all' ? 'ninguna fase' : `la fase ${selectedPhase}`}.
        </div>
      ) : (
        <div className="row">
          {filteredIndicators.map(indicator => (
            <div key={indicator.id} className="col-md-6 mb-4">
              <div className={`card h-100 ${indicator.achieved ? 'border-success' : 'border-warning'}`}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Fase {indicator.phase}</h5>
                  <span className={`badge ${indicator.achieved ? 'bg-success' : 'bg-warning'}`}>
                    {indicator.achieved ? 'Logrado' : 'Pendiente'}
                  </span>
                </div>
                <div className="card-body">
                  <h5 className="card-title">{indicator.subject}</h5>
                  <p className="card-text">{indicator.description}</p>
                  {indicator.questionnaire_title && (
                    <div className="mt-2 p-2 bg-light rounded">
                      <small className="d-block"><strong>Cuestionario:</strong> {indicator.questionnaire_title}</small>
                      {indicator.questionnaire_grade && (
                        <small className="d-block"><strong>Grado:</strong> {indicator.questionnaire_grade}</small>
                      )}
                    </div>
                  )}
                </div>
                <div className="card-footer text-muted">
                  <small>Docente: {indicator.teacher_name}</small>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentIndicators;
