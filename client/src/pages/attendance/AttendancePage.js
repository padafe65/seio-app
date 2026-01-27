import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';

const BASE = window.location.origin || '';

export default function AttendancePage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [filters, setFilters] = useState({ grades: [], courses: [] });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', session_date: new Date().toISOString().slice(0, 10), grade: '', course_id: '' });
  const [detail, setDetail] = useState(null);
  const [students, setStudents] = useState([]);
  const [manualGrade, setManualGrade] = useState('');
  const [manualCourse, setManualCourse] = useState('');
  const [savingRecords, setSavingRecords] = useState(false);
  const [records, setRecords] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  const isAdmin = user?.role === 'administrador' || user?.role === 'super_administrador';

  useEffect(() => {
    if (isAdmin) {
      axiosClient.get('/teachers/list').then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        const mapped = list.map((t) => ({ id: t.id, name: t.name || `Docente ${t.id}` }));
        setTeachers(mapped);
        if (mapped.length && !selectedTeacherId) setSelectedTeacherId(String(mapped[0].id));
      }).catch(() => setTeachers([]));
    }
  }, [isAdmin, selectedTeacherId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedTeacherId]);

  async function load() {
    try {
      setLoading(true);
      const params = isAdmin && selectedTeacherId ? `?teacher_id=${selectedTeacherId}` : '';
      const [sessRes, filtRes] = await Promise.all([
        axiosClient.get(`/attendance/sessions${params}`),
        axiosClient.get(`/attendance/filters${params}`)
      ]);
      setSessions(sessRes.data?.data || []);
      const d = filtRes.data?.data || {};
      setFilters({ grades: d.grades || [], courses: d.courses || [] });
    } catch (e) {
      console.error(e);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  async function createSession() {
    if (!form.session_date) return;
    if (isAdmin && !selectedTeacherId) {
      Swal.fire({ title: 'Selecciona un docente', icon: 'warning' });
      return;
    }
    try {
      setCreating(true);
      const payload = {
        name: form.name || null,
        session_date: form.session_date,
        grade: form.grade || null,
        course_id: form.course_id || null
      };
      if (isAdmin && selectedTeacherId) payload.teacher_id = Number(selectedTeacherId);
      await axiosClient.post('/attendance/sessions', payload);
      Swal.fire({ title: 'Sesión creada', icon: 'success' });
      setForm({ name: '', session_date: new Date().toISOString().slice(0, 10), grade: '', course_id: '' });
      load();
    } catch (e) {
      Swal.fire({ title: 'Error', text: e.response?.data?.message || 'No se pudo crear la sesión', icon: 'error' });
    } finally {
      setCreating(false);
    }
  }

  async function openDetail(id) {
    try {
      const r = await axiosClient.get(`/attendance/sessions/${id}`);
      const data = r.data?.data || null;
      setDetail(data);
      setManualGrade(data?.grade || '');
      setManualCourse(data?.course_id ?? '');
      setRecords({});
    } catch (e) {
      Swal.fire({ title: 'Error', text: 'No se pudo cargar la sesión', icon: 'error' });
    }
  }

  async function loadStudentsForManual(grade, courseId, initialRecords, teacherId) {
    try {
      const params = new URLSearchParams();
      if (teacherId != null) params.set('teacher_id', teacherId);
      if (grade) params.set('grade', grade);
      if (courseId) params.set('course_id', courseId);
      const r = await axiosClient.get(`/attendance/students?${params}`);
      const list = r.data?.data || [];
      setStudents(list);
      const map = {};
      (initialRecords || []).forEach((rec) => { map[rec.student_id] = rec.status; });
      list.forEach((st) => { if (map[st.id] == null) map[st.id] = 'absent'; });
      setRecords(map);
    } catch (e) {
      setStudents([]);
    }
  }

  useEffect(() => {
    if (!detail) return;
    loadStudentsForManual(manualGrade, manualCourse, detail.records || [], detail.teacher_id);
  }, [detail, manualGrade, manualCourse]);

  function setRecord(studentId, status) {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
  }

  async function saveRecords() {
    if (!detail?.id) return;
    try {
      setSavingRecords(true);
      const payload = Object.entries(records).map(([student_id, status]) => ({ student_id: Number(student_id), status }));
      await axiosClient.post('/attendance/records', { session_id: detail.id, records: payload });
      Swal.fire({ title: 'Guardado', icon: 'success' });
      openDetail(detail.id);
    } catch (e) {
      Swal.fire({ title: 'Error', text: e.response?.data?.message || 'No se pudo guardar', icon: 'error' });
    } finally {
      setSavingRecords(false);
    }
  }

  const validateUrl = detail?.token
    ? `${BASE}/asistencia/validar?token=${encodeURIComponent(detail.token)}`
    : '';

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <h4 className="mb-0">Control de asistencia</h4>
        <Link to="/dashboard" className="btn btn-outline-secondary">Volver al Dashboard</Link>
      </div>

      {isAdmin && teachers.length > 0 && (
        <div className="card mb-3">
          <div className="card-body py-2">
            <label className="form-label small mb-0">Docente</label>
            <select
              className="form-select form-select-sm"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Crear sesión */}
      <div className="card mb-4">
        <div className="card-header bg-white">
          <h5 className="mb-0">Nueva sesión de asistencia</h5>
        </div>
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label small">Nombre (opcional)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Ej. Matemáticas 15/02"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Fecha</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={form.session_date}
                onChange={(e) => setForm((f) => ({ ...f, session_date: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Grado</label>
              <select
                className="form-select form-select-sm"
                value={form.grade}
                onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
              >
                <option value="">Todos</option>
                {filters.grades.map((g) => (
                  <option key={g} value={g}>{g}°</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Curso</label>
              <select
                className="form-select form-select-sm"
                value={form.course_id}
                onChange={(e) => setForm((f) => ({ ...f, course_id: e.target.value }))}
              >
                <option value="">Todos</option>
                {filters.courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-primary btn-sm w-100" onClick={createSession} disabled={creating}>
                {creating ? 'Creando…' : 'Crear sesión'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de sesiones */}
      <div className="card">
        <div className="card-header bg-white">
          <h5 className="mb-0">Sesiones recientes</h5>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" />
            </div>
          ) : !sessions.length ? (
            <p className="text-muted mb-0">No hay sesiones. Crea una arriba.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Fecha</th>
                    <th>Grado</th>
                    <th>Código</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name || '—'}</td>
                      <td>{s.session_date}</td>
                      <td>{s.grade ? `${s.grade}°` : '—'}</td>
                      <td><code>{s.short_code}</code></td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openDetail(s.id)}>
                          Ver / Registrar
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

      {/* Modal detalle: QR + registro manual */}
      {detail && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,.5)' }} role="dialog">
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {detail.name || 'Sesión'} — {detail.session_date} · Código <code>{detail.short_code}</code>
                </h5>
                <button type="button" className="btn-close" onClick={() => setDetail(null)} aria-label="Cerrar" />
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-4">
                    <p className="small text-muted mb-2">Los estudiantes escanean este QR o entran el código <strong>{detail.short_code}</strong> en la app.</p>
                    {validateUrl && (
                      <div className="bg-white p-2 rounded border d-inline-block">
                        <QRCodeSVG value={validateUrl} size={180} level="M" />
                      </div>
                    )}
                    <p className="small text-muted mt-2">Enlace: <a href={validateUrl} target="_blank" rel="noopener noreferrer">{validateUrl}</a></p>
                  </div>
                  <div className="col-md-8">
                    <h6>Registro manual (por grado y curso)</h6>
                    <div className="row g-2 mb-3">
                      <div className="col-md-4">
                        <label className="form-label small">Grado</label>
                        <select
                          className="form-select form-select-sm"
                          value={manualGrade}
                          onChange={(e) => { setManualGrade(e.target.value); }}
                        >
                          <option value="">Todos</option>
                          {filters.grades.map((g) => (
                            <option key={g} value={g}>{g}°</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small">Curso</label>
                        <select
                          className="form-select form-select-sm"
                          value={manualCourse}
                          onChange={(e) => { setManualCourse(e.target.value); }}
                        >
                          <option value="">Todos</option>
                          {filters.courses.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Estudiante</th>
                            <th>Curso</th>
                            <th>Presente</th>
                            <th>Ausente</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((st) => (
                            <tr key={st.id}>
                              <td>{st.student_name}</td>
                              <td>{st.course_name || '—'}</td>
                              <td>
                                <input
                                  type="radio"
                                  name={`att-${st.id}`}
                                  checked={(records[st.id] || '') === 'present'}
                                  onChange={() => setRecord(st.id, 'present')}
                                />
                              </td>
                              <td>
                                <input
                                  type="radio"
                                  name={`att-${st.id}`}
                                  checked={(records[st.id] || '') === 'absent'}
                                  onChange={() => setRecord(st.id, 'absent')}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!students.length && <p className="text-muted small">Selecciona grado y/o curso para ver estudiantes.</p>}
                    <div className="mt-2">
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveRecords} disabled={savingRecords || !students.length}>
                        {savingRecords ? 'Guardando…' : 'Guardar asistencia'}
                      </button>
                    </div>
                    <hr />
                    <h6>Registros actuales</h6>
                    <ul className="list-unstyled small">
                      {(detail.records || []).map((r) => (
                        <li key={r.student_id}>
                          {r.student_name} — <span className={r.status === 'present' ? 'text-success' : 'text-danger'}>{r.status === 'present' ? 'Presente' : 'Ausente'}</span>
                          {r.source === 'qr' && <span className="text-muted"> (QR)</span>}
                        </li>
                      ))}
                      {(!detail.records || !detail.records.length) && <li className="text-muted">Aún no hay registros.</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
