// components/educational-resources/LearningResourcesSection.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import { BookOpen, ExternalLink, Star, Clock, Filter, Search, Star as StarIcon } from 'lucide-react';

const LearningResourcesSection = ({ studentId, grade }) => {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [recommendedResources, setRecommendedResources] = useState([]);
  const [bookmarkedResources, setBookmarkedResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedPhase, setSelectedPhase] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedResourceType, setSelectedResourceType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'recommended', 'bookmarked'
  
  useEffect(() => {
    if (studentId) {
      fetchResources();
      fetchRecommendedResources();
      fetchBookmarkedResources();
    }
  }, [studentId, selectedSubject, selectedArea, selectedPhase, selectedDifficulty, selectedResourceType]);
  
  const fetchResources = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSubject !== 'all') params.append('subject', selectedSubject);
      if (selectedArea !== 'all') params.append('area', selectedArea);
      if (selectedPhase !== 'all') params.append('phase', selectedPhase);
      if (selectedDifficulty !== 'all') params.append('difficulty', selectedDifficulty);
      if (selectedResourceType !== 'all') params.append('resource_type', selectedResourceType);
      if (grade) params.append('grade_level', grade.toString());
      
      const response = await axiosClient.get(`/educational-resources?${params.toString()}`);
      setResources(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar recursos:', error);
      setError('Error al cargar recursos educativos');
      setLoading(false);
    }
  };
  
  const fetchRecommendedResources = async () => {
    if (!studentId) return;
    try {
      const response = await axiosClient.get(`/educational-resources/recommended/${studentId}`);
      setRecommendedResources(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar recursos recomendados:', error);
    }
  };
  
  const fetchBookmarkedResources = async () => {
    if (!studentId) return;
    try {
      const response = await axiosClient.get(`/educational-resources/student/${studentId}/bookmarked`);
      setBookmarkedResources(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar recursos favoritos:', error);
    }
  };
  
  const handleBookmark = async (resourceId, isCurrentlyBookmarked) => {
    try {
      await axiosClient.post(
        `/educational-resources/student/${studentId}/bookmark/${resourceId}`,
        { is_bookmarked: !isCurrentlyBookmarked }
      );
      await fetchBookmarkedResources();
      // Actualizar el estado local del recurso si está visible
      setResources(resources.map(r => 
        r.id === resourceId ? { ...r, is_bookmarked: !isCurrentlyBookmarked } : r
      ));
      setRecommendedResources(recommendedResources.map(r => 
        r.id === resourceId ? { ...r, is_bookmarked: !isCurrentlyBookmarked } : r
      ));
    } catch (error) {
      console.error('Error al marcar recurso como favorito:', error);
    }
  };
  
  const handleResourceClick = async (resourceId) => {
    try {
      await axiosClient.post(`/educational-resources/student/${studentId}/view/${resourceId}`, {
        time_spent_minutes: 0
      });
    } catch (error) {
      console.error('Error al registrar visualización:', error);
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
  
  // Filtrar recursos por término de búsqueda
  const filteredResources = (resourcesToFilter) => {
    if (!searchTerm) return resourcesToFilter;
    const term = searchTerm.toLowerCase();
    return resourcesToFilter.filter(r =>
      r.title?.toLowerCase().includes(term) ||
      r.description?.toLowerCase().includes(term) ||
      r.subject?.toLowerCase().includes(term) ||
      r.area?.toLowerCase().includes(term) ||
      r.topic?.toLowerCase().includes(term)
    );
  };
  
  // Obtener materias y áreas únicas para los filtros
  const subjects = [...new Set(resources.map(r => r.subject))].filter(Boolean).sort();
  const areasBySubject = resources.reduce((acc, r) => {
    if (!acc[r.subject]) acc[r.subject] = new Set();
    if (r.area) acc[r.subject].add(r.area);
    return acc;
  }, {});
  
  const displayResources = activeTab === 'recommended' 
    ? recommendedResources 
    : activeTab === 'bookmarked' 
    ? bookmarkedResources 
    : resources;
  
  const resourcesToShow = filteredResources(displayResources);
  
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando recursos...</span>
        </div>
      </div>
    );
  }
  
  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }
  
  return (
    <div className="container py-4">
      {/* Mensaje de derechos de autor */}
      <div className="alert alert-info d-flex align-items-start mb-4" role="alert">
        <div className="me-2" style={{ fontSize: '1.2rem' }}>ℹ️</div>
        <div className="small">
          <strong>Importante:</strong> El material educativo disponible en este sistema tiene derechos de autor. 
          Se respeta la autoría y se utilizan únicamente recursos educativos de libre acceso o con licencias que permiten su uso educativo. 
          Por favor, respeta los términos de uso de cada recurso al acceder a ellos.
        </div>
      </div>
      
      <div className="row mb-4">
        <div className="col-12">
          <h2 className="mb-3">
            <BookOpen className="me-2" size={28} />
            Recursos de Aprendizaje
          </h2>
          
          {/* Tabs para cambiar entre vistas */}
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                Todos los Recursos ({resources.length})
              </button>
            </li>
            {recommendedResources.length > 0 && (
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'recommended' ? 'active' : ''}`}
                  onClick={() => setActiveTab('recommended')}
                >
                  <Star className="me-1" size={16} />
                  Recomendados ({recommendedResources.length})
                </button>
              </li>
            )}
            {bookmarkedResources.length > 0 && (
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'bookmarked' ? 'active' : ''}`}
                  onClick={() => setActiveTab('bookmarked')}
                >
                  <StarIcon className="me-1" size={16} />
                  Favoritos ({bookmarkedResources.length})
                </button>
              </li>
            )}
          </ul>
          
          {/* Búsqueda */}
          <div className="mb-3">
            <div className="input-group">
              <span className="input-group-text"><Search size={18} /></span>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar recursos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          {/* Filtros */}
          {activeTab === 'all' && (
            <div className="card mb-4">
              <div className="card-header">
                <Filter className="me-2" size={18} />
                Filtros
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-12 col-sm-6 col-md-3">
                    <label className="form-label">Materia</label>
                    <select
                      className="form-select"
                      value={selectedSubject}
                      onChange={(e) => {
                        setSelectedSubject(e.target.value);
                        setSelectedArea('all');
                      }}
                    >
                      <option value="all">Todas</option>
                      {subjects.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-sm-6 col-md-3">
                    <label className="form-label">Área</label>
                    <select
                      className="form-select"
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      disabled={selectedSubject === 'all'}
                    >
                      <option value="all">Todas</option>
                      {selectedSubject !== 'all' && areasBySubject[selectedSubject] && 
                        Array.from(areasBySubject[selectedSubject]).map(area => (
                          <option key={area} value={area}>{area}</option>
                        ))}
                    </select>
                  </div>
                  <div className="col-6 col-sm-4 col-md-2">
                    <label className="form-label">Fase</label>
                    <select
                      className="form-select"
                      value={selectedPhase}
                      onChange={(e) => setSelectedPhase(e.target.value)}
                    >
                      <option value="all">Todas</option>
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
                      value={selectedDifficulty}
                      onChange={(e) => setSelectedDifficulty(e.target.value)}
                    >
                      <option value="all">Todas</option>
                      <option value="basico">Básico</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </div>
                  <div className="col-12 col-sm-4 col-md-2">
                    <label className="form-label">Tipo</label>
                    <select
                      className="form-select"
                      value={selectedResourceType}
                      onChange={(e) => setSelectedResourceType(e.target.value)}
                    >
                      <option value="all">Todos</option>
                      <option value="video">Video</option>
                      <option value="articulo">Artículo</option>
                      <option value="ejercicio">Ejercicio</option>
                      <option value="simulador">Simulador</option>
                      <option value="guia">Guía</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Lista de recursos */}
          {resourcesToShow.length === 0 ? (
            <div className="alert alert-info">
              {activeTab === 'recommended' 
                ? 'No hay recursos recomendados en este momento.'
                : activeTab === 'bookmarked'
                ? 'No tienes recursos marcados como favoritos.'
                : 'No se encontraron recursos con los filtros seleccionados.'}
            </div>
          ) : (
            <div className="row">
              {resourcesToShow.map((resource) => (
                <div key={resource.id} className="col-md-6 col-lg-4 mb-4">
                  <div className="card h-100">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex align-items-center">
                          <span className="me-2" style={{ fontSize: '1.5rem' }}>
                            {getResourceTypeIcon(resource.resource_type)}
                          </span>
                          <span className={`badge ${getDifficultyBadgeClass(resource.difficulty)}`}>
                            {getDifficultyText(resource.difficulty)}
                          </span>
                        </div>
                        <button
                          className="btn btn-sm btn-link p-0"
                          onClick={() => handleBookmark(resource.id, resource.is_bookmarked)}
                          title={resource.is_bookmarked ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                        >
                          <StarIcon
                            size={20}
                            fill={resource.is_bookmarked ? '#ffc107' : 'none'}
                            color={resource.is_bookmarked ? '#ffc107' : '#6c757d'}
                          />
                        </button>
                      </div>
                      
                      <h5 className="card-title">{resource.title}</h5>
                      
                      <div className="mb-2">
                        <small className="text-muted">
                          <strong>{resource.subject}</strong>
                          {resource.area && ` • ${resource.area}`}
                          {resource.phase && ` • Fase ${resource.phase}`}
                        </small>
                      </div>
                      
                      {resource.description && (
                        <p className="card-text small text-muted">
                          {resource.description.length > 100
                            ? `${resource.description.substring(0, 100)}...`
                            : resource.description}
                        </p>
                      )}
                      
                      {resource.views_count > 0 && (
                        <div className="mb-2">
                          <small className="text-muted">
                            <Clock size={14} className="me-1" />
                            {resource.views_count} visualizaciones
                          </small>
                        </div>
                      )}
                    </div>
                    <div className="card-footer bg-transparent">
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm w-100"
                        onClick={() => handleResourceClick(resource.id)}
                      >
                        <ExternalLink size={16} className="me-1" />
                        Abrir Recurso
                      </a>
                    </div>
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

export default LearningResourcesSection;
