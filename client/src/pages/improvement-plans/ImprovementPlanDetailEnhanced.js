// client/src/pages/improvement-plans/ImprovementPlanDetailEnhanced.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Calendar, User, BookOpen, Target, BarChart3, Play, FileText, Link } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import RecoveryResourcesManager from '../../components/RecoveryResourcesManager';
import RecoveryActivitiesManager from '../../components/RecoveryActivitiesManager';
import RecoveryProgressTracker from '../../components/RecoveryProgressTracker';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ImprovementPlanDetailEnhanced = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    setUser(userData);
    fetchPlan();
  }, [id]);

  const fetchPlan = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/api/improvement-plans/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPlan(response.data);
    } catch (error) {
      console.error('Error al cargar plan:', error);
      Swal.fire('Error', 'No se pudo cargar el plan de mejoramiento', 'error');
      navigate('/planes-mejoramiento');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.put(`${API_URL}/api/improvement-plans/${id}`, {
        ...plan,
        activity_status: newStatus,
        completion_date: newStatus === 'completed' ? new Date().toISOString() : null
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setPlan(prev => ({
        ...prev,
        activity_status: newStatus,
        completion_date: newStatus === 'completed' ? new Date().toISOString() : null
      }));
      
      Swal.fire('Éxito', 'Estado actualizado correctamente', 'success');
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
    }
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

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_progress': return 'En Progreso';
      case 'completed': return 'Completado';
      case 'failed': return 'Fallido';
      default: return 'Desconocido';
    }
  };

  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="alert alert-danger text-center">
        <p className="mb-0">Plan de mejoramiento no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center">
          <button
            className="btn btn-outline-secondary me-3"
            onClick={() => navigate('/planes-mejoramiento')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="mb-1">{plan.title}</h2>
            <div className="d-flex align-items-center gap-3">
              <span className={`badge badge-${getStatusColor(plan.activity_status)}`}>
                {getStatusText(plan.activity_status)}
              </span>
              <small className="text-muted">
                <Calendar className="w-4 h-4 me-1" />
                Vence: {new Date(plan.deadline).toLocaleDateString()}
              </small>
            </div>
          </div>
        </div>
        
        {isTeacher && (
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-primary"
              onClick={() => navigate(`/planes-mejoramiento/editar/${id}`)}
            >
              <Edit className="w-4 h-4 me-1" />
              Editar
            </button>
            
            {plan.activity_status !== 'completed' && (
              <div className="dropdown">
                <button
                  className="btn btn-primary dropdown-toggle"
                  type="button"
                  data-bs-toggle="dropdown"
                >
                  Cambiar Estado
                </button>
                <ul className="dropdown-menu">
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => handleStatusUpdate('in_progress')}
                    >
                      En Progreso
                    </button>
                  </li>
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => handleStatusUpdate('completed')}
                    >
                      Completado
                    </button>
                  </li>
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => handleStatusUpdate('failed')}
                    >
                      Fallido
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Información básica */}
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <User className="w-5 h-5 me-2" />
                Información del Plan
              </h5>
              <div className="row">
                <div className="col-md-6">
                  <p><strong>Estudiante:</strong> {plan.student_name}</p>
                  <p><strong>Profesor:</strong> {plan.teacher_name}</p>
                  <p><strong>Materia:</strong> {plan.subject}</p>
                </div>
                <div className="col-md-6">
                  <p><strong>Fecha límite:</strong> {new Date(plan.deadline).toLocaleDateString()}</p>
                  <p><strong>Intentos:</strong> {plan.attempts_count || 0}</p>
                  {plan.completion_date && (
                    <p><strong>Completado:</strong> {new Date(plan.completion_date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center">
              <h6 className="card-title">Progreso General</h6>
              <div className="display-6 text-primary">
                {plan.activity_status === 'completed' ? '100%' : 
                 plan.activity_status === 'in_progress' ? '50%' : '0%'}
              </div>
              <div className="progress mt-2" style={{ height: '8px' }}>
                <div
                  className="progress-bar bg-primary"
                  style={{
                    width: plan.activity_status === 'completed' ? '100%' : 
                           plan.activity_status === 'in_progress' ? '50%' : '0%'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <BookOpen className="w-4 h-4 me-1" />
            Resumen
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'resources' ? 'active' : ''}`}
            onClick={() => setActiveTab('resources')}
          >
            <Play className="w-4 h-4 me-1" />
            Recursos
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'activities' ? 'active' : ''}`}
            onClick={() => setActiveTab('activities')}
          >
            <Target className="w-4 h-4 me-1" />
            Actividades
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            <BarChart3 className="w-4 h-4 me-1" />
            Progreso
          </button>
        </li>
      </ul>

      {/* Contenido de las pestañas */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="row">
            <div className="col-md-8">
              <div className="card mb-4">
                <div className="card-header">
                  <h6 className="mb-0">Descripción del Plan</h6>
                </div>
                <div className="card-body">
                  <p className="card-text">{plan.description}</p>
                </div>
              </div>

              <div className="card mb-4">
                <div className="card-header">
                  <h6 className="mb-0">Actividades</h6>
                </div>
                <div className="card-body">
                  <pre className="card-text" style={{ whiteSpace: 'pre-wrap' }}>{plan.activities}</pre>
                </div>
              </div>

              {plan.failed_achievements && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h6 className="mb-0 text-danger">Logros No Alcanzados</h6>
                  </div>
                  <div className="card-body">
                    <pre className="card-text" style={{ whiteSpace: 'pre-wrap' }}>{plan.failed_achievements}</pre>
                  </div>
                </div>
              )}

              {plan.passed_achievements && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h6 className="mb-0 text-success">Logros Alcanzados</h6>
                  </div>
                  <div className="card-body">
                    <pre className="card-text" style={{ whiteSpace: 'pre-wrap' }}>{plan.passed_achievements}</pre>
                  </div>
                </div>
              )}
            </div>

            <div className="col-md-4">
              {/* Recursos rápidos */}
              {(plan.video_urls || plan.resource_links || plan.file_url) && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h6 className="mb-0">Recursos Rápidos</h6>
                  </div>
                  <div className="card-body">
                    {plan.video_urls && (
                      <div className="mb-3">
                        <h6 className="text-primary">
                          <Play className="w-4 h-4 me-1" />
                          Videos
                        </h6>
                        {plan.video_urls.split('\n').map((url, index) => (
                          url.trim() && (
                            <a
                              key={index}
                              href={url.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline-primary btn-sm me-2 mb-2"
                            >
                              Video {index + 1}
                            </a>
                          )
                        ))}
                      </div>
                    )}

                    {plan.resource_links && (
                      <div className="mb-3">
                        <h6 className="text-info">
                          <Link className="w-4 h-4 me-1" />
                          Enlaces
                        </h6>
                        {plan.resource_links.split('\n').map((url, index) => (
                          url.trim() && (
                            <a
                              key={index}
                              href={url.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline-info btn-sm me-2 mb-2"
                            >
                              Recurso {index + 1}
                            </a>
                          )
                        ))}
                      </div>
                    )}

                    {plan.file_url && (
                      <div className="mb-3">
                        <h6 className="text-secondary">
                          <FileText className="w-4 h-4 me-1" />
                          Archivo
                        </h6>
                        <a
                          href={plan.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline-secondary btn-sm"
                        >
                          Descargar Archivo
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notas */}
              {(plan.teacher_notes || plan.student_feedback) && (
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">Notas y Comentarios</h6>
                  </div>
                  <div className="card-body">
                    {plan.teacher_notes && (
                      <div className="mb-3">
                        <h6 className="text-primary">Notas del Profesor</h6>
                        <p className="small">{plan.teacher_notes}</p>
                      </div>
                    )}
                    {plan.student_feedback && (
                      <div>
                        <h6 className="text-success">Comentarios del Estudiante</h6>
                        <p className="small">{plan.student_feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <RecoveryResourcesManager 
            improvementPlanId={id} 
            isStudent={isStudent}
          />
        )}

        {activeTab === 'activities' && (
          <RecoveryActivitiesManager 
            improvementPlanId={id} 
            isStudent={isStudent}
          />
        )}

        {activeTab === 'progress' && (
          <RecoveryProgressTracker 
            improvementPlanId={id} 
            studentId={plan.student_user_id}
          />
        )}
      </div>
    </div>
  );
};

export default ImprovementPlanDetailEnhanced;
