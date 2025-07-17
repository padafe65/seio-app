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
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 Iniciando carga de indicadores para el usuario:', {
          userId: user?.id,
          userRole: user?.role
        });
        
        // Para todos los usuarios, primero verificamos si hay un token
        const token = localStorage.getItem('authToken');
        if (!token) {
          console.error('❌ No se encontró el token de autenticación en localStorage');
          throw new Error('No se encontró el token de autenticación');
        }
        
        console.log('🔑 Token encontrado en localStorage');
        
        // Configuración de axios para incluir el token
        const config = {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        };
        
        console.log('📤 Configuración de la petición:', {
          headers: config.headers,
          withCredentials: config.withCredentials
        });
        
        // Si es docente, obtener solo sus indicadores
        if (user && user.role === 'docente') {
          console.log('👨‍🏫 Usuario es docente, obteniendo información del profesor...');
          
          try {
            // 1. Primero obtenemos el ID del profesor
            console.log(`🔍 Obteniendo información del profesor para el usuario ID: ${user.id}`);
            const teacherResponse = await axios.get(
              `/api/teachers/by-user/${user.id}`,
              config
            );
            
            console.log('✅ Información del profesor obtenida:', teacherResponse.data);
            
            // Verificar que la respuesta tenga el formato esperado
            if (!teacherResponse.data || !teacherResponse.data.success) {
              console.error('❌ Error en la respuesta del servidor:', teacherResponse.data);
              throw new Error(teacherResponse.data?.message || 'Error al obtener información del profesor');
            }
            
            const teacherData = teacherResponse.data;
            const teacherId = teacherData.id;
            
            console.log("🆔 ID del profesor obtenido:", teacherId, "Datos completos:", teacherData);
            
            if (!teacherId) {
              console.error('❌ No se pudo obtener el ID del profesor de la respuesta:', teacherResponse.data);
              throw new Error('No se pudo obtener el ID del profesor de la respuesta del servidor');
            }
            
            // 2. Luego obtenemos los indicadores de ese profesor
            const indicatorsUrl = `/api/indicators?teacher_id=${teacherId}`;
            console.log(`🔗 URL de la API de indicadores: ${indicatorsUrl}`);
            
            console.log('📤 Enviando solicitud con headers:', {
              Authorization: config.headers.Authorization ? 'Token presente' : 'Token ausente',
              'Content-Type': config.headers['Content-Type']
            });
            
            const response = await axios.get(indicatorsUrl, config);
            
            console.log('✅ Respuesta del servidor:', {
              status: response.status,
              statusText: response.statusText,
              data: response.data ? (response.data.data ? `Recibidos ${response.data.count} indicadores` : 'Formato de datos inesperado') : 'Sin datos',
              success: response.data?.success,
              headers: response.headers
            });
            
            // Verificar que la respuesta tenga el formato esperado
            if (!response.data || !response.data.success) {
              console.error('❌ Error en la respuesta del servidor:', response.data);
              throw new Error(response.data?.message || 'Error al obtener los indicadores');
            }
            
            const indicatorsData = response.data.data || [];
            
            console.log(`📊 Total de indicadores cargados: ${indicatorsData.length}`);
            if (indicatorsData.length > 0) {
              console.log('📝 Primer indicador:', {
                id: indicatorsData[0].id,
                description: indicatorsData[0].description,
                teacher_id: indicatorsData[0].teacher_id,
                student_id: indicatorsData[0].student_id,
                questionnaire_id: indicatorsData[0].questionnaire_id
              });
            }
            
            setIndicators(indicatorsData);
            setFilteredIndicators(indicatorsData);
            
          } catch (teacherError) {
            console.error('❌ Error al obtener información del profesor o sus indicadores:', {
              error: teacherError,
              response: teacherError.response?.data,
              status: teacherError.response?.status,
              statusText: teacherError.response?.statusText,
              url: teacherError.config?.url,
              method: teacherError.config?.method,
              headers: teacherError.config?.headers
            });
            
            setError(`Error al cargar los indicadores: ${teacherError.response?.data?.message || teacherError.message}`);
            return;
          }
        } else {
          // Para usuarios que no son docentes (ej. administradores)
          const adminUrl = '/api/indicators';
          console.log('👤 Usuario no es docente, obteniendo todos los indicadores...');
          console.log('📤 Enviando solicitud a:', adminUrl);
          
          const response = await axios.get(adminUrl, config);
          
          console.log('✅ Respuesta del servidor (admin):', {
            status: response.status,
            statusText: response.statusText,
            data: response.data ? `Recibidos ${Array.isArray(response.data) ? response.data.length : 'datos'}` : 'Sin datos'
          });
          
          if (!Array.isArray(response.data)) {
            console.error('❌ La respuesta no es un array:', response.data);
            throw new Error('Formato de respuesta inesperado');
          }
          
          console.log(`📊 Total de indicadores cargados: ${response.data.length}`);
          setIndicators(response.data);
          setFilteredIndicators(response.data);
        }
        
      } catch (error) {
        console.error('❌ Error general al cargar indicadores:', {
          error: error,
          response: error.response?.data,
          status: error.response?.status,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            params: error.config?.params,
            headers: error.config?.headers
          }
        });
        
        setError(`Error al cargar indicadores: ${error.message}. Por favor, intente nuevamente.`);
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
