import React, { useState, useEffect, useMemo } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

const StudentIndicators = () => {
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState('all');
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchIndicators = async () => {
      try {
        if (!user) return;
        
        const response = await axiosClient.get(`/indicators/student/${user.id}`);
        // La respuesta del backend tiene estructura { success: true, data: [...] }
        // Asegurar que siempre sea un array
        let indicatorsData = [];
        if (Array.isArray(response.data)) {
          indicatorsData = response.data;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          // Formatear los datos del backend que vienen con estructura teacher y questionnaire
          indicatorsData = response.data.data.map(indicator => ({
            student_indicator_id: indicator.student_indicator_id || indicator.id,
            id: indicator.id,
            description: indicator.description,
            subject: indicator.subject,
            phase: indicator.phase,
            achieved: indicator.achieved,
            teacher_name: indicator.teacher?.name || 'N/A',
            questionnaire_title: indicator.questionnaire?.title || null,
            questionnaire_grade: indicator.questionnaire?.grade || null
          }));
        } else {
          indicatorsData = [];
        }
        setIndicators(indicatorsData);
      } catch (error) {
        console.error('Error al cargar indicadores:', error);
        // Si no hay indicadores asignados, mostrar mensaje informativo en lugar de error
        if (error.response?.status === 404 || error.response?.status === 401) {
          setIndicators([]);
          setError('No tienes indicadores asignados. Por favor, contacta a tu docente para que te asigne indicadores.');
        } else {
          setError('Error al cargar indicadores. Intente nuevamente.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchIndicators();
  }, [user]);
  
  // Filtrar por fase y eliminar duplicados basándonos en el id del indicador
  const filteredIndicators = useMemo(() => {
    if (!Array.isArray(indicators)) return [];
    
    let filtered = selectedPhase === 'all' 
      ? indicators 
      : indicators.filter(indicator => indicator.phase?.toString() === selectedPhase);
    
    // Eliminar duplicados basándonos en el id del indicador
    // Mantener solo el primero (más reciente si el backend ya los ordenó)
    const seen = new Map();
    filtered = filtered.filter(indicator => {
      if (seen.has(indicator.id)) {
        return false;
      }
      seen.set(indicator.id, true);
      return true;
    });
    
    return filtered;
  }, [indicators, selectedPhase]);
  
  // Función para obtener el texto del estado
  const getStatusText = (achieved) => {
    if (achieved === true || achieved === 1) {
      return 'Logrado';
    }
    return 'Pendiente';
  };
  
  // Función para obtener la clase CSS del estado
  const getStatusClass = (achieved) => {
    if (achieved === true || achieved === 1) {
      return 'bg-success';
    }
    return 'bg-warning';
  };
  
  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }
  
  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }
  
  return (
    <div className="container">
      <h2 className="mb-4">Indicadores de Desempeño</h2>
      
      <div className="mb-4">
        <label htmlFor="phaseFilter" className="form-label">Filtrar por Fase:</label>
        <select 
          id="phaseFilter" 
          className="form-select" 
          style={{ maxWidth: '300px' }}
          value={selectedPhase}
          onChange={(e) => setSelectedPhase(e.target.value)}
        >
          <option value="all">Todas las Fases</option>
          <option value="1">Fase 1</option>
          <option value="2">Fase 2</option>
          <option value="3">Fase 3</option>
          <option value="4">Fase 4</option>
        </select>
      </div>
      
      {filteredIndicators.length === 0 ? (
        <div className="alert alert-info">
          No hay indicadores disponibles para {selectedPhase === 'all' ? 'ninguna fase' : `la fase ${selectedPhase}`}.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>Fase</th>
                <th>Materia</th>
                <th>Descripción</th>
                <th>Cuestionario</th>
                <th>Docente</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredIndicators.map((indicator, index) => (
                <tr key={`${indicator.student_indicator_id || indicator.id}-${index}`}>
                  <td className="align-middle">
                    <strong>Fase {indicator.phase}</strong>
                  </td>
                  <td className="align-middle">
                    {indicator.subject || 'N/A'}
                  </td>
                  <td className="align-middle">
                    {indicator.description || 'Sin descripción'}
                  </td>
                  <td className="align-middle">
                    {indicator.questionnaire_title ? (
                      <div>
                        <div><strong>{indicator.questionnaire_title}</strong></div>
                        {indicator.questionnaire_grade && (
                          <small className="text-muted">Grado: {indicator.questionnaire_grade}</small>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted">N/A</span>
                    )}
                  </td>
                  <td className="align-middle">
                    {indicator.teacher_name || 'N/A'}
                  </td>
                  <td className="align-middle">
                    <span className={`badge ${getStatusClass(indicator.achieved)}`}>
                      {getStatusText(indicator.achieved)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StudentIndicators;
