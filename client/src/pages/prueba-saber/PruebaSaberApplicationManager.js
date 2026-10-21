import React, { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export default function PruebaSaberApplicationManager() {
  const [questionnaires, setQuestionnaires] = useState([]);
  const [courses, setCourses] = useState([]);
  const [applications, setApplications] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState({ questionnaire_id: '', course_id: '', title: '', time_limit_minutes: '', institution: 'CRECER' });
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [enrollment, setEnrollment] = useState({ student_id: '', course_id: '' });
  const [enrollmentCodes, setEnrollmentCodes] = useState([]);
  const [codeForm, setCodeForm] = useState({ course_id: '', max_uses: '', expires_at: '' });
  const [newCode, setNewCode] = useState('');
  const { user } = useAuth();

  const load = async () => {
    const [q, c, a, s, ec] = await Promise.all([
      axiosClient.get('/questionnaires'), axiosClient.get('/courses'), axiosClient.get('/prueba-saber/applications'),
      ['administrador', 'admin', 'super_administrador'].includes(user?.role) ? axiosClient.get('/students').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      axiosClient.get('/prueba-saber/enrollment-codes').catch(() => ({ data: { data: [] } }))
    ]);
    setQuestionnaires((q.data || []).filter((item) => item.is_prueba_saber === 1 || item.is_prueba_saber === true));
    const allCourses = Array.isArray(c.data) ? c.data : [];
    setCourses(allCourses.filter((course) => String(course.institution || '').trim().toUpperCase() === 'CRECER' || /preicfes|pre-icfes/i.test(course.name || '')));
    setApplications(a.data?.data || []);
    setStudents(Array.isArray(s.data) ? s.data : s.data?.data || []);
    setEnrollmentCodes(ec.data?.data || []);
  };
  useEffect(() => { load().catch((error) => console.error('No se cargaron las aplicaciones Saber', error)); }, []);
  useEffect(() => {
    if (user?.role === 'docente' && user.institution) setForm((current) => ({ ...current, institution: current.institution === 'CRECER' ? user.institution : current.institution }));
  }, [user]);

  const selectBank = async (id) => {
    setForm((prev) => ({ ...prev, questionnaire_id: id }));
    setSelected([]); setQuestions([]);
    if (!id) return;
    try {
      const response = await axiosClient.get(`/questions/questions/${id}`);
      setQuestions(response.data?.data || []);
    } catch (error) { Swal.fire('Error', error.response?.data?.message || 'No se pudieron cargar las preguntas.', 'error'); }
  };

  const create = async (event) => {
    event.preventDefault(); setLoading(true);
    try {
      await axiosClient.post('/prueba-saber/applications', { ...form, question_ids: selected });
      await load(); setSelected([]); setQuestions([]);
      setForm({ questionnaire_id: '', course_id: '', title: '', time_limit_minutes: '', institution: user?.role === 'docente' ? (user.institution || 'Preicfes') : 'CRECER' });
      Swal.fire('Aplicación creada', 'La aplicación quedó asignada al curso con las preguntas seleccionadas.', 'success');
    } catch (error) { Swal.fire('No se pudo crear', error.response?.data?.message || 'Revisa los datos e inténtalo de nuevo.', 'error'); }
    finally { setLoading(false); }
  };

  const enroll = async (event) => {
    event.preventDefault();
    try {
      await axiosClient.post('/prueba-saber/enrollments', enrollment);
      Swal.fire('Matrícula registrada', 'La institución escolar del estudiante se conserva; se agregó su matrícula de Preicfes CRECER.', 'success');
      setEnrollment({ ...enrollment, student_id: '' });
    } catch (error) { Swal.fire('No se pudo matricular', error.response?.data?.message || 'Revisa el estudiante y el curso.', 'error'); }
  };

  const createEnrollmentCode = async (event) => {
    event.preventDefault(); setLoading(true); setNewCode('');
    try {
      const response = await axiosClient.post('/prueba-saber/enrollment-codes', codeForm);
      setNewCode(response.data.code);
      setCodeForm({ course_id: '', max_uses: '', expires_at: '' });
      await load();
    } catch (error) { Swal.fire('No se pudo crear el código', error.response?.data?.message || 'Revisa los datos e inténtalo de nuevo.', 'error'); }
    finally { setLoading(false); }
  };

  const revokeCode = async (id) => {
    try { await axiosClient.patch(`/prueba-saber/enrollment-codes/${id}/revoke`); await load(); }
    catch (error) { Swal.fire('No se pudo revocar', error.response?.data?.message || 'Inténtalo de nuevo.', 'error'); }
  };

  return <section className="card mb-4"><div className="card-header"><h4 className="mb-0">Aplicar preguntas seleccionadas al curso Preicfes</h4></div><div className="card-body">
    <p className="text-muted">Selecciona un banco Saber, el curso, las preguntas exactas y el tiempo. La calificación será informativa y no entrará en las fases académicas.</p>
    <form onSubmit={create}>
      <div className="row g-3">
        <div className="col-md-6"><label className="form-label">Banco de preguntas</label><select className="form-select" value={form.questionnaire_id} onChange={(e) => selectBank(e.target.value)} required><option value="">Seleccionar cuestionario Saber</option>{questionnaires.map((q) => <option key={q.id} value={q.id}>{q.subject} — {q.title}</option>)}</select></div>
        <div className="col-md-6"><label className="form-label">Curso</label><select className="form-select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} required><option value="">Seleccionar curso Preicfes</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="col-md-6"><label className="form-label">Nombre de esta aplicación</label><input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej.: Física, bloque 1" required /></div>
        <div className="col-md-6"><label className="form-label">Tiempo (minutos, opcional)</label><input className="form-control" type="number" min="1" value={form.time_limit_minutes} onChange={(e) => setForm({ ...form, time_limit_minutes: e.target.value })} /></div>
        <div className="col-md-6"><label className="form-label">Institución o proyecto que ofrece la aplicación</label><input className="form-control" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} required /><small className="text-muted">Puede ser CRECER o tu proyecto Preicfes. No cambia la institución de origen del estudiante.</small></div>
      </div>
      {courses.length === 0 && <div className="alert alert-warning mt-3 mb-0">Aún no tienes cursos Preicfes creados. Ve a <Link to={['administrador', 'admin', 'super_administrador'].includes(user?.role) ? '/cursos/nuevo' : '/mis-cursos'}>Mis cursos</Link> para crear uno; luego aparecerá aquí.</div>}
      {questions.length > 0 && <div className="mt-3"><div className="d-flex justify-content-between"><h5>Preguntas: {selected.length} seleccionadas de {questions.length}</h5><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelected(selected.length === questions.length ? [] : questions.map((q) => q.id))}>{selected.length === questions.length ? 'Quitar todas' : 'Seleccionar todas'}</button></div><div className="border rounded p-2" style={{ maxHeight: 320, overflowY: 'auto' }}>{questions.map((q, index) => <label key={q.id} className="d-flex gap-2 border-bottom py-2"><input type="checkbox" checked={selected.includes(q.id)} onChange={(e) => setSelected((items) => e.target.checked ? [...items, q.id] : items.filter((id) => id !== q.id))} /><span><strong>Pregunta {index + 1}.</strong> {q.question_text?.slice(0, 220)}{q.question_text?.length > 220 ? '…' : ''}{q.image_url && <span className="badge bg-info ms-2">Tiene figura</span>}</span></label>)}</div></div>}
      <button className="btn btn-primary mt-3" disabled={loading || !selected.length}>{loading ? 'Guardando…' : `Crear aplicación (${selected.length} preguntas)`}</button>
    </form>
    {['administrador', 'admin', 'super_administrador'].includes(user?.role) && <div className="border rounded p-3 mt-4"><h5>Matrícula adicional en Preicfes CRECER</h5><p className="text-muted">Registra la matrícula del estudiante para el curso Preicfes. Su institución de origen permanece en su perfil.</p><form className="row g-2" onSubmit={enroll}><div className="col-md-6"><label className="form-label">Estudiante</label><select className="form-select" value={enrollment.student_id} onChange={(e) => setEnrollment({ ...enrollment, student_id: e.target.value })} required><option value="">Seleccionar estudiante</option>{students.map((s) => <option value={s.id} key={s.id}>{s.user_name || s.name || s.student_name || `Estudiante #${s.id}`} · #{s.id}</option>)}</select></div><div className="col-md-4"><label className="form-label">Curso Preicfes</label><select className="form-select" value={enrollment.course_id} onChange={(e) => setEnrollment({ ...enrollment, course_id: e.target.value })} required><option value="">Seleccionar curso</option>{courses.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></div><div className="col-md-2 d-flex align-items-end"><button className="btn btn-outline-primary w-100">Matricular</button></div></form></div>}
    {applications.length > 0 && <div className="mt-4"><h5>Aplicaciones y resultados</h5><div className="table-responsive"><table className="table"><thead><tr><th>Aplicación</th><th>Curso</th><th>Materia</th><th>Preguntas</th><th>Estudiantes que completaron</th><th>Notas informativas</th></tr></thead><tbody>{applications.map((a) => <tr key={a.id}><td>{a.title}</td><td>{a.course_name}</td><td>{a.subject}</td><td>{JSON.parse(a.question_ids_json || '[]').length}</td><td>{a.completed_count}</td><td>{a.results?.length ? <details><summary>Ver resultados</summary>{a.results.map((r) => <div key={`${r.student_id}-${r.submitted_at}`} className="small py-1">{r.student_name}: <strong>{r.score}/5</strong> ({r.correct_count}/{r.total_questions})</div>)}</details> : '—'}</td></tr>)}</tbody></table></div></div>}
    <div className="border rounded p-3 mt-4"><h5>Códigos para matricular estudiantes</h5><p className="text-muted">El código autoriza la matrícula en un curso Preicfes. Puedes limitar usos y fecha de vencimiento.</p>
      <form className="row g-2" onSubmit={createEnrollmentCode}><div className="col-md-5"><label className="form-label">Curso Preicfes</label><select className="form-select" value={codeForm.course_id} onChange={(e) => setCodeForm({ ...codeForm, course_id: e.target.value })} required><option value="">Seleccionar curso</option>{courses.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></div><div className="col-md-3"><label className="form-label">Máximo de usos (opcional)</label><input className="form-control" type="number" min="1" value={codeForm.max_uses} onChange={(e) => setCodeForm({ ...codeForm, max_uses: e.target.value })} placeholder="Sin límite" /></div><div className="col-md-3"><label className="form-label">Vence (opcional)</label><input className="form-control" type="datetime-local" value={codeForm.expires_at} onChange={(e) => setCodeForm({ ...codeForm, expires_at: e.target.value })} /></div><div className="col-md-1 d-flex align-items-end"><button className="btn btn-outline-primary w-100" disabled={loading}>Crear</button></div></form>
      {newCode && <div className="alert alert-success mt-3 mb-0">Copia y comparte este código: <strong className="fs-5 user-select-all">{newCode}</strong><br/><small>Por seguridad, solo se muestra al crearlo.</small></div>}
      {enrollmentCodes.length > 0 && <div className="table-responsive mt-3"><table className="table table-sm align-middle"><thead><tr><th>Curso</th><th>Usos</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>{enrollmentCodes.map((item) => <tr key={item.id}><td>{item.course_name}</td><td>{item.use_count}{item.max_uses ? ` / ${item.max_uses}` : ' / ∞'}</td><td>{item.expires_at ? new Date(item.expires_at).toLocaleString() : 'Sin vencimiento'}</td><td>{item.active ? 'Activo' : 'Revocado'}</td><td>{item.active && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => revokeCode(item.id)}>Revocar</button>}</td></tr>)}</tbody></table></div>}
    </div>
  </div></section>;
}
