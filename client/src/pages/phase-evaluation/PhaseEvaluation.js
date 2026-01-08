// pages/phase-evaluation/PhaseEvaluation.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const PhaseEvaluation = () => {
  const [selectedPhase, setSelectedPhase] = useState(1);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  
  useEffect(() => {
    if (selectedPhase) {
      fetchPhaseStats();
    }
  }, [selectedPhase]);
  
  const fetchPhaseStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/phase-evaluation/phase-stats/${selectedPhase}`);
      setStats(response.data);
      setError(null);
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      setError('No se pudieron cargar las estadísticas de la fase');
    } finally {
      setLoading(false);
    }
  };
  
  const handleEvaluatePhase = async () => {
    // Confirmar antes de iniciar la evaluación
    const result = await Swal.fire({
      title: `¿Evaluar/Actualizar Fase ${selectedPhase}?`,
      text: 'Se generarán o actualizarán planes de mejoramiento para los estudiantes que no hayan alcanzado la nota mínima. Puedes ejecutar esta acción múltiples veces para actualizar los planes.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, evaluar/actualizar fase',
      cancelButtonText: 'Cancelar'
    });
    
    if (!result.isConfirmed) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/phase-evaluation/evaluate-phase/${selectedPhase}`);
      
      Swal.fire({
        title: '¡Evaluación completada!',
        html: `<p>${response.data.message}</p>`,
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });
      
      // Actualizar estadísticas
      fetchPhaseStats();
    } catch (error) {
      console.error('Error al evaluar fase:', error);
      Swal.fire({
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo completar la evaluación de la fase',
        icon: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  if (!user || user.role !== 'docente') {
    return (
      <div className="alert alert-warning">
        <AlertTriangle size={24} className="me-2" />
        Solo los docentes pueden acceder a esta funcionalidad.
      </div>
    );
  }
  
  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-header bg-primary text-white">
          <h4 className="mb-0">Evaluación de Fase</h4>
        </div>
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-6">
              <label htmlFor="phaseSelect" className="form-label">Seleccionar Fase:</label>
              <select 
                id="phaseSelect" 
                className="form-select"
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(parseInt(e.target.value))}
              >
                <option value={1}>Fase 1</option>
                <option value={2}>Fase 2</option>
                <option value={3}>Fase 3</option>
                <option value={4}>Fase 4 (Final)</option>
              </select>
            </div>
            <div className="col-md-6 d-flex align-items-end">
              <button 
                className="btn btn-primary w-100"
                onClick={handleEvaluatePhase}
                disabled={loading}
                title="Puedes ejecutar esta evaluación múltiples veces para actualizar los planes de mejoramiento"
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="me-2 spinner" /> Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} className="me-2" /> Evaluar/Actualizar Fase {selectedPhase}
                  </>
                )}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="alert alert-danger">
              <AlertTriangle size={18} className="me-2" />
              {error}
            </div>
          )}
          
          {stats && (
            <div className="card mt-4">
              <div className="card-header bg-info text-white">
                <h5 className="mb-0">Estadísticas de la Fase {selectedPhase}</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-3">
                    <div className="card text-center h-100">
                      <div className="card-body">
                        <h3>{stats.total_students || 0}</h3>
                        <p className="mb-0">Estudiantes Evaluados</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card text-center h-100 border-success">
                      <div className="card-body">
                        <h3>{stats.approved_students || 0}</h3>
                        <p className="mb-0">Aprobados</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card text-center h-100 border-danger">
                      <div className="card-body">
                        <h3>{stats.failed_students || 0}</h3>
                        <p className="mb-0">No Aprobados</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card text-center h-100 border-info">
                      <div className="card-body">
                        <h3>{stats.average_score ?  Number(stats.average_score).toFixed(2) : 'N/A'}</h3>
                        <p className="mb-0">Promedio</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="alert alert-info mt-4">
                  <p className="mb-0">
                    <strong>Nota:</strong> Al evaluar la fase, se generarán o actualizarán automáticamente planes de mejoramiento 
                    para los estudiantes con nota inferior a 3.5 y se les asignarán los indicadores pendientes.
                    <br />
                    <strong>Puedes ejecutar esta evaluación múltiples veces</strong> para actualizar los planes existentes con la información más reciente.
                    {selectedPhase === 4 && (
                      <span className="d-block mt-2">
                        <strong>Importante:</strong> Al ser la fase final, también se generarán planes de habilitación 
                        para los estudiantes con promedio final inferior a 3.0.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhaseEvaluation;
