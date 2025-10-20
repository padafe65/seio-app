import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const QuestionnaireIndicatorsManager = ({ questionnaireId, questionnaireTitle }) => {
  const [indicators, setIndicators] = useState([]);
  const [availableIndicators, setAvailableIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIndicator, setNewIndicator] = useState({
    indicator_id: '',
    passing_score: 3.50,
    weight: 1.00
  });

  const getAuthConfig = () => {
    const token = localStorage.getItem('authToken');
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  useEffect(() => {
    if (questionnaireId) {
      fetchQuestionnaireIndicators();
      fetchAvailableIndicators();
    }
  }, [questionnaireId]);

  const fetchQuestionnaireIndicators = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/questionnaire-indicators/questionnaire/${questionnaireId}/indicators`,
        getAuthConfig()
      );
      setIndicators(response.data.data || []);
    } catch (error) {
      console.error('Error al obtener indicadores del cuestionario:', error);
      Swal.fire('Error', 'No se pudieron cargar los indicadores del cuestionario', 'error');
    }
  };

  const fetchAvailableIndicators = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/indicators`,
        getAuthConfig()
      );
      setAvailableIndicators(response.data.data || []);
    } catch (error) {
      console.error('Error al obtener indicadores disponibles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIndicator = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(
        `${API_URL}/api/questionnaire-indicators/questionnaire/${questionnaireId}/indicators`,
        newIndicator,
        getAuthConfig()
      );
      
      Swal.fire('Éxito', 'Indicador asociado al cuestionario exitosamente', 'success');
      setShowAddForm(false);
      setNewIndicator({ indicator_id: '', passing_score: 3.50, weight: 1.00 });
      fetchQuestionnaireIndicators();
      
    } catch (error) {
      console.error('Error al asociar indicador:', error);
      Swal.fire('Error', 'No se pudo asociar el indicador al cuestionario', 'error');
    }
  };

  const handleRemoveIndicator = async (indicatorId) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción desasociará el indicador del cuestionario',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, desasociar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(
          `${API_URL}/api/questionnaire-indicators/questionnaire/${questionnaireId}/indicators/${indicatorId}`,
          getAuthConfig()
        );
        
        Swal.fire('Éxito', 'Indicador desasociado exitosamente', 'success');
        fetchQuestionnaireIndicators();
        
      } catch (error) {
        console.error('Error al desasociar indicador:', error);
        Swal.fire('Error', 'No se pudo desasociar el indicador', 'error');
      }
    }
  };

  const handleUpdateIndicator = async (indicatorId, passingScore, weight) => {
    try {
      await axios.put(
        `${API_URL}/api/questionnaire-indicators/questionnaire/${questionnaireId}/indicators/${indicatorId}`,
        { passing_score: passingScore, weight: weight },
        getAuthConfig()
      );
      
      Swal.fire('Éxito', 'Configuración actualizada exitosamente', 'success');
      fetchQuestionnaireIndicators();
      
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      Swal.fire('Error', 'No se pudo actualizar la configuración', 'error');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Indicadores del Cuestionario: {questionnaireTitle}</h5>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancelar' : 'Agregar Indicador'}
        </button>
      </div>
      
      <div className="card-body">
        {showAddForm && (
          <div className="mb-4 p-3 border rounded bg-light">
            <h6>Asociar Nuevo Indicador</h6>
            <form onSubmit={handleAddIndicator}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Indicador</label>
                  <select
                    className="form-select"
                    value={newIndicator.indicator_id}
                    onChange={(e) => setNewIndicator({ ...newIndicator, indicator_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar indicador...</option>
                    {availableIndicators
                      .filter(ind => !indicators.some(qi => qi.indicator_id === ind.id))
                      .map(indicator => (
                        <option key={indicator.id} value={indicator.id}>
                          {indicator.description}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Nota Mínima</label>
                  <input
                    type="number"
                    className="form-control"
                    value={newIndicator.passing_score}
                    onChange={(e) => setNewIndicator({ ...newIndicator, passing_score: parseFloat(e.target.value) })}
                    min="0"
                    max="5"
                    step="0.01"
                    required
                  />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Peso</label>
                  <input
                    type="number"
                    className="form-control"
                    value={newIndicator.weight}
                    onChange={(e) => setNewIndicator({ ...newIndicator, weight: parseFloat(e.target.value) })}
                    min="0"
                    max="1"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success btn-sm">
                  Asociar Indicador
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {indicators.length === 0 ? (
          <div className="text-center py-4 text-muted">
            <p>No hay indicadores asociados a este cuestionario.</p>
            <p>Haz clic en "Agregar Indicador" para asociar indicadores.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Descripción</th>
                  <th>Materia</th>
                  <th>Categoría</th>
                  <th>Grado</th>
                  <th>Fase</th>
                  <th>Nota Mínima</th>
                  <th>Peso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {indicators.map(indicator => (
                  <tr key={indicator.association_id}>
                    <td>{indicator.indicator_id}</td>
                    <td>
                      <small className="text-muted">
                        {indicator.description.length > 50 
                          ? `${indicator.description.substring(0, 50)}...` 
                          : indicator.description
                        }
                      </small>
                    </td>
                    <td>{indicator.subject}</td>
                    <td>{indicator.category || 'N/A'}</td>
                    <td>{indicator.grade}</td>
                    <td>{indicator.phase}</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={indicator.passing_score}
                        onChange={(e) => {
                          const newScore = parseFloat(e.target.value);
                          if (newScore >= 0 && newScore <= 5) {
                            handleUpdateIndicator(indicator.indicator_id, newScore, indicator.weight);
                          }
                        }}
                        min="0"
                        max="5"
                        step="0.01"
                        style={{ width: '80px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={indicator.weight}
                        onChange={(e) => {
                          const newWeight = parseFloat(e.target.value);
                          if (newWeight >= 0 && newWeight <= 1) {
                            handleUpdateIndicator(indicator.indicator_id, indicator.passing_score, newWeight);
                          }
                        }}
                        min="0"
                        max="1"
                        step="0.01"
                        style={{ width: '80px' }}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveIndicator(indicator.indicator_id)}
                        title="Desasociar indicador"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionnaireIndicatorsManager;
