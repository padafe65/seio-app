import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const normalizeGrade = (value) => {
  const grade = normalizeText(value).replace(/[º°]/g, '').trim();
  if (!grade || /^(general|todos|todas|sin grado|universal)\b/.test(grade)) return '';
  const number = grade.match(/\d+/)?.[0];
  if (number) return String(Number(number));
  const gradeWords = {
    primero: '1', primera: '1', segundo: '2', segunda: '2', tercero: '3', tercera: '3',
    cuarto: '4', cuarta: '4', quinto: '5', quinta: '5', sexto: '6', sexta: '6',
    septimo: '7', septima: '7', octavo: '8', octava: '8', noveno: '9', novena: '9',
    decimo: '10', decima: '10', undecimo: '11', undecima: '11',
    primer: '1', primersemestre: '1', segundosemestre: '2', tercer: '3', tercersemestre: '3', cuartosemestre: '4', once: '11'
  };
  const word = grade.split(/\s+/).find(part => gradeWords[part]);
  return gradeWords[grade] || gradeWords[word] || grade.replace(/[^a-z0-9]/g, '');
};

const formatGrade = (value) => {
  const normalized = normalizeGrade(value);
  return /^\d+$/.test(normalized) ? `${normalized}°` : String(value || '').trim();
};

const QuestionnaireIndicatorsManager = ({
  questionnaireId,
  questionnaireTitle,
  questionnaireSubject,
  questionnaireGrade,
  questionnairePhase
}) => {
  const [indicators, setIndicators] = useState([]);
  const [availableIndicators, setAvailableIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIndicator, setNewIndicator] = useState({
    indicator_id: '',
    passing_score: 3.50,
    weight: 1.00
  });

  const linkedIndicatorIds = new Set(indicators.map(indicator => String(indicator.indicator_id)));
  const compatibleIndicators = availableIndicators
    .filter(indicator => !linkedIndicatorIds.has(String(indicator.id)))
    .filter(indicator => !questionnaireSubject || normalizeText(indicator.subject) === normalizeText(questionnaireSubject))
    .filter(indicator => {
      const indicatorGrade = indicator.grade ?? indicator.grade_label;
      return !normalizeGrade(indicatorGrade)
        || normalizeGrade(indicatorGrade) === normalizeGrade(questionnaireGrade);
    })
    .filter(indicator => !indicator.phase || !questionnairePhase || Number(indicator.phase) === Number(questionnairePhase))
    .sort((a, b) => {
      const aSpecific = normalizeGrade(a.grade ?? a.grade_label) ? 0 : 1;
      const bSpecific = normalizeGrade(b.grade ?? b.grade_label) ? 0 : 1;
      return aSpecific - bSpecific || String(a.description || '').localeCompare(String(b.description || ''), 'es');
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
      Swal.fire('Error', error.response?.data?.message || 'No se pudo asociar el indicador al cuestionario', 'error');
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
                    {compatibleIndicators.map(indicator => {
                      const indicatorGrade = indicator.grade ?? indicator.grade_label;
                      const gradeLabel = normalizeGrade(indicatorGrade)
                        ? formatGrade(indicatorGrade)
                        : `General; se aplicará a ${formatGrade(questionnaireGrade) || 'este grado'}`;
                      return (
                        <option key={indicator.id} value={indicator.id}>
                          {indicator.description} — {indicator.subject || questionnaireSubject || 'Sin materia'} — {gradeLabel} — Fase {indicator.phase || questionnairePhase || 'general'}
                        </option>
                      );
                    })}
                  </select>
                  <small className="form-text text-muted">
                    Se muestran indicadores de {questionnaireSubject || 'la materia del cuestionario'} compatibles con {formatGrade(questionnaireGrade) || 'el grado'}; los generales se pueden reutilizar.
                  </small>
                  {compatibleIndicators.length === 0 && (
                    <small className="d-block mt-1 text-warning">
                      No hay indicadores compatibles disponibles. Revisa la materia y el grado de tus indicadores o crea uno para este nivel.
                    </small>
                  )}
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
                  <th title="Si el indicador es general, se muestra el grado al que se aplica en este cuestionario">Grado</th>
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
                    <td>
                      {normalizeGrade(indicator.grade || indicator.grade_label)
                        ? formatGrade(indicator.grade || indicator.grade_label)
                        : questionnaireGrade
                          ? <><span>{formatGrade(questionnaireGrade)}</span><small className="d-block text-muted">Contexto del cuestionario</small></>
                          : <span className="text-muted">General</span>}
                    </td>
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
