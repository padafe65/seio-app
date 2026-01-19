// components/educational-resources/LearningResourcesSection.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import { BookOpen, ExternalLink, Star, Clock, Filter, Search, Star as StarIcon, X } from 'lucide-react';

const LearningResourcesSection = ({ studentId, grade }) => {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [recommendedResources, setRecommendedResources] = useState([]);
  const [bookmarkedResources, setBookmarkedResources] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState([]); // Materias de los docentes del estudiante
  const [teachers, setTeachers] = useState([]); // Información completa de los docentes (nombre, materia, etc.)
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
  
  // Cargar materias de docentes cuando se monta el componente
  useEffect(() => {
    if (studentId && user?.id) {
      fetchTeacherSubjects();
    }
  }, [studentId, user?.id]);
  
  // Cargar recursos cuando cambian los filtros o las materias de docentes
  useEffect(() => {
    if (studentId) {
      fetchResources();
      fetchRecommendedResources();
      fetchBookmarkedResources();
    }
  }, [studentId, selectedSubject, selectedArea, selectedPhase, selectedDifficulty, selectedResourceType, teacherSubjects]);
  
  // Auto-seleccionar pestaña de recomendados si hay recursos recomendados y no hay recursos generales
  useEffect(() => {
    if (recommendedResources.length > 0 && resources.length === 0 && activeTab === 'all') {
      console.log('🔄 Auto-seleccionando pestaña de recomendados...');
      setActiveTab('recommended');
    }
  }, [recommendedResources.length, resources.length]);
  
  const fetchResources = async () => {
    try {
      const params = new URLSearchParams();
      
      // Si no hay materia seleccionada específicamente, filtrar por materias de los docentes del estudiante
      if (selectedSubject === 'all') {
        // Si hay materias de docentes, filtrar por ellas; si no, no aplicar filtro de materia
        if (teacherSubjects.length > 0) {
          // Enviar materias como string separado por comas (el backend las parseará)
          params.append('subjects', teacherSubjects.join(','));
          console.log(`📚 Filtrando por materias de docentes: ${teacherSubjects.join(', ')}`);
        }
      } else {
        // Si hay una materia específica seleccionada, usar esa
        params.append('subject', selectedSubject);
      }
      
      if (selectedArea !== 'all') params.append('area', selectedArea);
      if (selectedPhase !== 'all') params.append('phase', selectedPhase);
      if (selectedDifficulty !== 'all') params.append('difficulty', selectedDifficulty);
      if (selectedResourceType !== 'all') params.append('resource_type', selectedResourceType);
      if (grade) params.append('grade_level', grade.toString());
      
      console.log(`📚 Cargando todos los recursos con filtros: ${params.toString()}`);
      const response = await axiosClient.get(`/educational-resources?${params.toString()}`);
      const resources = response.data.data || [];
      console.log(`✅ Recursos recibidos: ${resources.length}`, resources);
      setResources(resources);
      setLoading(false);
    } catch (error) {
      console.error('❌ Error al cargar recursos:', error);
      console.error('Detalles del error:', error.response?.data || error.message);
      setError('Error al cargar recursos educativos');
      setLoading(false);
    }
  };
  
  const fetchRecommendedResources = async () => {
    if (!studentId) {
      console.log('⚠️ LearningResourcesSection: No hay studentId, no se pueden cargar recursos recomendados');
      return;
    }
    try {
      console.log(`📚 Cargando recursos recomendados para estudiante ${studentId}...`);
      const response = await axiosClient.get(`/educational-resources/recommended/${studentId}`);
      const resources = response.data.data || [];
      console.log(`✅ Recursos recomendados recibidos: ${resources.length}`, resources);
      setRecommendedResources(resources);
    } catch (error) {
      console.error('❌ Error al cargar recursos recomendados:', error);
      console.error('Detalles del error:', error.response?.data || error.message);
      setRecommendedResources([]);
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
  
  // Obtener las materias de los docentes asociados al estudiante
  const fetchTeacherSubjects = async () => {
    if (!user?.id) return;
    try {
      const response = await axiosClient.get(`/students/by-user/${user.id}/teachers`);
      const teachersData = response.data.data || [];
      // Guardar información completa de docentes
      setTeachers(teachersData);
      // Extraer materias únicas de los docentes
      const subjects = [...new Set(teachersData.map(t => t.subject).filter(Boolean))];
      console.log(`📚 Materias de docentes del estudiante:`, subjects);
      setTeacherSubjects(subjects);
    } catch (error) {
      console.error('❌ Error al cargar materias de docentes:', error);
      setTeacherSubjects([]);
      setTeachers([]);
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
    if (!resourcesToFilter || !Array.isArray(resourcesToFilter)) return [];
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
  // Combinar materias de recursos cargados con materias de docentes del estudiante
  const subjectsFromResources = [...new Set(resources.map(r => r.subject))].filter(Boolean);
  const allSubjects = [...new Set([...subjectsFromResources, ...teacherSubjects])].sort();
  const subjects = allSubjects; // Usar todas las materias (recursos + docentes)
  
  // Función para obtener el nombre del docente por materia
  const getTeacherNameBySubject = (subject) => {
    const teacher = teachers.find(t => t.subject === subject);
    return teacher ? teacher.name : null;
  };
  
  // Función para limpiar todos los filtros
  const clearAllFilters = () => {
    setSelectedSubject('all');
    setSelectedArea('all');
    setSelectedPhase('all');
    setSelectedDifficulty('all');
    setSelectedResourceType('all');
    setSearchTerm('');
  };
  
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
  
  // Logs de depuración
  useEffect(() => {
    console.log(`🔍 LearningResourcesSection - Estado actual:`, {
      activeTab,
      resourcesCount: resources.length,
      recommendedCount: recommendedResources.length,
      bookmarkedCount: bookmarkedResources.length,
      displayResourcesCount: displayResources.length,
      resourcesToShowCount: resourcesToShow.length,
      searchTerm,
      loading
    });
  }, [activeTab, resources.length, recommendedResources.length, bookmarkedResources.length, displayResources.length, resourcesToShow.length, searchTerm, loading]);
  
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
              <div className="card-header d-flex justify-content-between align-items-center">
                <div>
                  <Filter className="me-2" size={18} />
                  Filtros
                </div>
                {(selectedSubject !== 'all' || selectedArea !== 'all' || selectedPhase !== 'all' || 
                  selectedDifficulty !== 'all' || selectedResourceType !== 'all' || searchTerm) && (
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={clearAllFilters}
                    title="Limpiar todos los filtros"
                  >
                    <X size={16} className="me-1" />
                    Limpiar Filtros
                  </button>
                )}
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
                      {subjects.map(subject => {
                        const teacherName = getTeacherNameBySubject(subject);
                        return (
                          <option key={subject} value={subject}>
                            {subject}{teacherName ? ` - ${teacherName}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {selectedSubject !== 'all' && getTeacherNameBySubject(selectedSubject) && (
                      <small className="text-muted d-block mt-1">
                        Docente: {getTeacherNameBySubject(selectedSubject)}
                      </small>
                    )}
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
          
          {/* Lista de recursos - Tabla */}
          {resourcesToShow.length === 0 ? (
            <div className="alert alert-info">
              {activeTab === 'recommended' 
                ? 'No hay recursos recomendados en este momento.'
                : activeTab === 'bookmarked'
                ? 'No tienes recursos marcados como favoritos.'
                : 'No se encontraron recursos con los filtros seleccionados.'}
            </div>
          ) : (
            <div className="card">
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
                        <th>Favorito</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resourcesToShow.map((resource) => (
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
                          <td>{resource.area || '-'}</td>
                          <td>{resource.phase || 'Todas'}</td>
                          <td>{resource.grade_level || 'Todos'}</td>
                          <td>
                            <span className={`badge ${getDifficultyBadgeClass(resource.difficulty)}`}>
                              {getDifficultyText(resource.difficulty)}
                            </span>
                          </td>
                          <td>{resource.views_count || 0}</td>
                          <td>
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
                          </td>
                          <td>
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleResourceClick(resource.id)}
                              title="Abrir recurso"
                            >
                              <ExternalLink size={16} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LearningResourcesSection;
