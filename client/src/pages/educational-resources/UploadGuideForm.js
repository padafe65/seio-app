// pages/educational-resources/UploadGuideForm.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { Upload, X, FileText, Link as LinkIcon } from 'lucide-react';

const UploadGuideForm = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    subject: '',
    area: '',
    topic: '',
    title: '',
    description: '',
    url: '', // URL complementaria opcional
    grade_level: '',
    phase: '',
    difficulty: 'intermedio'
  });
  
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const subjects = ['Matemáticas', 'Español', 'Ciencias', 'Sociales', 'Inglés', 'Arte', 'Educación Física'];
  const mathAreas = ['Aritmética', 'Geometría', 'Álgebra', 'Estadística', 'Trigonometría', 'Cálculo'];
  const spanishAreas = ['Gramática', 'Interpretación de Textos', 'Literatura', 'Ortografía'];
  const areas = formData.subject === 'Matemáticas' ? mathAreas : 
                formData.subject === 'Español' ? spanishAreas : 
                ['General'];
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Solo se permiten archivos PDF');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('El archivo no debe exceder 10MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Validaciones
    if (!formData.subject || !formData.area || !formData.title) {
      setError('Los campos Materia, Área y Título son obligatorios');
      return;
    }
    
    if (!file) {
      setError('Debe subir un archivo PDF');
      return;
    }
    
    // Validar URL complementaria si se proporciona
    if (formData.url) {
      try {
        new URL(formData.url);
      } catch (error) {
        setError('La URL complementaria no es válida');
        return;
      }
    }
    
    try {
      setLoading(true);
      
      // Crear FormData para enviar archivo
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);
      formDataToSend.append('subject', formData.subject);
      formDataToSend.append('area', formData.area);
      formDataToSend.append('title', formData.title);
      
      if (formData.topic) formDataToSend.append('topic', formData.topic);
      if (formData.description) formDataToSend.append('description', formData.description);
      if (formData.url) formDataToSend.append('url', formData.url);
      if (formData.grade_level) formDataToSend.append('grade_level', formData.grade_level);
      if (formData.phase) formDataToSend.append('phase', formData.phase);
      if (formData.difficulty) formDataToSend.append('difficulty', formData.difficulty);
      
      const response = await axiosClient.post('/educational-resources/upload-guide', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      Swal.fire({
        icon: 'success',
        title: '¡Guía subida exitosamente!',
        text: 'La guía de estudio ha sido subida y está disponible para tus estudiantes',
        confirmButtonText: 'Aceptar'
      });
      
      // Redirigir al dashboard o a la lista de recursos
      navigate('/dashboard');
      
    } catch (error) {
      console.error('Error al subir guía:', error);
      setError(error.response?.data?.message || 'Error al subir la guía de estudio');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo subir la guía de estudio'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container py-4">
      <div className="row">
        <div className="col-lg-8 mx-auto">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>
              <FileText size={24} className="me-2" />
              Subir Guía de Estudio
            </h2>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/dashboard')}
            >
              <X size={18} className="me-2" />
              Cancelar
            </button>
          </div>
          
          {error && (
            <div className="alert alert-danger">{error}</div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="card mb-3">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">
                  <Upload size={18} className="me-2" />
                  Archivo PDF
                </h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">
                    Seleccionar archivo PDF <span className="text-danger">*</span>
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    required
                  />
                  <small className="form-text text-muted">
                    Tamaño máximo: 10MB. Solo archivos PDF.
                  </small>
                  {file && (
                    <div className="mt-2">
                      <div className="alert alert-info d-flex align-items-center">
                        <FileText size={18} className="me-2" />
                        <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="card mb-3">
              <div className="card-header">
                <h5 className="mb-0">Información de la Guía</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">
                      Materia <span className="text-danger">*</span>
                    </label>
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
                    <label className="form-label">
                      Área <span className="text-danger">*</span>
                    </label>
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
                    <label className="form-label">
                      Título <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      placeholder="Título de la guía de estudio"
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
                      placeholder="Descripción de la guía de estudio"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="card mb-3">
              <div className="card-header">
                <h5 className="mb-0">Configuración</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
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
                </div>
              </div>
            </div>
            
            <div className="card mb-3">
              <div className="card-header">
                <h5 className="mb-0">
                  <LinkIcon size={18} className="me-2" />
                  Enlace Complementario (Opcional)
                </h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">URL de recurso complementario</label>
                  <input
                    type="url"
                    className="form-control"
                    name="url"
                    value={formData.url}
                    onChange={handleChange}
                    placeholder="https://youtube.com/watch?v=... o https://ejemplo.com/guia"
                  />
                  <small className="form-text text-muted">
                    Puedes agregar un enlace externo como material complementario (ej: video de YouTube, artículo, etc.)
                  </small>
                </div>
              </div>
            </div>
            
            <div className="mt-4 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard')}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                <Upload size={18} className="me-2" />
                {loading ? 'Subiendo...' : 'Subir Guía'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UploadGuideForm;
