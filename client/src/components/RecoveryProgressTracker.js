// client/src/components/RecoveryProgressTracker.js
import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, CheckCircle, AlertCircle, Target } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const RecoveryProgressTracker = ({ improvementPlanId, studentId }) => {
  const [progress, setProgress] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (improvementPlanId && studentId) {
      fetchProgress();
    }
  }, [improvementPlanId, studentId]);

  const fetchProgress = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${API_URL}/api/improvement-plans/${improvementPlanId}/progress/${studentId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      setProgress(response.data.progress);
      setStatistics(response.data.statistics);
    } catch (error) {
      console.error('Error al cargar progreso:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = () => {
    if (!statistics) return 0;
    const totalItems = (statistics.total_resources || 0) + (statistics.total_activities || 0);
    const completedItems = (statistics.viewed_resources || 0) + (statistics.completed_activities || 0);
    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'danger';
      case 'in_progress': return 'warning';
      case 'overdue': return 'danger';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando progreso...</span>
        </div>
      </div>
    );
  }

  if (!progress || !statistics) {
    return (
      <div className="alert alert-info text-center">
        <Target className="w-5 h-5 mb-2" />
        <p className="mb-0">No hay datos de progreso disponibles.</p>
      </div>
    );
  }

  const progressPercentage = getProgressPercentage();

  return (
    <div className="recovery-progress-tracker">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">
          <BarChart3 className="me-2" />
          Seguimiento de Progreso
        </h5>
        <div className="d-flex align-items-center">
          <TrendingUp className="w-4 h-4 me-2" />
          <span className="fw-bold text-primary">{progressPercentage}%</span>
        </div>
      </div>

      {/* Barra de progreso general */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">Progreso General</h6>
            <span className="badge badge-primary">{progressPercentage}%</span>
          </div>
          <div className="progress" style={{ height: '10px' }}>
            <div
              className="progress-bar bg-primary"
              role="progressbar"
              style={{ width: `${progressPercentage}%` }}
              aria-valuenow={progressPercentage}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="row mb-4">
        <div className="col-md-6 mb-3">
          <div className="card h-100">
            <div className="card-body text-center">
              <h6 className="card-title">Recursos</h6>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Vistos:</span>
                <span className="fw-bold text-success">
                  {statistics.viewed_resources || 0} / {statistics.total_resources || 0}
                </span>
              </div>
              <div className="progress mt-2" style={{ height: '6px' }}>
                <div
                  className="progress-bar bg-success"
                  style={{
                    width: `${statistics.total_resources > 0 
                      ? ((statistics.viewed_resources || 0) / statistics.total_resources) * 100 
                      : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-6 mb-3">
          <div className="card h-100">
            <div className="card-body text-center">
              <h6 className="card-title">Actividades</h6>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Completadas:</span>
                <span className="fw-bold text-primary">
                  {statistics.completed_activities || 0} / {statistics.total_activities || 0}
                </span>
              </div>
              <div className="progress mt-2" style={{ height: '6px' }}>
                <div
                  className="progress-bar bg-primary"
                  style={{
                    width: `${statistics.total_activities > 0 
                      ? ((statistics.completed_activities || 0) / statistics.total_activities) * 100 
                      : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Promedio de calificaciones */}
      {statistics.average_score && (
        <div className="card mb-4">
          <div className="card-body text-center">
            <h6 className="card-title">Promedio de Calificaciones</h6>
            <div className="display-6 text-primary">
              {parseFloat(statistics.average_score).toFixed(1)}
            </div>
            <small className="text-muted">Sobre 5.0</small>
          </div>
        </div>
      )}

      {/* Historial de actividades */}
      <div className="card">
        <div className="card-header">
          <h6 className="mb-0">Historial de Actividades</h6>
        </div>
        <div className="card-body">
          {progress.length === 0 ? (
            <div className="text-center text-muted">
              <Clock className="w-5 h-5 mb-2" />
              <p className="mb-0">No hay actividades registradas aún.</p>
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {progress.map((item, index) => (
                <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <span className="text-primary me-2">
                      {getStatusIcon(item.progress_type)}
                    </span>
                    <div>
                      <div className="fw-bold">
                        {item.resource_title || item.activity_title || 'Actividad'}
                      </div>
                      <small className="text-muted">
                        {item.progress_type === 'resource_viewed' ? 'Recurso visto' : 'Actividad completada'}
                        {item.resource_type && ` - ${item.resource_type}`}
                        {item.activity_type && ` - ${item.activity_type}`}
                      </small>
                    </div>
                  </div>
                  <div className="text-end">
                    {item.score && (
                      <div className="fw-bold text-primary">
                        {parseFloat(item.score).toFixed(1)}
                      </div>
                    )}
                    <small className="text-muted">
                      {new Date(item.created_at).toLocaleDateString()}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecoveryProgressTracker;
