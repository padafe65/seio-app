// src/pages/students/StudentGrades.js
import React, { useState, useEffect } from 'react';
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
  const [manualInputs, setManualInputs] = useState({ 1: '', 2: '', 3: '', 4: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canEditGrades = user && ['docente', 'administrador', 'super_administrador'].includes(user.role);

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

        const evaluationsRes = await axiosClient.get(`/quiz/evaluations-by-phase/${userId}`);
        const phaseData = evaluationsRes.data || [];
        setPhaseAverages(phaseData);

        const initial = { 1: '', 2: '', 3: '', 4: '' };
        phaseData.forEach((p) => {
          const v = p.average_score_manual;
          if (v != null && !isNaN(parseFloat(v))) {
            initial[p.phase] = parseFloat(v).toFixed(2);
          }
        });
        setManualInputs(initial);

        let overallGrade = null;
        if (phaseData.length > 0) {
          const withOverall = phaseData.find((g) => g.overall_average != null);
          if (withOverall) {
            overallGrade = { overall_average: withOverall.overall_average };
          } else {
            const valid = phaseData
              .map((p) => p.phase_average)
              .filter((avg) => avg != null);
            if (valid.length > 0) {
              const avg = valid.reduce((s, a) => s + parseFloat(a), 0) / valid.length;
              overallGrade = { overall_average: avg.toFixed(2) };
            }
          }
        }
        setGrades(overallGrade);
      } catch (err) {
        console.error('Error al cargar calificaciones:', err);
        setError('No se pudo cargar la información de calificaciones');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const formatGrade = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return parseFloat(value).toFixed(1);
  };

  const handleManualChange = (phase, value) => {
    let v = value.trim();
    if (v !== '') {
      const n = parseFloat(v);
      if (isNaN(n) || n < 0 || n > 5) return;
      v = Math.min(5, Math.max(0, n)).toFixed(2);
    }
    setManualInputs((prev) => ({ ...prev, [phase]: v }));
  };

  const handleSaveManuals = async () => {
    if (!canEditGrades) return;
    setSaving(true);
    try {
      const phases = [1, 2, 3, 4];
      let ok = 0;
      let errMsg = null;
      for (const phase of phases) {
        const raw = manualInputs[phase];
        const value = raw === '' || raw == null ? null : Math.min(5, Math.max(0, parseFloat(raw)));
        try {
          await axiosClient.put(
            `/phase-averages/students/${id}/phases/${phase}/manual`,
            { average_score_manual: value }
          );
          ok++;
        } catch (e) {
          if (e.response?.status === 404) continue;
          errMsg = e.response?.data?.error || e.message;
          break;
        }
      }
      if (errMsg) {
        await Swal.fire({ icon: 'error', title: 'Error', text: errMsg });
      } else if (ok > 0) {
        await Swal.fire({ icon: 'success', title: 'Guardado', text: 'Notas manuales actualizadas.' });
        const userId = student?.user_id;
        if (userId) {
          const res = await axiosClient.get(`/quiz/evaluations-by-phase/${userId}`);
          const data = res.data || [];
          setPhaseAverages(data);
          const next = { 1: '', 2: '', 3: '', 4: '' };
          data.forEach((p) => {
            const v = p.average_score_manual;
            if (v != null && !isNaN(parseFloat(v))) next[p.phase] = parseFloat(v).toFixed(2);
          });
          setManualInputs(next);
          const withOverall = data.find((g) => g.overall_average != null);
          if (withOverall) {
            setGrades({ overall_average: withOverall.overall_average });
          } else {
            const valid = data.map((p) => p.phase_average).filter((a) => a != null);
            if (valid.length > 0) {
              const avg = valid.reduce((s, a) => s + parseFloat(a), 0) / valid.length;
              setGrades({ overall_average: avg.toFixed(2) });
            }
          }
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const backHref = user?.role === 'docente' ? '/mis-estudiantes' : '/estudiantes';

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
          {canEditGrades && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveManuals}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  Guardando...
                </>
              ) : (
                'Guardar notas manuales'
              )}
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead className="table-light">
                <tr>
                  <th>Fase</th>
                  <th>Evaluaciones</th>
                  <th>Nota sistema</th>
                  <th>Nota manual</th>
                  <th>Definitiva</th>
                </tr>
              </thead>
              <tbody>
                {phaseAverages.length > 0 ? (
                  phaseAverages.map((phase, idx) => {
                    const hasManual = phase.average_score_manual != null && !isNaN(parseFloat(phase.average_score_manual));
                    return (
                      <tr key={idx}>
                        <td>Fase {phase.phase}</td>
                        <td>{phase.total_evaluations}</td>
                        <td>{formatGrade(phase.average_score)}</td>
                        <td>
                          {canEditGrades ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="5"
                              className="form-control form-control-sm"
                              style={{ width: '90px' }}
                              value={manualInputs[phase.phase] ?? ''}
                              onChange={(e) => handleManualChange(phase.phase, e.target.value)}
                              placeholder="—"
                            />
                          ) : hasManual ? (
                            formatGrade(phase.average_score_manual)
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          {formatGrade(phase.phase_average)}
                          {!hasManual && (phase.average_score != null || phase.phase_average != null) && (
                            <span className="text-muted small d-block">(solo sistema)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center">No hay evaluaciones registradas</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="table-light">
                <tr>
                  <th colSpan="4">Promedio general</th>
                  <th>
                    {grades?.overall_average ? (
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
          {canEditGrades && phaseAverages.length > 0 && (
            <p className="text-muted small mb-0 mt-2">
              Puedes ingresar o editar la nota manual por fase (0–5). Vacío = solo nota del sistema. Guarda los cambios con el botón superior.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentGrades;
