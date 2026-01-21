// components/educational-resources/StudentGuidesPanel.js
import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { FileText, Download, ExternalLink, BookOpen } from 'lucide-react';

const StudentGuidesPanel = ({ studentData }) => {
  const [guides, setGuides] = useState([]);
  const [guidesByPhase, setGuidesByPhase] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [expandedPhases, setExpandedPhases] = useState({});

  useEffect(() => {
    if (studentData) {
      fetchGuides();
    }
  }, [studentData]);

  const fetchGuides = async () => {
    try {
      setLoading(true);
      const params = {};
      
      if (studentData.grade) {
        params.grade_level = studentData.grade.toString();
      }
      
      // Obtener todas las guías disponibles para el estudiante
      const response = await axiosClient.get('/educational-resources/student-guides', { params });
      
      if (response.data.success) {
        setGuides(response.data.data || []);
        setGuidesByPhase(response.data.grouped_by_phase || {});
      }
    } catch (error) {
      console.error('Error al cargar guías:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePhase = (phase) => {
    setExpandedPhases(prev => ({
      ...prev,
      [phase]: !prev[phase]
    }));
  };

  const handleDownload = (guide) => {
    if (guide.file_url) {
      window.open(guide.file_url, '_blank');
    } else if (guide.file_path) {
      // Construir URL completa si es ruta relativa
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      window.open(`${baseUrl}/uploads/${guide.file_path}`, '_blank');
    }
  };

  const handleExternalLink = (url) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="card mb-4">
        <div className="card-body text-center py-3">
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Cargando guías...</span>
          </div>
        </div>
      </div>
    );
  }

  const phases = [1, 2, 3, 4];
  const hasGuides = guides.length > 0;

  return (
    <div className="card mb-4">
      <div className="card-header bg-info text-white d-flex align-items-center">
        <BookOpen size={20} className="me-2" />
        <h5 className="mb-0">Guías de Estudio</h5>
      </div>
      <div className="card-body">
        {!hasGuides ? (
          <div className="text-center py-3 text-muted">
            <FileText size={48} className="mb-2 opacity-50" />
            <p>No hay guías de estudio disponibles en este momento</p>
          </div>
        ) : (
          <div>
            {phases.map(phase => {
              const phaseGuides = guidesByPhase[phase] || [];
              const isExpanded = expandedPhases[phase];
              
              if (phaseGuides.length === 0) return null;
              
              return (
                <div key={phase} className="mb-3">
                  <button
                    className="btn btn-outline-primary w-100 d-flex justify-content-between align-items-center"
                    onClick={() => togglePhase(phase)}
                    type="button"
                  >
                    <span>
                      <strong>Fase {phase}</strong>
                      <span className="badge bg-primary ms-2">{phaseGuides.length}</span>
                    </span>
                    <span>{isExpanded ? '−' : '+'}</span>
                  </button>
                  
                  {isExpanded && (
                    <div className="mt-2">
                      {phaseGuides.map(guide => (
                        <div key={guide.id} className="card mb-2">
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="flex-grow-1">
                                <h6 className="mb-1">{guide.title}</h6>
                                {guide.description && (
                                  <p className="text-muted small mb-2">{guide.description}</p>
                                )}
                                <div className="d-flex flex-wrap gap-2">
                                  <span className="badge bg-secondary">{guide.subject}</span>
                                  {guide.area && (
                                    <span className="badge bg-info">{guide.area}</span>
                                  )}
                                  {guide.teacher_name && (
                                    <span className="badge bg-success">Por: {guide.teacher_name}</span>
                                  )}
                                </div>
                              </div>
                              <div className="d-flex gap-1">
                                {guide.file_path && (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleDownload(guide)}
                                    title="Descargar PDF"
                                  >
                                    <Download size={16} />
                                  </button>
                                )}
                                {guide.url && (
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handleExternalLink(guide.url)}
                                    title="Abrir enlace complementario"
                                  >
                                    <ExternalLink size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Mostrar guías sin fase específica */}
            {guidesByPhase[0] && guidesByPhase[0].length > 0 && (
              <div className="mb-3">
                <button
                  className="btn btn-outline-secondary w-100 d-flex justify-content-between align-items-center"
                  onClick={() => togglePhase(0)}
                  type="button"
                >
                  <span>
                    <strong>Otras Guías</strong>
                    <span className="badge bg-secondary ms-2">{guidesByPhase[0].length}</span>
                  </span>
                  <span>{expandedPhases[0] ? '−' : '+'}</span>
                </button>
                
                {expandedPhases[0] && (
                  <div className="mt-2">
                    {guidesByPhase[0].map(guide => (
                      <div key={guide.id} className="card mb-2">
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <h6 className="mb-1">{guide.title}</h6>
                              {guide.description && (
                                <p className="text-muted small mb-2">{guide.description}</p>
                              )}
                              <div className="d-flex flex-wrap gap-2">
                                <span className="badge bg-secondary">{guide.subject}</span>
                                {guide.area && (
                                  <span className="badge bg-info">{guide.area}</span>
                                )}
                              </div>
                            </div>
                            <div className="d-flex gap-1">
                              {guide.file_path && (
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => handleDownload(guide)}
                                  title="Descargar PDF"
                                >
                                  <Download size={16} />
                                </button>
                              )}
                              {guide.url && (
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleExternalLink(guide.url)}
                                  title="Abrir enlace complementario"
                                >
                                  <ExternalLink size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentGuidesPanel;
