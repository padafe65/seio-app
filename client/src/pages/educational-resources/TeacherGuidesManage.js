// pages/educational-resources/TeacherGuidesManage.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { PlusCircle, Edit, Trash2, FileText, ExternalLink, Download } from 'lucide-react';

const TeacherGuidesManage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingGuide, setEditingGuide] = useState(null);
  const [formData, setFormData] = useState({
    subject: '',
    area: '',
    title: '',
    description: '',
    url: '',
    grade_level: '',
    phase: '',
    file: null
  });

  useEffect(() => {
    fetchMyGuides();
  }, []);

  const fetchMyGuides = async () => {
    try {
      setLoading(true);
      const response = await axiosClient.get('/educational-resources/my');
      setGuides(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar guías:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar tus guías de estudio'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (guide) => {
    setEditingGuide(guide);
    setFormData({
      subject: guide.subject || '',
      area: guide.area || '',
      title: guide.title || '',
      description: guide.description || '',
      url: guide.url || '',
      grade_level: guide.grade_level || '',
      phase: guide.phase || '',
      file: null
    });
  };

  const handleCancelEdit = () => {
    setEditingGuide(null);
    setFormData({
      subject: '',
      area: '',
      title: '',
      description: '',
      url: '',
      grade_level: '',
      phase: '',
      file: null
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      const updateData = {
        subject: formData.subject,
        area: formData.area,
        title: formData.title,
        description: formData.description,
        url: formData.url || null,
        grade_level: formData.grade_level || null,
        phase: formData.phase ? parseInt(formData.phase) : null,
        resource_type: 'guia'
      };

      await axiosClient.put(`/educational-resources/${editingGuide.id}`, updateData);
      
      Swal.fire('Actualizado', 'La guía ha sido actualizada exitosamente', 'success');
      handleCancelEdit();
      fetchMyGuides();
    } catch (error) {
      console.error('Error al actualizar guía:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo actualizar la guía'
      });
    }
  };

  const handleDelete = async (id, title) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar la guía "${title}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await axiosClient.delete(`/educational-resources/${id}`);
        Swal.fire('Eliminada', 'La guía ha sido eliminada exitosamente', 'success');
        fetchMyGuides();
      } catch (error) {
        console.error('Error al eliminar guía:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.message || 'No se pudo eliminar la guía'
        });
      }
    }
  };

  const handleDownload = async (fileUrl, title) => {
    // Construir URL completa del backend
    // Si ya es una URL completa (http/https), usarla directamente
    // Si es relativa, construirla con la URL del API
    let fullUrl;
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      fullUrl = fileUrl;
    } else {
      // Obtener la URL base del API desde axiosClient
      const apiBaseUrl = axiosClient.defaults.baseURL || 'http://localhost:5000/api';
      // Remover /api del final si está presente para obtener la URL base del servidor
      const serverBaseUrl = apiBaseUrl.replace('/api', '');
      // Construir URL completa del archivo
      fullUrl = `${serverBaseUrl}${fileUrl.startsWith('/') ? fileUrl : '/' + fileUrl}`;
    }
    
    console.log('📄 Abriendo PDF:', fullUrl);
    
    // Primero, abrir el PDF en una nueva pestaña para vista previa
    const previewWindow = window.open(fullUrl, '_blank', 'width=1200,height=800');
    
    if (!previewWindow) {
      // Si el navegador bloqueó la ventana emergente, mostrar modal alternativo
      Swal.fire({
        title: 'Vista Previa',
        html: `
          <div style="text-align: center; padding: 20px;">
            <p>El navegador bloqueó la ventana emergente.</p>
            <p>Por favor, permite ventanas emergentes para este sitio o haz clic en el botón para abrir el PDF directamente.</p>
          </div>
        `,
        showCancelButton: true,
        showConfirmButton: true,
        confirmButtonText: '<i class="fas fa-external-link-alt"></i> Abrir PDF',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#198754',
        cancelButtonColor: '#6c757d',
      }).then((result) => {
        if (result.isConfirmed) {
          window.open(fullUrl, '_blank');
        }
      });
      return;
    }

    // Mostrar opciones después de abrir la vista previa
    const result = await Swal.fire({
      title: `Vista Previa: ${title}`,
      html: `
        <div style="text-align: center; padding: 20px;">
          <p><strong>El PDF se ha abierto en una nueva pestaña.</strong></p>
          <p>Revisa el PDF en la ventana que se abrió.</p>
          <p>¿Deseas descargar una copia del PDF?</p>
        </div>
      `,
      showCancelButton: true,
      showConfirmButton: true,
      confirmButtonText: '<i class="fas fa-download"></i> Sí, descargar PDF',
      cancelButtonText: 'Solo ver (Cerrar)',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      allowOutsideClick: true,
      allowEscapeKey: true
    });

    if (result.isConfirmed) {
      // Si el usuario confirma, descargar el PDF
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      Swal.fire({
        icon: 'success',
        title: 'Descargando',
        text: 'El PDF se está descargando...',
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      // Si cancela, no hacer nada (el PDF ya está abierto en otra pestaña)
      Swal.fire({
        icon: 'info',
        title: 'Vista previa abierta',
        text: 'El PDF permanece abierto en otra pestaña.',
        timer: 2000,
        showConfirmButton: false
      });
    }
  };

  if (loading) {
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
      <style>{`
        .swal-wide {
          width: 90% !important;
          max-width: 1200px !important;
        }
        .swal2-html-container {
          padding: 0 !important;
          margin: 0 !important;
        }
        .swal2-html-container iframe {
          min-height: 600px;
        }
        @media (max-width: 768px) {
          .swal-wide {
            width: 95% !important;
          }
          .swal2-html-container iframe {
            min-height: 400px;
          }
        }
      `}</style>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
        <h2 className="mb-3 mb-md-0">
          <FileText className="me-2" size={28} />
          Mis Guías de Estudio
        </h2>
        <Link to="/subir-guia" className="btn btn-primary w-100 w-md-auto">
          <PlusCircle size={18} className="me-2" />
          Nueva Guía
        </Link>
      </div>

      {guides.length === 0 ? (
        <div className="alert alert-info">
          <h5>No tienes guías de estudio aún</h5>
          <p>Comienza a crear guías para tus estudiantes haciendo clic en "Nueva Guía".</p>
          <Link to="/subir-guia" className="btn btn-primary mt-2">
            <PlusCircle size={18} className="me-2" />
            Crear Primera Guía
          </Link>
        </div>
      ) : (
        <>
          <div className="alert alert-info mb-4">
            <strong>Total de guías:</strong> {guides.length}
          </div>

          {/* Formulario de edición */}
          {editingGuide && (
            <div className="card mb-4 border-primary">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">Editar Guía: {editingGuide.title}</h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleUpdate}>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Materia *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Área</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.area}
                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Título *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Descripción</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Grado</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.grade_level}
                        onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                        placeholder="Ej: 7, 8-9, Todos"
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Fase</label>
                      <select
                        className="form-select"
                        value={formData.phase}
                        onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                      >
                        <option value="">Seleccionar fase</option>
                        <option value="1">Fase 1</option>
                        <option value="2">Fase 2</option>
                        <option value="3">Fase 3</option>
                        <option value="4">Fase 4</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label">URL Externa (opcional)</label>
                      <input
                        type="url"
                        className="form-control"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="col-12">
                      <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-success">
                          <Edit size={18} className="me-2" />
                          Guardar Cambios
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Lista de guías */}
          <div className="row g-3">
            {guides.map((guide) => (
              <div key={guide.id} className="col-12 col-md-6 col-lg-4">
                <div className="card h-100">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <small className="badge bg-primary">{guide.subject}</small>
                    {guide.phase && (
                      <small className="badge bg-info">Fase {guide.phase}</small>
                    )}
                  </div>
                  <div className="card-body">
                    <h5 className="card-title">{guide.title}</h5>
                    {guide.area && (
                      <p className="text-muted mb-2"><small>Área: {guide.area}</small></p>
                    )}
                    {guide.grade_level && (
                      <p className="text-muted mb-2"><small>Grado: {guide.grade_level}</small></p>
                    )}
                    {guide.description && (
                      <p className="card-text">{guide.description.substring(0, 100)}...</p>
                    )}
                    <div className="mt-2">
                      {guide.file_path && guide.file_url && (
                        <button
                          className="btn btn-sm btn-outline-primary me-2 mb-2"
                          onClick={() => handleDownload(guide.file_url, guide.title)}
                          title="Descargar PDF"
                        >
                          <Download size={16} className="me-1" />
                          PDF
                        </button>
                      )}
                      {guide.url && (
                        <a
                          href={guide.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-success me-2 mb-2"
                          title="Ver enlace externo"
                        >
                          <ExternalLink size={16} className="me-1" />
                          Enlace
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="card-footer bg-light">
                    <div className="d-flex justify-content-between">
                      <small className="text-muted">
                        {new Date(guide.created_at).toLocaleDateString()}
                      </small>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleEdit(guide)}
                          title="Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(guide.id, guide.title)}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherGuidesManage;
