// src/pages/students/StudentGrades.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';

const StudentGrades = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [grades, setGrades] = useState(null);
  const [phaseAverages, setPhaseAverages] = useState([]);
  const [manualGrades, setManualGrades] = useState([]);
  const [assignedTeacherId, setAssignedTeacherId] = useState(null);
  const [newGradeInputs, setNewGradeInputs] = useState({
    1: { score: '', description: '' },
    2: { score: '', description: '' },
    3: { score: '', description: '' },
    4: { score: '', description: '' }
  });
  const [savingPhase, setSavingPhase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canEditGrades = user && ['docente', 'administrador', 'super_administrador'].includes(user.role);

  const refreshGradeData = useCallback(async (userId, studentId = id, shouldRecalculate = false) => {
    if (shouldRecalculate) {
      await axiosClient.post(`/phase-averages/students/${studentId}/recalculate`);
    }
    const [evaluationsRes, manualRes] = await Promise.all([
      axiosClient.get(`/quiz/evaluations-by-phase/${userId}`),
      axiosClient.get(`/phase-averages/students/${studentId}/manual-grades`)
    ]);
    const phaseData = evaluationsRes.data || [];
    setPhaseAverages(phaseData);
    setManualGrades(manualRes.data?.grades || []);
    setAssignedTeacherId(manualRes.data?.teacher_id || null);

    const withOverall = phaseData.find((phase) => phase.overall_average != null);
    if (withOverall) {
      setGrades({ overall_average: withOverall.overall_average });
    } else {
      const valid = phaseData.map((phase) => phase.phase_average).filter((value) => value != null);
      setGrades(valid.length ? { overall_average: (valid.reduce((sum, value) => sum + parseFloat(value), 0) / valid.length).toFixed(2) } : null);
    }
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const studentRes = await axiosClient.get(`/students/${id}`);
        const studentData = studentRes.data.data || studentRes.data;
        setStudent(studentData);

        const userId = studentData.user_id;
        if (!userId) {
          setError('No se pudo obtener la información del estudiante');
          setLoading(false);
          return;
        }

        await refreshGradeData(userId, id, true);
      } catch (err) {
        console.error('Error al cargar calificaciones:', err);
        setError('No se pudo cargar la información de calificaciones');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, refreshGradeData]);

  const formatGrade = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return parseFloat(value).toFixed(1);
  };

  const formatDateInput = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  };

  const handleManualChange = (phase, value) => {
    setNewGradeInputs((previous) => ({
      ...previous,
      [phase]: { ...previous[phase], ...value }
    }));
  };

  const handleAddManualGrade = async (phase) => {
    if (!canEditGrades) return;
    const draft = newGradeInputs[phase];
    const score = Number(draft.score);
    if (draft.score === '' || !Number.isFinite(score) || score < 0 || score > 5) {
      await Swal.fire({ icon: 'warning', title: 'Nota inválida', text: 'Ingresa una nota entre 0 y 5.' });
      return;
    }
    setSavingPhase(phase);
    try {
      await axiosClient.post(`/phase-averages/students/${id}/manual-grades`, {
        phase,
        score,
        description: draft.description,
        assessment_date: draft.assessment_date || null,
        teacher_id: assignedTeacherId
      });
      setNewGradeInputs((previous) => ({ ...previous, [phase]: { score: '', description: '', assessment_date: '' } }));
      await refreshGradeData(student.user_id);
      await Swal.fire({ icon: 'success', title: 'Guardada', text: 'La nota manual se agregó y se recalcularon los promedios.' });
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'No se pudo guardar la nota manual.' });
    } finally {
      setSavingPhase(null);
    }
  };

  const handleEditManualGrade = async (grade) => {
    const result = await Swal.fire({
      title: 'Editar nota manual',
      input: 'number',
      inputValue: grade.score,
      inputAttributes: { min: 0, max: 5, step: 0.01 },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        const score = Number(value);
        if (value === '' || !Number.isFinite(score) || score < 0 || score > 5) return 'Ingresa una nota entre 0 y 5.';
        return undefined;
      }
    });
    if (!result.isConfirmed) return;
    try {
      await axiosClient.put(`/phase-averages/manual-grades/${grade.id}`, {
        phase: grade.phase,
        score: Number(result.value),
        description: grade.description,
        assessment_date: formatDateInput(grade.assessment_date)
      });
      await refreshGradeData(student.user_id);
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'No se pudo actualizar la nota.' });
    }
  };

  const handleDeleteManualGrade = async (grade) => {
    const confirmation = await Swal.fire({
      title: '¿Eliminar esta nota?',
      text: 'Se volverá a calcular el promedio manual y la definitiva de la fase.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmation.isConfirmed) return;
    try {
      await axiosClient.delete(`/phase-averages/manual-grades/${grade.id}`);
      await refreshGradeData(student.user_id);
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'No se pudo eliminar la nota.' });
    }
  };

  const backHref = user?.role === 'docente' ? '/mis-estudiantes' : '/estudiantes';
  const displayPhases = [1, 2, 3, 4].map((phase) =>
    phaseAverages.find((item) => Number(item.phase) === phase) || {
      phase,
      total_evaluations: 0,
      average_score: null,
      average_score_manual: null,
      phase_average: null
    }
  );

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <i className="bi bi-exclamation-triangle-fill me-2" />
        {error}
      </div>
    );
  }

  if (!student) {
    return (
      <div className="alert alert-warning">No se encontró el estudiante solicitado.</div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h4 className="mb-0">Calificaciones de {student.user_name || student.name}</h4>
        <div className="d-flex gap-2">
          <Link to={`/estudiantes/${id}`} className="btn btn-outline-secondary">
            Ver Perfil
          </Link>
          <Link to={backHref} className="btn btn-outline-secondary">
            Volver
          </Link>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header bg-white">
          <h5 className="mb-0">Información del Estudiante</h5>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <p><strong>Nombre:</strong> {student.user_name || student.name}</p>
              <p><strong>Email:</strong> {student.user_email || student.email}</p>
            </div>
            <div className="col-md-6">
              <p><strong>Grado:</strong> {student.grade}°</p>
              <p><strong>Curso:</strong> {student.course_name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h5 className="mb-0">Calificaciones por Fase</h5>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead className="table-light">
                <tr>
                  <th>Fase</th>
                  <th>Evaluaciones virtuales</th>
                  <th>Promedio virtual</th>
                  <th>Notas manuales individuales</th>
                  <th>Promedio manual</th>
                  <th>Definitiva</th>
                </tr>
              </thead>
              <tbody>
                {displayPhases.map((phase, idx) => {
                    const phaseManualGrades = manualGrades.filter((grade) => Number(grade.phase) === Number(phase.phase));
                    const draft = newGradeInputs[phase.phase];
                    return (
                      <tr key={idx}>
                        <td>Fase {phase.phase}</td>
                        <td>{phase.total_evaluations}</td>
                        <td>{formatGrade(phase.average_score)}</td>
                        <td>
                          <div className="d-flex flex-column gap-2" style={{ minWidth: '280px' }}>
                            {phaseManualGrades.map((grade) => (
                              <div key={grade.id} className="d-flex align-items-center justify-content-between gap-2 border rounded p-2">
                                <span>
                                  <strong>{formatGrade(grade.score)}</strong>
                                  {grade.description && <span className="ms-2">{grade.description}</span>}
                                  {grade.assessment_date && <small className="text-muted ms-2">{formatDateInput(grade.assessment_date)}</small>}
                                </span>
                                {canEditGrades && (
                                  <span className="d-flex gap-1">
                                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => handleEditManualGrade(grade)}>Editar</button>
                                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteManualGrade(grade)}>Eliminar</button>
                                  </span>
                                )}
                              </div>
                            ))}
                            {phaseManualGrades.length === 0 && <span className="text-muted">Sin notas manuales</span>}
                            {canEditGrades && (
                              <div className="border rounded p-2">
                                <div className="row g-2">
                                  <div className="col-4">
                                    <input
                                      type="number" step="0.01" min="0" max="5"
                                      className="form-control form-control-sm"
                                      placeholder="Nota 0–5"
                                      value={draft.score}
                                      onChange={(e) => handleManualChange(phase.phase, { score: e.target.value })}
                                    />
                                  </div>
                                  <div className="col-8">
                                    <input
                                      type="text" maxLength="255"
                                      className="form-control form-control-sm"
                                      placeholder="Actividad o descripción (opcional)"
                                      value={draft.description}
                                      onChange={(e) => handleManualChange(phase.phase, { description: e.target.value })}
                                    />
                                  </div>
                                  <div className="col-7">
                                    <input
                                      type="date"
                                      className="form-control form-control-sm"
                                      value={draft.assessment_date || ''}
                                      onChange={(e) => handleManualChange(phase.phase, { assessment_date: e.target.value })}
                                    />
                                  </div>
                                  <div className="col-5">
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm w-100"
                                      disabled={savingPhase === phase.phase}
                                      onClick={() => handleAddManualGrade(phase.phase)}
                                    >
                                      {savingPhase === phase.phase ? 'Guardando…' : 'Agregar nota'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>{formatGrade(phase.average_score_manual)}</td>
                        <td>{formatGrade(phase.phase_average)}</td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot className="table-light">
                <tr>
                  <th colSpan="5">Promedio general</th>
                  <th>
                    {grades?.overall_average != null ? (
                      <span className={parseFloat(grades.overall_average) >= 3.0 ? 'badge bg-success' : 'badge bg-danger'}>
                        {parseFloat(grades.overall_average).toFixed(1)}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </th>
                </tr>
              </tfoot>
            </table>
          </div>
          {canEditGrades && (
            <p className="text-muted small mb-0 mt-2">
              Puedes agregar varias notas manuales por fase. El promedio manual se combina con el promedio virtual disponible; si solo existe uno, ese será la definitiva.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentGrades;
