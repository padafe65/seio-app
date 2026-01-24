import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';

const CalificacionesPorFasePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [filters, setFilters] = useState({ grado: '', curso: '', fase: '' });

  const isDocente = user?.role === 'docente';
  const isAdmin = user?.role === 'administrador' || user?.role === 'super_administrador';

  useEffect(() => {
    if (isAdmin) {
      axiosClient.get('/admin/users').then((r) => {
        const data = r.data?.data || r.data || [];
        const docentes = Array.isArray(data) ? data.filter((u) => u.role === 'docente') : [];
        setTeachers(docentes.map((u) => ({ id: u.id, name: u.name })));
      }).catch(() => setTeachers([]));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!user) return;
    if (isAdmin && !selectedTeacherId) {
      setGrades([]);
      setLoading(false);
      return;
    }
    const teacherParam = isDocente ? user.id : selectedTeacherId;
    if (isAdmin && !teacherParam) {
      setLoading(false);
      return;
    }
    setLoading(true);
    axiosClient.get(`/teacher/student-grades/${teacherParam}`)
      .then((r) => {
        setGrades(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => setGrades([]))
      .finally(() => setLoading(false));
  }, [user, isDocente, isAdmin, selectedTeacherId]);

  const uniqueGrados = useMemo(() => [...new Set(grades.map((g) => g.grade).filter(Boolean))].sort(), [grades]);
  const uniqueCursos = useMemo(() => {
    const seen = new Set();
    return grades.filter((g) => {
      const k = g.course_id ?? g.course_name;
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    }).map((g) => ({ id: g.course_id ?? g.course_name, name: g.course_name || '—' }));
  }, [grades]);
  const formatGrade = (v) => (v != null && !isNaN(parseFloat(v)) ? parseFloat(v).toFixed(1) : 'N/A');

  const filtered = useMemo(() => {
    let out = grades;
    if (filters.grado) out = out.filter((g) => String(g.grade) === String(filters.grado));
    if (filters.curso) out = out.filter((g) => String(g.course_id ?? g.course_name ?? '') === filters.curso);
    if (filters.fase) {
      const phase = parseInt(filters.fase, 10);
      if (!isNaN(phase)) out = out.filter((g) => {
        const v = g[`phase${phase}`];
        return v != null && !isNaN(parseFloat(v));
      });
    }
    return out;
  }, [grades, filters]);

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <h4 className="mb-0">Calificaciones por Fase</h4>
        <Link to="/dashboard" className="btn btn-outline-secondary">Volver al Dashboard</Link>
      </div>

      {isAdmin && teachers.length > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <label className="form-label">Docente</label>
            <select
              className="form-select"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
            >
              <option value="">Seleccionar docente</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label small">Grado</label>
              <select
                className="form-select form-select-sm"
                value={filters.grado}
                onChange={(e) => setFilters((f) => ({ ...f, grado: e.target.value }))}
              >
                <option value="">Todos</option>
                {uniqueGrados.map((g) => (
                  <option key={g} value={g}>{g}°</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small">Curso</label>
              <select
                className="form-select form-select-sm"
                value={filters.curso}
                onChange={(e) => setFilters((f) => ({ ...f, curso: e.target.value }))}
              >
                <option value="">Todos</option>
                {uniqueCursos.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small">Fase</label>
              <select
                className="form-select form-select-sm"
                value={filters.fase}
                onChange={(e) => setFilters((f) => ({ ...f, fase: e.target.value }))}
              >
                <option value="">Todas</option>
                <option value="1">Fase 1</option>
                <option value="2">Fase 2</option>
                <option value="3">Fase 3</option>
                <option value="4">Fase 4</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Calificaciones por Fase</h5>
          <small className="text-muted">(M) Manual · (S) Sistema</small>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Cargando...</span></div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted mb-0">
              {grades.length === 0 ? 'No hay calificaciones. Seleccione un docente (admin) o no hay datos para el docente actual.' : 'No hay registros con los filtros aplicados.'}
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Grado</th>
                    <th>Curso</th>
                    <th>Fase 1</th>
                    <th>Fase 2</th>
                    <th>Fase 3</th>
                    <th>Fase 4</th>
                    <th>Promedio</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => {
                    const phaseBadge = (n) => {
                      const manual = g[`phase${n}_manual`];
                      const val = formatGrade(g[`phase${n}`]);
                      if (val === 'N/A') return val;
                      const tag = manual != null && !isNaN(parseFloat(manual)) ? 'M' : (g[`phase${n}_system`] != null || g[`phase${n}`] != null ? 'S' : null);
                      return tag ? <>{val} <span className="badge bg-secondary">{tag}</span></> : val;
                    };
                    return (
                      <tr key={g.student_id}>
                        <td>{g.student_name}</td>
                        <td>{g.grade ? `${g.grade}°` : '—'}</td>
                        <td>{g.course_name || '—'}</td>
                        <td>{phaseBadge(1)}</td>
                        <td>{phaseBadge(2)}</td>
                        <td>{phaseBadge(3)}</td>
                        <td>{phaseBadge(4)}</td>
                        <td>{formatGrade(g.average)}</td>
                        <td>
                          <Link to={`/estudiantes/${g.student_id}/calificaciones`} className="btn btn-sm btn-outline-primary">Ver / Editar</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalificacionesPorFasePage;
