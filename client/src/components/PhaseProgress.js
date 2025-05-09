// src/components/PhaseProgress.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const PhaseProgress = () => {
  const [phaseData, setPhaseData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    
    setLoading(true);
    axios.get(`/api/quiz/evaluations-by-phase/${user.id}`)
      .then(res => {
        setPhaseData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error al cargar progreso por fase:', err);
        setLoading(false);
      });
  }, [user]);

  if (loading) return <div>Cargando progreso...</div>;

  return (
    <div className="phase-progress-container">
      <h3>Progreso por Fases</h3>
      
      {phaseData.length === 0 ? (
        <p>No hay evaluaciones registradas aún.</p>
      ) : (
        <div className="phases-grid">
          {phaseData.map(phase => (
            <div key={phase.phase} className="phase-card">
              <h4>Fase {phase.phase}</h4>
              <p><strong>Evaluaciones completadas:</strong> {phase.total_evaluations}</p>
              <p><strong>Promedio de la fase:</strong> {phase.phase_average.toFixed(2)}</p>
              
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${(phase.phase_average / 5) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
          
          <div className="overall-average">
            <h4>Promedio General</h4>
            <p className="average-value">{phaseData[0]?.overall_average?.toFixed(2) || 'N/A'}</p>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .phase-progress-container {
          margin: 20px 0;
          padding: 15px;
          border-radius: 8px;
          background-color: #f8f9fa;
        }
        
        .phases-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        
        .phase-card {
          padding: 15px;
          border-radius: 8px;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .progress-bar-container {
          height: 10px;
          background-color: #e9ecef;
          border-radius: 5px;
          overflow: hidden;
          margin-top: 10px;
        }
        
        .progress-bar {
          height: 100%;
          background-color: #21808D;
          transition: width 0.3s ease;
        }
        
        .overall-average {
          grid-column: 1 / -1;
          text-align: center;
          padding: 15px;
          background-color: #0D5EFF;
          color: white;
          border-radius: 8px;
          margin-top: 10px;
        }
        
        .average-value {
          font-size: 24px;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default PhaseProgress;
