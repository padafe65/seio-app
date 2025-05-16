import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const IndicatorsList = () => {
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
          <table className="table table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>Descripción</th>
                <th>Materia</th>
                <th>Fase</th>
                <th>Grado</th>
                <th>Cuestionario</th>
                <th>Logrado</th>
                <th>Acciones</th>
              </tr>

            </thead>
            <tbody>
              {indicators.map(indicator => (
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
