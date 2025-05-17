import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const IndicatorsList = () => {
  const [indicators, setIndicators] = useState([]);
  const [filteredIndicators, setFilteredIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    description: '',
    subject: '',
    phase: '',
    grade: '',
    questionnaire: '',
    achieved: ''
  });
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchIndicators = async () => {
      try {
        // Si es docente, obtener solo sus indicadores
        let url = '/api/indicators';
        if (user && user.role === 'docente') {
          // Obtener el ID del profesor
          const teacherResponse = await axios.get(`/api/teachers/by-user/${user.id}`);
          const teacherId = teacherResponse.data.id;
          console.log("ID del profesor:", teacherId);
          url = `/api/indicators?teacher_id=${teacherId}`;
        }
        
        const response = await axios.get(url);
        setIndicators(response.data);
        setFilteredIndicators(response.data);
        console.log("Indicadores obtenidos:", response.data);
      } catch (error) {
        console.error('Error al cargar indicadores:', error);
        setError('Error al cargar indicadores. Intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchIndicators();
  }, [user]);
  
  useEffect(() => {
    // Filtrar indicadores cuando cambien los filtros
    const result = indicators.filter(indicator => {
      return (
        indicator.description.toLowerCase().includes(filters.description.toLowerCase()) &&
        indicator.subject.toLowerCase().includes(filters.subject.toLowerCase()) &&
        indicator.phase.toString().includes(filters.phase) &&
        (indicator.grade ? indicator.grade.toString() : 'Todos').toLowerCase().includes(filters.grade.toLowerCase()) &&
        (indicator.questionnaire_title ? indicator.questionnaire_title.toLowerCase().includes(filters.questionnaire.toLowerCase()) : filters.questionnaire === '') &&
        (filters.achieved === '' || 
          (filters.achieved === 'si' && indicator.achieved) || 
          (filters.achieved === 'no' && !indicator.achieved))
      );
    });
    
    setFilteredIndicators(result);
  }, [filters, indicators]);
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };
  
  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de eliminar este indicador?')) {
      try {
        await axios.delete(`/api/indicators/${id}`);
        setIndicators(indicators.filter(indicator => indicator.id !== id));
      } catch (error) {
        console.error('Error al eliminar indicador:', error);
        setError('Error al eliminar indicador. Intente nuevamente.');
      }
    }
  };
  
  const clearFilters = () => {
    setFilters({
      description: '',
      subject: '',
      phase: '',
      grade: '',
      questionnaire: '',
      achieved: ''
    });
  };
  
  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }
  
  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }
  
  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Indicadores de Desempeño</h2>
        <Link to="/indicadores/nuevo" className="btn btn-primary">
          Crear Nuevo Indicador
        </Link>
      </div>
      
      {indicators.length === 0 ? (
        <div className="alert alert-info">No hay indicadores disponibles.</div>
      ) : (
        <div className="table-responsive">
          <div className="mb-3">
            <button 
              onClick={clearFilters} 
              className="btn btn-outline-secondary btn-sm float-end"
            >
              Limpiar filtros
            </button>
          </div>
          <table className="table table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>
                  <div className="d-flex flex-column">
                    <span>Descripción</span>
                    <input
                      type="text"
                      name="description"
                      value={filters.description}
                      onChange={handleFilterChange}
                      className="form-control form-control-sm mt-1"
                      placeholder="Filtrar..."
                    />
                  </div>
                </th>
                <th>
                  <div className="d-flex flex-column">
                    <span>Materia</span>
                    <input
                      type="text"
                      name="subject"
                      value={filters.subject}
                      onChange={handleFilterChange}
                      className="form-control form-control-sm mt-1"
                      placeholder="Filtrar..."
                    />
                  </div>
                </th>
                <th>
                  <div className="d-flex flex-column">
                    <span>Fase</span>
                    <input
                      type="text"
                      name="phase"
                      value={filters.phase}
                      onChange={handleFilterChange}
                      className="form-control form-control-sm mt-1"
                      placeholder="Filtrar..."
                    />
                  </div>
                </th>
                <th>
                  <div className="d-flex flex-column">
                    <span>Grado</span>
                    <input
                      type="text"
                      name="grade"
                      value={filters.grade}
                      onChange={handleFilterChange}
                      className="form-control form-control-sm mt-1"
                      placeholder="Filtrar..."
                    />
                  </div>
                </th>
                <th>
                  <div className="d-flex flex-column">
                    <span>Cuestionario</span>
                    <input
                      type="text"
                      name="questionnaire"
                      value={filters.questionnaire}
                      onChange={handleFilterChange}
                      className="form-control form-control-sm mt-1"
                      placeholder="Filtrar..."
                    />
                  </div>
                </th>
                <th>
                  <div className="d-flex flex-column">
                    <span>Logrado</span>
                    <select
                      name="achieved"
                      value={filters.achieved}
                      onChange={handleFilterChange}
                      className="form-select form-select-sm mt-1"
                    >
                      <option value="">Todos</option>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredIndicators.map(indicator => (
                <tr key={indicator.id}>
                  <td>{indicator.description}</td>
                  <td>{indicator.subject}</td>
                  <td>{indicator.phase}</td>
                  <td>{indicator.grade || 'Todos'}</td>
                  <td>
                    {indicator.questionnaire_title ? (
                      <span title={`Grado: ${indicator.questionnaire_grade}, Fase: ${indicator.questionnaire_phase}`}>
                        {indicator.questionnaire_title}
                      </span>
                    ) : (
                      <span className="text-muted">No asociado</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${indicator.achieved ? 'bg-success' : 'bg-warning'}`}>
                      {indicator.achieved ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <Link to={`/indicadores/${indicator.id}/editar`} className="btn btn-warning">
                        Editar
                      </Link>
                      <button 
                        onClick={() => handleDelete(indicator.id)} 
                        className="btn btn-danger"
                      >
                        Eliminar
                      </button>
                    </div>
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

export default IndicatorsList;
