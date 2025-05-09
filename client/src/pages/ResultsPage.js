// src/pages/ResultsPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import PhaseProgress from '../components/PhaseProgress';

const ResultsPage = () => {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    
    axios.get(`/api/student/attempts/${user.id}`)
      .then(res => {
        setAttempts(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error al cargar intentos:', err);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Resultados de Evaluaciones</h2>
      
      {/* Añadir el componente de progreso por fase */}
      <PhaseProgress />
      
      <h3 className="text-lg mt-5 mb-3">Historial de Evaluaciones</h3>
      
      {loading ? (
        <p>Cargando resultados...</p>
      ) : attempts.length === 0 ? (
        <p>No has realizado ninguna evaluación aún.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attempts.map(attempt => (
            <div key={attempt.attempt_id} className="border p-4 rounded shadow">
              <h4 className="font-bold">{attempt.title}</h4>
              <p><strong>Materia:</strong> {attempt.subject_name}</p>
              <p><strong>Fase:</strong> {attempt.phase}</p>
              <p><strong>Intento:</strong> {attempt.attempt_number}</p>
              <p><strong>Calificación:</strong> {attempt.score}</p>
              <p><strong>Fecha:</strong> {new Date(attempt.attempted_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
