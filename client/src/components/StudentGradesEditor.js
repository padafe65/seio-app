import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const StudentGradesEditor = ({ studentId, onGradesUpdated }) => {
  const [grades, setGrades] = useState({
    phase1: '',
    phase2: '',
    phase3: '',
    phase4: '',
    average: ''
  });
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    if (studentId) {
      fetchStudentData();
    }
  }, [studentId]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      
      // Obtener notas del estudiante
      const gradesResponse = await axios.get(
        `${API_URL}/api/students/${studentId}/grades`,
        getAuthConfig()
      );
      
      if (gradesResponse.data && gradesResponse.data.length > 0) {
        const studentGrades = gradesResponse.data[0];
        setGrades({
          phase1: studentGrades.phase1 || '',
          phase2: studentGrades.phase2 || '',
          phase3: studentGrades.phase3 || '',
          phase4: studentGrades.phase4 || '',
          average: studentGrades.average || ''
        });
      }

      // Obtener intentos de quiz del estudiante
      const attemptsResponse = await axios.get(
        `${API_URL}/api/quiz-attempts/student/${studentId}`,
        getAuthConfig()
      );
      
      setQuizAttempts(attemptsResponse.data || []);
      
    } catch (error) {
      console.error('Error al cargar datos del estudiante:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los datos del estudiante'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (phase, value) => {
    setGrades(prev => ({
      ...prev,
      [phase]: value
    }));
    
    // Calcular promedio automáticamente
    calculateAverage(phase, value);
  };

  const calculateAverage = (changedPhase, newValue) => {
    const updatedGrades = { ...grades, [changedPhase]: newValue };
    const validGrades = [];
    
    ['phase1', 'phase2', 'phase3', 'phase4'].forEach(phase => {
      const value = phase === changedPhase ? newValue : grades[phase];
      if (value && !isNaN(parseFloat(value)) && parseFloat(value) > 0) {
        validGrades.push(parseFloat(value));
      }
    });
    
    if (validGrades.length > 0) {
      const average = validGrades.reduce((sum, grade) => sum + grade, 0) / validGrades.length;
      setGrades(prev => ({
        ...prev,
        average: average.toFixed(2)
      }));
    } else {
      setGrades(prev => ({
        ...prev,
        average: ''
      }));
    }
  };

  const handleSaveGrades = async () => {
    try {
      setSaving(true);
      
      const gradesData = {
        student_id: studentId,
        phase1: grades.phase1 || null,
        phase2: grades.phase2 || null,
        phase3: grades.phase3 || null,
        phase4: grades.phase4 || null,
        average: grades.average || null
      };

      // Actualizar notas en la base de datos
      const response = await axios.put(
        `${API_URL}/api/students/${studentId}/grades`,
        gradesData,
        getAuthConfig()
      );

      if (response.data.success) {
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Las notas han sido actualizadas correctamente'
        });
        
        // Notificar al componente padre
        if (onGradesUpdated) {
          onGradesUpdated();
        }
        
        // Recargar datos
        fetchStudentData();
      } else {
        throw new Error(response.data.message || 'Error al actualizar las notas');
      }
      
    } catch (error) {
      console.error('Error al guardar notas:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudieron actualizar las notas'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManualRecalculate = async () => {
    try {
      setSaving(true);
      
      const response = await axios.post(
        `${API_URL}/api/recalculate-phase-averages/${studentId}`,
        {},
        getAuthConfig()
      );

      if (response.data.success) {
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Los promedios han sido recalculados automáticamente'
        });
        
        // Notificar al componente padre
        if (onGradesUpdated) {
          onGradesUpdated();
        }
        
        // Recargar datos
        fetchStudentData();
      } else {
        throw new Error(response.data.error || 'Error al recalcular promedios');
      }
      
    } catch (error) {
      console.error('Error al recalcular promedios:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron recalcular los promedios automáticamente'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateQuizAttempt = async (attemptId, newScore) => {
    try {
      const response = await axios.put(
        `${API_URL}/api/quiz-attempts/${attemptId}`,
        { score: newScore },
        getAuthConfig()
      );

      if (response.data.success) {
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'El intento ha sido actualizado correctamente'
        });
        
        // Notificar al componente padre para que recargue datos
        if (onGradesUpdated) {
          onGradesUpdated();
        }
        
        // Esperar un momento para que el backend complete el recálculo
        setTimeout(() => {
          fetchStudentData();
        }, 500);
      }
    } catch (error) {
      console.error('Error al actualizar intento:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo actualizar el intento'
      });
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
    <div className="card mt-4">
      <div className="card-header">
        <h5 className="mb-0">Editar Notas del Estudiante</h5>
      </div>
      <div className="card-body">
        {/* Formulario de notas por fases */}
        <div className="row mb-4">
          <div className="col-md-3">
            <label htmlFor="phase1" className="form-label">Fase 1</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="5"
              className="form-control"
              id="phase1"
              value={grades.phase1}
              onChange={(e) => handleGradeChange('phase1', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="col-md-3">
            <label htmlFor="phase2" className="form-label">Fase 2</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="5"
              className="form-control"
              id="phase2"
              value={grades.phase2}
              onChange={(e) => handleGradeChange('phase2', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="col-md-3">
            <label htmlFor="phase3" className="form-label">Fase 3</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="5"
              className="form-control"
              id="phase3"
              value={grades.phase3}
              onChange={(e) => handleGradeChange('phase3', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="col-md-3">
            <label htmlFor="phase4" className="form-label">Fase 4</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="5"
              className="form-control"
              id="phase4"
              value={grades.phase4}
              onChange={(e) => handleGradeChange('phase4', e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="row mb-4">
          <div className="col-md-6">
            <label htmlFor="average" className="form-label">Promedio</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="5"
              className="form-control"
              id="average"
              value={grades.average}
              readOnly
              style={{ backgroundColor: '#f8f9fa' }}
            />
            <div className="form-text">Calculado automáticamente</div>
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2 mb-4">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={handleManualRecalculate}
            disabled={saving}
          >
            Recalcular Automáticamente
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveGrades}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Guardando...
              </>
            ) : (
              'Guardar Notas'
            )}
          </button>
        </div>

        {/* Tabla de intentos de quiz */}
        {quizAttempts.length > 0 && (
          <div>
            <h6>Intentos de Evaluación</h6>
            <div className="table-responsive">
              <table className="table table-striped table-sm">
                <thead>
                  <tr>
                    <th>Cuestionario</th>
                    <th>Intento</th>
                    <th>Puntaje</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {quizAttempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>{attempt.questionnaire_title || `Cuestionario ${attempt.questionnaire_id}`}</td>
                      <td>{attempt.attempt_number}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="5"
                          className="form-control form-control-sm"
                          value={attempt.score}
                          onChange={(e) => {
                            const newScore = e.target.value;
                            setQuizAttempts(prev => 
                              prev.map(att => 
                                att.id === attempt.id ? { ...att, score: newScore } : att
                              )
                            );
                          }}
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td>{new Date(attempt.attempt_date).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleUpdateQuizAttempt(attempt.id, attempt.score)}
                        >
                          Actualizar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentGradesEditor;
