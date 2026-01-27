import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';

/**
 * Plantillas por asignatura (Micro-SaaS).
 * El docente elige una asignatura (y opcionalmente grado), ve los indicadores sugeridos
 * y aplica la plantilla para crearlos en su banco.
 */
export default function PlantillasPorAsignatura() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [templateIndicators, setTemplateIndicators] = useState([]);
  const [teacherId, setTeacherId] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [appliedIndicators, setAppliedIndicators] = useState([]);
  const [loadingApplied, setLoadingApplied] = useState(false);
  const isAdmin = user?.role === 'administrador' || user?.role === 'super_administrador';
  const tid = user?.role === 'docente' ? teacherId : (isAdmin ? teacherId : null);

  const fetchApplied = React.useCallback(async () => {
    if (!tid) {
      setAppliedIndicators([]);
      return;
    }
    setLoadingApplied(true);
    try {
      const r = await axiosClient.get(`/indicators?from_template=1&teacher_id=${tid}`);
      const data = r.data?.data || r.data || [];
      setAppliedIndicators(Array.isArray(data) ? data : []);
    } catch (e) {
      setAppliedIndicators([]);
    } finally {
      setLoadingApplied(false);
    }
  }, [tid]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [subRes, teacherRes, teachersRes] = await Promise.all([
          axiosClient.get('/indicators/templates/subjects'),
          user?.role === 'docente' ? axiosClient.get(`/teachers/by-user/${user.id}`) : Promise.resolve({ data: {} }),
          isAdmin ? axiosClient.get('/teachers').catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
        ]);
        const subData = subRes.data?.data || subRes.data || [];
        setSubjects(Array.isArray(subData) ? subData : []);
        if (user?.role === 'docente') {
          const t = teacherRes.data?.data || teacherRes.data;
          if (t?.id) setTeacherId(t.id);
        }
        if (isAdmin && Array.isArray(teachersRes?.data)) setTeachers(teachersRes.data);
      } catch (e) {
        console.error(e);
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user, isAdmin]);

  useEffect(() => {
    fetchApplied();
  }, [fetchApplied]);

  useEffect(() => {
    if (!selectedSubject) {
      setTemplateIndicators([]);
      return;
    }
    let cancelled = false;
    axiosClient.get(`/indicators/templates/${encodeURIComponent(selectedSubject)}`)
      .then((r) => {
        if (!cancelled) setTemplateIndicators(r.data?.data || r.data || []);
      })
      .catch(() => { if (!cancelled) setTemplateIndicators([]); });
    return () => { cancelled = true; };
  }, [selectedSubject]);

  const handleApply = async () => {
    if (!selectedSubject) return;
    const tid = user?.role === 'docente' ? teacherId : (isAdmin ? teacherId : null);
    if (!tid) {
      Swal.fire({
        title: 'Error',
        text: isAdmin ? 'Selecciona un docente para aplicar la plantilla.' : 'No se pudo identificar al docente.',
        icon: 'error'
      });
      return;
    }
    setApplying(true);
    try {
      const payload = { subject: selectedSubject, grade: grade || null, teacher_id: tid };
      await axiosClient.post('/indicators/apply-template', payload);
      await Swal.fire({
        title: 'Plantilla aplicada',
        text: `Se crearon ${templateIndicators.length} indicadores para ${selectedSubject}.`,
        icon: 'success'
      });
      setSelectedSubject('');
      setGrade('');
      setTemplateIndicators([]);
      fetchApplied();
    } catch (e) {
      Swal.fire({
        title: 'Error',
        text: e.response?.data?.message || 'No se pudo aplicar la plantilla',
        icon: 'error'
      });
    } finally {
      setApplying(false);
    }
  };

  if (!user || (user.role !== 'docente' && user.role !== 'administrador' && user.role !== 'super_administrador')) {
    return (
      <div className="alert alert-warning">
        Solo docentes y administradores pueden usar plantillas por asignatura.
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Plantillas por asignatura</h4>
        <Link to="/indicadores" className="btn btn-outline-secondary">Volver a Indicadores</Link>
      </div>

      <div className="card mb-4">
        <div className="card-header bg-light">
          <h6 className="mb-0">¿Cómo funciona? ¿Dónde se ven las plantillas?</h6>
        </div>
        <div className="card-body small text-muted">
          <p className="mb-1">
            Las plantillas son <strong>paquetes de indicadores sugeridos</strong> por asignatura (Matemáticas, Inglés, Español, etc.).
          </p>
          <p className="mb-1">
            Al elegir una asignatura y hacer clic en <strong>«Aplicar plantilla»</strong>, se crean en el banco del docente los indicadores de esa plantilla.
            No sustituye los que ya tiene; solo añade nuevos.
          </p>
          <p className="mb-0">
            <strong>Dónde ver las plantillas aplicadas:</strong> debajo puedes ver las plantillas que has aplicado. También aparecen en <Link to="/indicadores">Indicadores</Link>, donde puedes editarlas, asignarlas a cuestionarios o estudiantes y eliminarlas.
          </p>
        </div>
      </div>

      {tid && (
        <div className="card mb-4">
          <div className="card-header bg-light d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Plantillas aplicadas</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={loadingApplied} onClick={fetchApplied}>
              {loadingApplied ? 'Cargando…' : 'Refrescar'}
            </button>
          </div>
          <div className="card-body">
            {loadingApplied && appliedIndicators.length === 0 ? (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm text-primary" />
              </div>
            ) : appliedIndicators.length === 0 ? (
              <p className="text-muted small mb-0">
                No hay plantillas aplicadas aún. Aplica una asignatura arriba para crearlas. Solo se listan las aplicadas desde que se habilitó esta función.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Asignatura</th>
                      <th>Grado</th>
                      <th>Descripción</th>
                      <th>Categoría</th>
                      <th>Fase</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {appliedIndicators.map((i) => (
                      <tr key={i.id}>
                        <td>{i.subject || '—'}</td>
                        <td>{i.grade ?? '—'}</td>
                        <td>{i.description || '—'}</td>
                        <td>{i.category || '—'}</td>
                        <td>{i.phase ?? '—'}</td>
                        <td>
                          <Link to={`/indicadores/${i.id}/editar`} className="btn btn-sm btn-outline-primary">Editar</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            {isAdmin && teachers.length > 0 && (
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label">Docente (admin/super)</label>
                  <select
                    className="form-select"
                    value={teacherId || ''}
                    onChange={(e) => setTeacherId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  >
                    <option value="">Seleccionar docente...</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || t.user?.name || `Docente ${t.id}`} {t.subject ? `— ${t.subject}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="row g-3 mb-4">
              <div className="col-md-5">
                <label className="form-label">Asignatura</label>
                <select
                  className="form-select"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Grado (opcional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej. 11"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                />
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!selectedSubject || applying || !tid}
                  onClick={handleApply}
                >
                  {applying ? 'Aplicando…' : 'Aplicar plantilla'}
                </button>
              </div>
            </div>

            {selectedSubject && templateIndicators.length > 0 && (
              <>
                <h6 className="mb-2">Vista previa — {selectedSubject}</h6>
                <div className="table-responsive">
                  <table className="table table-sm table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>Descripción</th>
                        <th>Categoría</th>
                        <th>Fase</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateIndicators.map((t, i) => (
                        <tr key={i}>
                          <td>{t.description}</td>
                          <td>{t.category || '—'}</td>
                          <td>{t.phase}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
