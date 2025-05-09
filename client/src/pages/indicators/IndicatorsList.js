// pages/indicators/IndicatorsList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Edit, Trash2, Search, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';

const IndicatorsList = () => {
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    const fetchIndicators = async () => {
      try {
        const response = await axios.get('/api/indicators');
        setIndicators(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar indicadores:', error);
        setLoading(false);
      }
    };
    
    fetchIndicators();
  }, []);
  
  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este indicador?')) {
      try {
        await axios.delete(`/api/indicators/${id}`);
        setIndicators(indicators.filter(indicator => indicator.id !== id));
      } catch (error) {
        console.error('Error al eliminar indicador:', error);
      }
    }
  };
  
  const handleToggleAchieved = async (id, achieved) => {
    try {
      await axios.patch(`/api/indicators/${id}`, { achieved: !achieved });
      setIndicators(indicators.map(indicator => 
        indicator.id === id ? { ...indicator, achieved: !achieved } : indicator
      ));
    } catch (error) {
      console.error('Error al actualizar indicador:', error);
    }
  };
  
  const filteredIndicators = indicators.filter(indicator => 
    indicator.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    indicator.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    indicator.student_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Gestión de Indicadores de Logro</h4>
        <Link to="/indicadores/nuevo" className="btn btn-primary d-flex align-items-center">
          <PlusCircle size={18} className="me-2" /> Nuevo Indicador
        </Link>
      </div>
      
      <div className="card mb-4">
        <div className="card-body">
          <div className="input-group mb-3">
            <span className="input-group-text">
              <Search size={18} />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar indicadores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Descripción</th>
                    <th>Asignatura</th>
                    <th>Fase</th>
                    <th>Logrado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndicators.length > 0 ? (
                    filteredIndicators.map((indicator) => (
                      <tr key={indicator.id}>
                        <td>{indicator.student_name}</td>
                        <td>{indicator.description}</td>
                        <td>{indicator.subject}</td>
                        <td>{indicator.phase}</td>
                        <td>
                          <button 
                            className={`btn btn-sm ${indicator.achieved ? 'btn-success' : 'btn-outline-secondary'}`}
                            onClick={() => handleToggleAchieved(indicator.id, indicator.achieved)}
                          >
                            {indicator.achieved ? 
                              <><CheckCircle size={16} className="me-1" /> Sí</> : 
                              <><XCircle size={16} className="me-1" /> No</>
                            }
                          </button>
                        </td>
                        <td className="text-end">
                          <div className="btn-group">
                            <Link to={`/indicadores/${indicator.id}/editar`} className="btn btn-sm btn-outline-primary">
                              <Edit size={16} />
                            </Link>
                            <button 
                              onClick={() => handleDelete(indicator.id)}
                              className="btn btn-sm btn-outline-danger"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center py-3">
                        No se encontraron indicadores
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IndicatorsList;
