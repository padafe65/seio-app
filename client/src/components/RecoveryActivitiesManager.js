// client/src/components/RecoveryActivitiesManager.js
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Target, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const RecoveryActivitiesManager = ({ improvementPlanId, isStudent = false }) => {
  const [activities, setActivities] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [formData, setFormData] = useState({
    indicator_id: '',
    questionnaire_id: '',
    activity_type: 'quiz',
    title: '',
    description: '',
    instructions: '',
    due_date: '',
    max_attempts: 3,
    passing_score: 3.5,
    weight: 1.00
  });

  // Cargar datos
  useEffect(() => {
    if (improvementPlanId) {
      fetchActivities();
      if (!isStudent) {
        fetchIndicators();
        fetchQuestionnaires();
      }
    }
  }, [improvementPlanId, isStudent]);

  const fetchActivities = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/api/improvement-plans/${improvementPlanId}/activities`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setActivities(response.data);
    } catch (error) {
      console.error('Error al cargar actividades:', error);
      Swal.fire('Error', 'No se pudieron cargar las actividades', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchIndicators = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/api/indicators`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setIndicators(response.data);
    } catch (error) {
      console.error('Error al cargar indicadores:', error);
    }
  };

  const fetchQuestionnaires = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const userData = JSON.parse(localStorage.getItem('user'));
      const response = await axios.get(`${API_URL}/api/questionnaires?created_by=${userData.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setQuestionnaires(response.data);
    } catch (error) {
      console.error('Error al cargar cuestionarios:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('authToken');
      const config = {
        headers: { 'Authorization': `Bearer ${token}` }
      };

      if (editingActivity) {
        // Actualizar actividad existente
        await axios.put(`${API_URL}/api/activities/${editingActivity.id}`, formData, config);
        Swal.fire('Éxito', 'Actividad actualizada correctamente', 'success');
      } else {
        // Crear nueva actividad
        await axios.post(`${API_URL}/api/improvement-plans/${improvementPlanId}/activities`, formData, config);
        Swal.fire('Éxito', 'Actividad creada correctamente', 'success');
      }

      setShowForm(false);
      setEditingActivity(null);
      resetForm();
      fetchActivities();
    } catch (error) {
      console.error('Error al guardar actividad:', error);
      Swal.fire('Error', 'No se pudo guardar la actividad', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (activity) => {
    setEditingActivity(activity);
    setFormData({
      indicator_id: activity.indicator_id || '',
      questionnaire_id: activity.questionnaire_id || '',
      activity_type: activity.activity_type,
      title: activity.title,
      description: activity.description || '',
      instructions: activity.instructions || '',
      due_date: activity.due_date ? activity.due_date.split('T')[0] : '',
      max_attempts: activity.max_attempts,
      passing_score: activity.passing_score,
      weight: activity.weight
    });
    setShowForm(true);
  };

  const handleDelete = async (activityId) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'No podrás revertir esta acción',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        await axios.delete(`${API_URL}/api/activities/${activityId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        Swal.fire('Eliminado', 'La actividad ha sido eliminada', 'success');
        fetchActivities();
      } catch (error) {
        console.error('Error al eliminar actividad:', error);
        Swal.fire('Error', 'No se pudo eliminar la actividad', 'error');
      }
    }
  };

  const handleCompleteActivity = async (activityId, score, notes = '') => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      const token = localStorage.getItem('authToken');
      
      const response = await axios.post(`${API_URL}/api/activities/${activityId}/complete`, {
        student_id: userData.id,
        score: parseFloat(score),
        student_notes: notes
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const { status, passed } = response.data;
      
      Swal.fire({
        title: passed ? '¡Felicitaciones!' : 'Intenta de nuevo',
        text: passed ? 'Has completado la actividad exitosamente' : 'No alcanzaste la nota mínima requerida',
        icon: passed ? 'success' : 'warning',
        confirmButtonText: 'Entendido'
      });
      
      fetchActivities();
    } catch (error) {
      console.error('Error al completar actividad:', error);
      Swal.fire('Error', 'No se pudo completar la actividad', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      indicator_id: '',
      questionnaire_id: '',
      activity_type: 'quiz',
      title: '',
      description: '',
      instructions: '',
      due_date: '',
      max_attempts: 3,
      passing_score: 3.5,
      weight: 1.00
    });
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'quiz': return <Target className="w-5 h-5" />;
      case 'assignment': return <Edit className="w-5 h-5" />;
      case 'presentation': return <Target className="w-5 h-5" />;
      case 'project': return <Target className="w-5 h-5" />;
      case 'exercise': return <Edit className="w-5 h-5" />;
      case 'discussion': return <Target className="w-5 h-5" />;
      default: return <Target className="w-5 h-5" />;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-success" />;
      case 'failed': return <XCircle className="w-5 h-5 text-danger" />;
      case 'in_progress': return <Clock className="w-5 h-5 text-warning" />;
      case 'overdue': return <AlertCircle className="w-5 h-5 text-danger" />;
      default: return <Clock className="w-5 h-5 text-secondary" />;
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

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date() && dueDate;
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="recovery-activities-manager">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">
          <Target className="me-2" />
          Actividades de Recuperación
        </h5>
        {!isStudent && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 me-1" />
            Agregar Actividad
          </button>
        )}
      </div>

      {/* Formulario para crear/editar actividades */}
      {showForm && !isStudent && (
        <div className="card mb-4">
          <div className="card-header">
            <h6 className="mb-0">
              {editingActivity ? 'Editar Actividad' : 'Nueva Actividad'}
            </h6>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Tipo de Actividad</label>
                  <select
                    className="form-select"
                    value={formData.activity_type}
                    onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                    required
                  >
                    <option value="quiz">Cuestionario</option>
                    <option value="assignment">Tarea</option>
                    <option value="presentation">Presentación</option>
                    <option value="project">Proyecto</option>
                    <option value="exercise">Ejercicio</option>
                    <option value="discussion">Discusión</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Fecha Límite</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Título</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="Título de la actividad"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    placeholder="Descripción de la actividad"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Instrucciones</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    placeholder="Instrucciones específicas para el estudiante"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Máximo Intentos</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.max_attempts}
                    onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) })}
                    min="1"
                    max="10"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Nota Mínima</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.passing_score}
                    onChange={(e) => setFormData({ ...formData, passing_score: parseFloat(e.target.value) })}
                    min="0"
                    max="5"
                    step="0.1"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Peso</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                    min="0.1"
                    max="2.0"
                    step="0.1"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Indicador Relacionado</label>
                  <select
                    className="form-select"
                    value={formData.indicator_id}
                    onChange={(e) => setFormData({ ...formData, indicator_id: e.target.value })}
                  >
                    <option value="">Seleccionar indicador</option>
                    {indicators.map(indicator => (
                      <option key={indicator.id} value={indicator.id}>
                        {indicator.description} - {indicator.subject}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Cuestionario Relacionado</label>
                  <select
                    className="form-select"
                    value={formData.questionnaire_id}
                    onChange={(e) => setFormData({ ...formData, questionnaire_id: e.target.value })}
                  >
                    <option value="">Seleccionar cuestionario</option>
                    {questionnaires.map(questionnaire => (
                      <option key={questionnaire.id} value={questionnaire.id}>
                        {questionnaire.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <button type="submit" className="btn btn-primary me-2" disabled={loading}>
                  {loading ? 'Guardando...' : (editingActivity ? 'Actualizar' : 'Crear')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingActivity(null);
                    resetForm();
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de actividades */}
      <div className="row">
        {activities.length === 0 ? (
          <div className="col-12">
            <div className="alert alert-info text-center">
              <Target className="w-5 h-5 mb-2" />
              <p className="mb-0">No hay actividades disponibles para este plan de recuperación.</p>
            </div>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="col-md-6 col-lg-4 mb-3">
              <div className="card h-100">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-start mb-2">
                    <span className="text-primary me-2">
                      {getActivityIcon(activity.activity_type)}
                    </span>
                    <div className="flex-grow-1">
                      <h6 className="card-title mb-1">{activity.title}</h6>
                      <div className="d-flex align-items-center gap-2 mb-2">
                        {getStatusIcon(activity.status)}
                        <span className={`badge badge-${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </span>
                        {isOverdue(activity.due_date) && activity.status !== 'completed' && (
                          <span className="badge badge-danger">Vencida</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <p className="card-text text-muted small mb-2">
                    {activity.description}
                  </p>
                  
                  <div className="mt-auto">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <small className="text-muted">
                        <Calendar className="w-4 h-4 me-1" />
                        {new Date(activity.due_date).toLocaleDateString()}
                      </small>
                      <small className="text-muted">
                        {activity.attempts_count}/{activity.max_attempts} intentos
                      </small>
                    </div>
                    
                    {activity.student_score !== null && (
                      <div className="mb-2">
                        <small className="text-muted">Nota: </small>
                        <span className={`fw-bold ${activity.student_score >= activity.passing_score ? 'text-success' : 'text-danger'}`}>
                          {activity.student_score.toFixed(1)} / {activity.passing_score}
                        </span>
                      </div>
                    )}
                    
                    <div className="d-flex gap-2">
                      {isStudent ? (
                        activity.status === 'completed' ? (
                          <span className="btn btn-success btn-sm flex-grow-1 disabled">
                            <CheckCircle className="w-4 h-4 me-1" />
                            Completada
                          </span>
                        ) : activity.attempts_count < activity.max_attempts ? (
                          <button
                            className="btn btn-primary btn-sm flex-grow-1"
                            onClick={() => {
                              Swal.fire({
                                title: 'Completar Actividad',
                                html: `
                                  <div class="mb-3">
                                    <label class="form-label">Nota obtenida:</label>
                                    <input type="number" id="score" class="form-control" min="0" max="5" step="0.1" required>
                                  </div>
                                  <div class="mb-3">
                                    <label class="form-label">Comentarios (opcional):</label>
                                    <textarea id="notes" class="form-control" rows="3"></textarea>
                                  </div>
                                `,
                                showCancelButton: true,
                                confirmButtonText: 'Completar',
                                cancelButtonText: 'Cancelar',
                                preConfirm: () => {
                                  const score = document.getElementById('score').value;
                                  const notes = document.getElementById('notes').value;
                                  if (!score) {
                                    Swal.showValidationMessage('La nota es requerida');
                                    return false;
                                  }
                                  return { score, notes };
                                }
                              }).then((result) => {
                                if (result.isConfirmed) {
                                  handleCompleteActivity(activity.id, result.value.score, result.value.notes);
                                }
                              });
                            }}
                          >
                            Completar
                          </button>
                        ) : (
                          <span className="btn btn-secondary btn-sm flex-grow-1 disabled">
                            Sin intentos disponibles
                          </span>
                        )
                      ) : (
                        <>
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => handleEdit(activity)}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleDelete(activity.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecoveryActivitiesManager;
