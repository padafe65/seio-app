// client/src/components/RecoveryResourcesManager.js
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Play, FileText, Link, BookOpen, CheckCircle, Clock } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const RecoveryResourcesManager = ({ improvementPlanId, isStudent = false }) => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [formData, setFormData] = useState({
    resource_type: 'video',
    title: '',
    description: '',
    url: '',
    file_path: '',
    thumbnail_url: '',
    duration_minutes: '',
    difficulty_level: 'basic',
    order_index: 0,
    is_required: true
  });

  // Cargar recursos
  useEffect(() => {
    if (improvementPlanId) {
      fetchResources();
    }
  }, [improvementPlanId]);

  const fetchResources = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/api/improvement-plans/${improvementPlanId}/resources`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setResources(response.data);
    } catch (error) {
      console.error('Error al cargar recursos:', error);
      Swal.fire('Error', 'No se pudieron cargar los recursos', 'error');
    } finally {
      setLoading(false);
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

      if (editingResource) {
        // Actualizar recurso existente
        await axios.put(`${API_URL}/api/resources/${editingResource.id}`, formData, config);
        Swal.fire('Éxito', 'Recurso actualizado correctamente', 'success');
      } else {
        // Crear nuevo recurso
        await axios.post(`${API_URL}/api/improvement-plans/${improvementPlanId}/resources`, formData, config);
        Swal.fire('Éxito', 'Recurso creado correctamente', 'success');
      }

      setShowForm(false);
      setEditingResource(null);
      setFormData({
        resource_type: 'video',
        title: '',
        description: '',
        url: '',
        file_path: '',
        thumbnail_url: '',
        duration_minutes: '',
        difficulty_level: 'basic',
        order_index: 0,
        is_required: true
      });
      fetchResources();
    } catch (error) {
      console.error('Error al guardar recurso:', error);
      Swal.fire('Error', 'No se pudo guardar el recurso', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (resource) => {
    setEditingResource(resource);
    setFormData({
      resource_type: resource.resource_type,
      title: resource.title,
      description: resource.description || '',
      url: resource.url,
      file_path: resource.file_path || '',
      thumbnail_url: resource.thumbnail_url || '',
      duration_minutes: resource.duration_minutes || '',
      difficulty_level: resource.difficulty_level,
      order_index: resource.order_index,
      is_required: resource.is_required
    });
    setShowForm(true);
  };

  const handleDelete = async (resourceId) => {
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
        await axios.delete(`${API_URL}/api/resources/${resourceId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        Swal.fire('Eliminado', 'El recurso ha sido eliminado', 'success');
        fetchResources();
      } catch (error) {
        console.error('Error al eliminar recurso:', error);
        Swal.fire('Error', 'No se pudo eliminar el recurso', 'error');
      }
    }
  };

  const handleMarkAsViewed = async (resourceId) => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      const token = localStorage.getItem('authToken');
      
      await axios.post(`${API_URL}/api/resources/${resourceId}/viewed`, {
        student_id: userData.id,
        completion_percentage: 100
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      Swal.fire('Éxito', 'Recurso marcado como visto', 'success');
      fetchResources();
    } catch (error) {
      console.error('Error al marcar como visto:', error);
      Swal.fire('Error', 'No se pudo marcar como visto', 'error');
    }
  };

  const getResourceIcon = (type) => {
    switch (type) {
      case 'video': return <Play className="w-5 h-5" />;
      case 'document': return <FileText className="w-5 h-5" />;
      case 'link': return <Link className="w-5 h-5" />;
      case 'quiz': return <BookOpen className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getDifficultyColor = (level) => {
    switch (level) {
      case 'basic': return 'badge-success';
      case 'intermediate': return 'badge-warning';
      case 'advanced': return 'badge-danger';
      default: return 'badge-secondary';
    }
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
    <div className="recovery-resources-manager">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">
          <BookOpen className="me-2" />
          Recursos de Recuperación
        </h5>
        {!isStudent && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 me-1" />
            Agregar Recurso
          </button>
        )}
      </div>

      {/* Formulario para crear/editar recursos */}
      {showForm && !isStudent && (
        <div className="card mb-4">
          <div className="card-header">
            <h6 className="mb-0">
              {editingResource ? 'Editar Recurso' : 'Nuevo Recurso'}
            </h6>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Tipo de Recurso</label>
                  <select
                    className="form-select"
                    value={formData.resource_type}
                    onChange={(e) => setFormData({ ...formData, resource_type: e.target.value })}
                    required
                  >
                    <option value="video">Video</option>
                    <option value="document">Documento</option>
                    <option value="link">Enlace</option>
                    <option value="quiz">Cuestionario</option>
                    <option value="exercise">Ejercicio</option>
                    <option value="presentation">Presentación</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Nivel de Dificultad</label>
                  <select
                    className="form-select"
                    value={formData.difficulty_level}
                    onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                  >
                    <option value="basic">Básico</option>
                    <option value="intermediate">Intermedio</option>
                    <option value="advanced">Avanzado</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Título</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="Título del recurso"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción del recurso"
                  />
                </div>
                <div className="col-md-8">
                  <label className="form-label">URL o Enlace</label>
                  <input
                    type="url"
                    className="form-control"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required
                    placeholder="https://..."
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Duración (minutos)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">URL de Miniatura</label>
                  <input
                    type="url"
                    className="form-control"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Orden</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.order_index}
                    onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>
                <div className="col-12">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formData.is_required}
                      onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    />
                    <label className="form-check-label">
                      Recurso obligatorio
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <button type="submit" className="btn btn-primary me-2" disabled={loading}>
                  {loading ? 'Guardando...' : (editingResource ? 'Actualizar' : 'Crear')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingResource(null);
                    setFormData({
                      resource_type: 'video',
                      title: '',
                      description: '',
                      url: '',
                      file_path: '',
                      thumbnail_url: '',
                      duration_minutes: '',
                      difficulty_level: 'basic',
                      order_index: 0,
                      is_required: true
                    });
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de recursos */}
      <div className="row">
        {resources.length === 0 ? (
          <div className="col-12">
            <div className="alert alert-info text-center">
              <BookOpen className="w-5 h-5 mb-2" />
              <p className="mb-0">No hay recursos disponibles para este plan de recuperación.</p>
            </div>
          </div>
        ) : (
          resources.map((resource) => (
            <div key={resource.id} className="col-md-6 col-lg-4 mb-3">
              <div className="card h-100">
                {resource.thumbnail_url && (
                  <img
                    src={resource.thumbnail_url}
                    className="card-img-top"
                    alt={resource.title}
                    style={{ height: '150px', objectFit: 'cover' }}
                  />
                )}
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-start mb-2">
                    <span className="text-primary me-2">
                      {getResourceIcon(resource.resource_type)}
                    </span>
                    <div className="flex-grow-1">
                      <h6 className="card-title mb-1">{resource.title}</h6>
                      <span className={`badge ${getDifficultyColor(resource.difficulty_level)} me-2`}>
                        {resource.difficulty_level}
                      </span>
                      {resource.is_required && (
                        <span className="badge badge-warning">Obligatorio</span>
                      )}
                    </div>
                  </div>
                  
                  {resource.description && (
                    <p className="card-text text-muted small mb-2">
                      {resource.description}
                    </p>
                  )}
                  
                  <div className="mt-auto">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      {resource.duration_minutes && (
                        <small className="text-muted">
                          <Clock className="w-4 h-4 me-1" />
                          {resource.duration_minutes} min
                        </small>
                      )}
                      {resource.viewed && (
                        <small className="text-success">
                          <CheckCircle className="w-4 h-4 me-1" />
                          Visto
                        </small>
                      )}
                    </div>
                    
                    <div className="d-flex gap-2">
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm flex-grow-1"
                      >
                        {resource.resource_type === 'video' ? 'Ver Video' : 'Abrir'}
                      </a>
                      
                      {isStudent && !resource.viewed && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleMarkAsViewed(resource.id)}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      
                      {!isStudent && (
                        <>
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => handleEdit(resource)}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleDelete(resource.id)}
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

export default RecoveryResourcesManager;
