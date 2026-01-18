// pages/educational-resources/EducationalResourcesList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { PlusCircle, Edit, Trash2, Eye, EyeOff, BookOpen, ExternalLink } from 'lucide-react';

const EducationalResourcesList = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    subject: '',
    area: '',
    grade_level: '',
    phase: '',
    difficulty: '',
    resource_type: '',
    is_active: 'all'
  });
  
  useEffect(() => {
    fetchResources();
  }, [filters]);
  
  const fetchResources = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value);
        }
      });
      
      const response = await axiosClient.get(`/educational-resources/all?${params.toString()}`);
      setResources(response.data.data || []);
      setError(null);
    } catch (error) {
      console.error('Error al cargar recursos:', error);
      setError('Error al cargar recursos educativos');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los recursos educativos'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (id, title) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas desactivar el recurso "${title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await axiosClient.delete(`/educational-resources/${id}`);
        Swal.fire('Desactivado', 'El recurso ha sido desactivado exitosamente', 'success');
        fetchResources();
      } catch (error) {
        console.error('Error al eliminar recurso:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo desactivar el recurso'
        });
      }
    }
  };
  
  const handleToggleActive = async (id, isActive) => {
    try {
      await axiosClient.put(`/educational-resources/${id}`, { is_active: !isActive });
      Swal.fire('Actualizado', `El recurso ha sido ${!isActive ? 'activado' : 'desactivado'}`, 'success');
      fetchResources();
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo actualizar el estado del recurso'
      });
    }
  };
  
  const getResourceTypeIcon = (type) => {
    switch (type) {
      case 'video': return '▶️';
      case 'articulo': return '📄';
      case 'ejercicio': return '✏️';
      case 'simulador': return '🎮';
      case 'guia': return '📚';
      default: return '📖';
    }
  };
  
  const getDifficultyBadgeClass = (difficulty) => {
    switch (difficulty) {
      case 'basico': return 'bg-success';
      case 'intermedio': return 'bg-warning';
      case 'avanzado': return 'bg-danger';
      default: return 'bg-secondary';
    }
  };
  
  const getDifficultyText = (difficulty) => {
    switch (difficulty) {
      case 'basico': return 'Básico';
      case 'intermedio': return 'Intermedio';
      case 'avanzado': return 'Avanzado';
      default: return difficulty;
    }
  };
  
  // Obtener valores únicos para los filtros
  const subjects = [...new Set(resources.map(r => r.subject))].filter(Boolean).sort();
  const areas = [...new Set(resources.map(r => r.area))].filter(Boolean).sort();
  
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
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
        <h2 className="mb-3 mb-md-0">
          <BookOpen className="me-2" size={28} />
          Gestión de Recursos Educativos
        </h2>
        <Link to="/recursos-educativos/nuevo" className="btn btn-primary w-100 w-md-auto">
          <PlusCircle size={18} className="me-2" />
          Nuevo Recurso
        </Link>
      </div>
      
      {/* Mensaje de derechos de autor */}
      <div className="alert alert-info d-flex align-items-start mb-4" role="alert">
        <div className="me-2" style={{ fontSize: '1.2rem' }}>ℹ️</div>
        <div>
          <strong>Importante:</strong> El material educativo disponible en este sistema tiene derechos de autor. 
          Se respeta la autoría y se utilizan únicamente recursos educativos de libre acceso o con licencias que permiten su uso educativo. 
          Por favor, respeta los términos de uso de cada recurso al acceder a ellos.
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger">{error}</div>
      )}
      
      {/* Filtros */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">Filtros</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label">Materia</label>
              <select
                className="form-select"
                value={filters.subject}
                onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
              >
                <option value="">Todas</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label">Área</label>
              <select
                className="form-select"
                value={filters.area}
                onChange={(e) => setFilters({ ...filters, area: e.target.value })}
              >
                <option value="">Todas</option>
                {areas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-sm-4 col-md-2">
              <label className="form-label">Fase</label>
              <select
                className="form-select"
                value={filters.phase}
                onChange={(e) => setFilters({ ...filters, phase: e.target.value })}
              >
                <option value="">Todas</option>
                <option value="1">Fase 1</option>
                <option value="2">Fase 2</option>
                <option value="3">Fase 3</option>
                <option value="4">Fase 4</option>
              </select>
            </div>
            <div className="col-6 col-sm-4 col-md-2">
              <label className="form-label">Dificultad</label>
              <select
                className="form-select"
                value={filters.difficulty}
                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
              >
                <option value="">Todas</option>
                <option value="basico">Básico</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
              </select>
            </div>
            <div className="col-12 col-sm-4 col-md-2">
              <label className="form-label">Estado</label>
              <select
                className="form-select"
                value={filters.is_active}
                onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}
              >
                <option value="all">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabla de recursos - Vista desktop/tablet */}
      <div className="card d-none d-lg-block">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Materia</th>
                  <th>Área</th>
                  <th>Fase</th>
                  <th>Grado</th>
                  <th>Dificultad</th>
                  <th>Visualizaciones</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {resources.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center">
                      No se encontraron recursos educativos
                    </td>
                  </tr>
                ) : (
                  resources.map((resource) => (
                    <tr key={resource.id}>
                      <td>
                        <span style={{ fontSize: '1.5rem' }}>
                          {getResourceTypeIcon(resource.resource_type)}
                        </span>
                      </td>
                      <td>
                        <div>
                          <strong>{resource.title}</strong>
                          {resource.description && (
                            <div className="small text-muted" style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {resource.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{resource.subject}</td>
                      <td>{resource.area}</td>
                      <td>{resource.phase || 'Todas'}</td>
                      <td>{resource.grade_level || 'Todos'}</td>
                      <td>
                        <span className={`badge ${getDifficultyBadgeClass(resource.difficulty)}`}>
                          {getDifficultyText(resource.difficulty)}
                        </span>
                      </td>
                      <td>{resource.views_count || 0}</td>
                      <td>
                        {resource.is_active ? (
                          <span className="badge bg-success">Activo</span>
                        ) : (
                          <span className="badge bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-info btn-sm"
                            title="Ver recurso"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <Link
                            to={`/recursos-educativos/${resource.id}/editar`}
                            className="btn btn-warning btn-sm"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </Link>
                          <button
                            className={`btn btn-sm ${resource.is_active ? 'btn-secondary' : 'btn-success'}`}
                            onClick={() => handleToggleActive(resource.id, resource.is_active)}
                            title={resource.is_active ? 'Desactivar' : 'Activar'}
                          >
                            {resource.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(resource.id, resource.title)}
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Vista móvil/tablet pequeña - Tarjetas */}
      <div className="d-lg-none">
        {resources.length === 0 ? (
          <div className="alert alert-info text-center">
            No se encontraron recursos educativos
          </div>
        ) : (
          <div className="row g-3">
            {resources.map((resource) => (
              <div key={resource.id} className="col-12 col-md-6">
                <div className="card h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex align-items-center flex-wrap gap-2">
                        <span style={{ fontSize: '1.5rem' }}>
                          {getResourceTypeIcon(resource.resource_type)}
                        </span>
                        <span className={`badge ${getDifficultyBadgeClass(resource.difficulty)}`}>
                          {getDifficultyText(resource.difficulty)}
                        </span>
                        {resource.is_active ? (
                          <span className="badge bg-success">Activo</span>
                        ) : (
                          <span className="badge bg-secondary">Inactivo</span>
                        )}
                      </div>
                    </div>
                    
                    <h5 className="card-title">{resource.title}</h5>
                    
                    {resource.description && (
                      <p className="card-text small text-muted mb-2">
                        {resource.description.length > 150
                          ? `${resource.description.substring(0, 150)}...`
                          : resource.description}
                      </p>
                    )}
                    
                    <div className="mb-2">
                      <small className="text-muted d-block">
                        <strong>Materia:</strong> {resource.subject}
                      </small>
                      <small className="text-muted d-block">
                        <strong>Área:</strong> {resource.area}
                      </small>
                      <small className="text-muted d-block">
                        <strong>Fase:</strong> {resource.phase || 'Todas'} | <strong>Grado:</strong> {resource.grade_level || 'Todos'}
                      </small>
                      {resource.views_count > 0 && (
                        <small className="text-muted d-block">
                          <strong>Visualizaciones:</strong> {resource.views_count}
                        </small>
                      )}
                    </div>
                  </div>
                  <div className="card-footer bg-transparent">
                    <div className="d-flex flex-wrap gap-2">
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-info btn-sm"
                        title="Ver recurso"
                      >
                        <ExternalLink size={16} className="me-1" />
                        Ver
                      </a>
                      <Link
                        to={`/recursos-educativos/${resource.id}/editar`}
                        className="btn btn-warning btn-sm"
                        title="Editar"
                      >
                        <Edit size={16} className="me-1" />
                        Editar
                      </Link>
                      <button
                        className={`btn btn-sm ${resource.is_active ? 'btn-secondary' : 'btn-success'}`}
                        onClick={() => handleToggleActive(resource.id, resource.is_active)}
                        title={resource.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {resource.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(resource.id, resource.title)}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EducationalResourcesList;
