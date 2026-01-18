// pages/educational-resources/EducationalResourceForm.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { Save, X } from 'lucide-react';

const EducationalResourceForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  
  const [formData, setFormData] = useState({
    subject: '',
    area: '',
    topic: '',
    title: '',
    description: '',
    url: '',
    resource_type: 'otro',
    grade_level: '',
    phase: '',
    difficulty: 'intermedio',
    institution_id: '',
    is_active: true
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (isEditing) {
      fetchResource();
    }
  }, [id, isEditing]);
  
  const fetchResource = async () => {
    try {
      setLoading(true);
      const response = await axiosClient.get(`/educational-resources/${id}`);
      const resource = response.data.data;
      
      setFormData({
        subject: resource.subject || '',
        area: resource.area || '',
        topic: resource.topic || '',
        title: resource.title || '',
        description: resource.description || '',
        url: resource.url || '',
        resource_type: resource.resource_type || 'otro',
        grade_level: resource.grade_level || '',
        phase: resource.phase || '',
        difficulty: resource.difficulty || 'intermedio',
        institution_id: resource.institution_id || '',
        is_active: resource.is_active !== undefined ? resource.is_active : true
      });
    } catch (error) {
      console.error('Error al cargar recurso:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el recurso educativo'
      });
      navigate('/recursos-educativos');
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Validaciones
    if (!formData.subject || !formData.area || !formData.title || !formData.url) {
      setError('Los campos Materia, Área, Título y URL son obligatorios');
      return;
    }
    
    // Validar URL
    try {
      new URL(formData.url);
    } catch (error) {
      setError('La URL no es válida');
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        ...formData,
        phase: formData.phase || null,
        grade_level: formData.grade_level || null,
        institution_id: formData.institution_id || null,
        topic: formData.topic || null,
        description: formData.description || null
      };
      
      if (isEditing) {
        await axiosClient.put(`/educational-resources/${id}`, payload);
        Swal.fire('Actualizado', 'El recurso educativo ha sido actualizado exitosamente', 'success');
      } else {
        await axiosClient.post('/educational-resources', payload);
        Swal.fire('Creado', 'El recurso educativo ha sido creado exitosamente', 'success');
      }
      
      navigate('/recursos-educativos');
    } catch (error) {
      console.error('Error al guardar recurso:', error);
      setError(error.response?.data?.message || 'Error al guardar el recurso educativo');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo guardar el recurso educativo'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const subjects = ['Matemáticas', 'Español', 'Ciencias', 'Sociales', 'Inglés', 'Arte', 'Educación Física'];
  const mathAreas = ['Aritmética', 'Geometría', 'Álgebra', 'Estadística', 'Trigonometría', 'Cálculo'];
  const spanishAreas = ['Gramática', 'Interpretación de Textos', 'Literatura', 'Ortografía'];
  const areas = formData.subject === 'Matemáticas' ? mathAreas : 
                formData.subject === 'Español' ? spanishAreas : 
                ['General'];
  
  if (loading && isEditing) {
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
      <div className="row">
        <div className="col-lg-8 mx-auto">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>{isEditing ? 'Editar Recurso Educativo' : 'Nuevo Recurso Educativo'}</h2>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/recursos-educativos')}
            >
              <X size={18} className="me-2" />
              Cancelar
            </button>
          </div>
          
          {error && (
            <div className="alert alert-danger">{error}</div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Información Básica</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Materia <span className="text-danger">*</span></label>
                    <select
                      className="form-select"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Seleccione una materia</option>
                      {subjects.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Área <span className="text-danger">*</span></label>
                    <select
                      className="form-select"
                      name="area"
                      value={formData.area}
                      onChange={handleChange}
                      required
                      disabled={!formData.subject}
                    >
                      <option value="">Seleccione un área</option>
                      {areas.map(area => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-md-12">
                    <label className="form-label">Tema (Opcional)</label>
                    <input
                      type="text"
                      className="form-control"
                      name="topic"
                      value={formData.topic}
                      onChange={handleChange}
                      placeholder="Ej: Sistemas Numéricos, Interpretación de Textos"
                    />
                  </div>
                  
                  <div className="col-md-12">
                    <label className="form-label">Título <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      placeholder="Título del recurso educativo"
                    />
                  </div>
                  
                  <div className="col-md-12">
                    <label className="form-label">Descripción (Opcional)</label>
                    <textarea
                      className="form-control"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows="3"
                      placeholder="Descripción detallada del recurso"
                    />
                  </div>
                  
                  <div className="col-md-12">
                    <label className="form-label">URL <span className="text-danger">*</span></label>
                    <input
                      type="url"
                      className="form-control"
                      name="url"
                      value={formData.url}
                      onChange={handleChange}
                      required
                      placeholder="https://ejemplo.com/recurso"
                    />
                    <small className="form-text text-muted">
                      Enlace al recurso educativo (ej: video de YouTube, artículo, guía PDF)
                    </small>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="card mt-3">
              <div className="card-header">
                <h5 className="mb-0">Configuración</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Tipo de Recurso</label>
                    <select
                      className="form-select"
                      name="resource_type"
                      value={formData.resource_type}
                      onChange={handleChange}
                    >
                      <option value="video">Video</option>
                      <option value="articulo">Artículo</option>
                      <option value="ejercicio">Ejercicio</option>
                      <option value="simulador">Simulador</option>
                      <option value="guia">Guía</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Nivel de Grado</label>
                    <select
                      className="form-select"
                      name="grade_level"
                      value={formData.grade_level}
                      onChange={handleChange}
                    >
                      <option value="">Todos</option>
                      <option value="6-9">6° - 9°</option>
                      <option value="10-11">10° - 11°</option>
                      <option value="6">6°</option>
                      <option value="7">7°</option>
                      <option value="8">8°</option>
                      <option value="9">9°</option>
                      <option value="10">10°</option>
                      <option value="11">11°</option>
                    </select>
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Fase</label>
                    <select
                      className="form-select"
                      name="phase"
                      value={formData.phase}
                      onChange={handleChange}
                    >
                      <option value="">Todas las fases</option>
                      <option value="1">Fase 1</option>
                      <option value="2">Fase 2</option>
                      <option value="3">Fase 3</option>
                      <option value="4">Fase 4</option>
                    </select>
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Dificultad</label>
                    <select
                      className="form-select"
                      name="difficulty"
                      value={formData.difficulty}
                      onChange={handleChange}
                    >
                      <option value="basico">Básico</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </div>
                  
                  {isEditing && (
                    <div className="col-md-4">
                      <label className="form-label">Estado</label>
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={handleChange}
                          id="isActiveSwitch"
                        />
                        <label className="form-check-label" htmlFor="isActiveSwitch">
                          {formData.is_active ? 'Activo' : 'Inactivo'}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-4 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/recursos-educativos')}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                <Save size={18} className="me-2" />
                {loading ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EducationalResourceForm;
