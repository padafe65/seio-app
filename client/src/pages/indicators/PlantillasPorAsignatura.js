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
  const [courses, setCourses] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [courseId, setCourseId] = useState('');
  const [templateIndicators, setTemplateIndicators] = useState([]);
  const [teacherId, setTeacherId] = useState(null);
  const [teacherContextIds, setTeacherContextIds] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [contextError, setContextError] = useState('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [appliedIndicators, setAppliedIndicators] = useState([]);
  const [loadingApplied, setLoadingApplied] = useState(false);
  const isAdmin = user?.role === 'super_administrador';
  const tid = user?.role === 'docente' ? teacherId : (isAdmin ? teacherId : null);
  const subjectCourses = courses.filter((course) => course.subject === selectedSubject);
  const selectedCourse = subjectCourses.find((course) => String(course.id) === String(courseId));

  const fetchApplied = React.useCallback(async () => {
    if (!tid) {
      setAppliedIndicators([]);
      return;
    }
    setLoadingApplied(true);
    try {
      const contextIds = user?.role === 'super_administrador' ? teacherContextIds : [];
      const scope = contextIds.length ? `&teacher_ids=${contextIds.join(',')}` : '';
      const r = await axiosClient.get(`/indicators?from_template=1&teacher_id=${tid}${scope}`);
      const data = r.data?.data || r.data || [];
      setAppliedIndicators(Array.isArray(data) ? data : []);
    } catch (e) {
      setAppliedIndicators([]);
    } finally {
      setLoadingApplied(false);
    }
  }, [tid, teacherContextIds, user?.role]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [teacherRes, teachersRes] = await Promise.all([
          user?.role === 'docente' ? axiosClient.get(`/teachers/by-user/${user.id}`) : Promise.resolve({ data: {} }),
          isAdmin ? axiosClient.get('/teachers').catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
        ]);
        if (user?.role === 'docente') {
          const t = teacherRes.data?.data || teacherRes.data;
          if (t?.id) {
            setTeacherId(t.id);
            setTeachers([t]);
          }
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
    if (!teacherId) {
      setSubjects([]);
      setCourses([]);
      setTeacherContextIds([]);
      return;
    }
    let cancelled = false;
    const loadContext = async () => {
      setContextError('');
      try {
        const selectedProfile = teachers.find((teacher) => Number(teacher.id) === Number(teacherId));
        if (!selectedProfile) throw new Error('No se encontró el perfil docente seleccionado.');
        const profiles = teachers.filter((teacher) => Number(teacher.user_id) === Number(selectedProfile.user_id));
        const relatedProfiles = profiles.length ? profiles : [selectedProfile];
        const profileIds = relatedProfiles.map((teacher) => Number(teacher.id));
        const [courseResponses, allCoursesResponse] = await Promise.all([
          Promise.all(profileIds.map((id) => axiosClient.get(`/teacher-courses/teacher/${id}`).catch(() => ({ data: [] })))),
          axiosClient.get('/courses').catch(() => ({ data: [] }))
        ]);
        const subjectsByTeacher = new Map(relatedProfiles.map((teacher) => [Number(teacher.id), teacher.subject]));
        const normalizedCourses = new Map();
        courseResponses.forEach((courseResponse, index) => {
          const list = Array.isArray(courseResponse.data) ? courseResponse.data : courseResponse.data?.data || [];
          list.forEach((course) => {
            const id = course.course_id ?? course.id;
            if (id == null) return;
            const profileId = Number(course.teacher_id ?? profileIds[index]);
            normalizedCourses.set(String(id), {
              id,
              name: course.course_name || course.name || `Curso ${id}`,
              grade: course.grade || '',
              institution: course.institution || relatedProfiles.find((profile) => Number(profile.id) === profileId)?.institution || '',
              teacher_id: profileId,
              subject: subjectsByTeacher.get(profileId) || selectedProfile.subject || ''
            });
          });
        });
        const allCourses = Array.isArray(allCoursesResponse.data) ? allCoursesResponse.data : allCoursesResponse.data?.data || [];
        allCourses.filter((course) => profileIds.includes(Number(course.teacher_id))).forEach((course) => {
          const profileId = Number(course.teacher_id);
          normalizedCourses.set(String(course.id), {
            id: course.id,
            name: course.name || `Curso ${course.id}`,
            grade: course.grade || '',
            institution: course.institution || relatedProfiles.find((profile) => Number(profile.id) === profileId)?.institution || '',
            teacher_id: profileId,
            subject: subjectsByTeacher.get(profileId) || selectedProfile.subject || ''
          });
        });
        if (cancelled) return;
        setTeacherContextIds(profileIds);
        setSubjects([...new Set(relatedProfiles.map((teacher) => teacher.subject).filter(Boolean))]);
        setCourses([...normalizedCourses.values()]);
        console.info('[Plantillas] Contexto docente cargado', {
          teacherId,
          teacherIds: profileIds,
          subjects: [...new Set(relatedProfiles.map((teacher) => teacher.subject).filter(Boolean))],
          courses: normalizedCourses.size
        });
        if (!relatedProfiles.some((teacher) => teacher.subject)) {
          setContextError('El perfil docente no tiene asignaturas configuradas.');
        }
      } catch (fallbackError) {
        if (!cancelled) {
          setSubjects([]);
          setCourses([]);
          setTeacherContextIds([]);
          setContextError(fallbackError.message || 'No se pudieron cargar las asignaturas y cursos del docente.');
        }
      }
    };
    loadContext();
    return () => { cancelled = true; };
  }, [teacherId, teachers]);

  useEffect(() => {
    fetchApplied();
  }, [fetchApplied]);

  useEffect(() => {
    if (!selectedSubject) {
      setTemplateIndicators([]);
      return;
    }
    let cancelled = false;
    axiosClient.get(`/indicators/templates/${encodeURIComponent(selectedSubject)}?grade=${encodeURIComponent(selectedCourse?.grade || '')}`)
      .then((r) => {
        if (!cancelled) setTemplateIndicators(r.data?.data || r.data || []);
      })
      .catch(() => { if (!cancelled) setTemplateIndicators([]); });
    return () => { cancelled = true; };
  }, [selectedSubject, courseId]);

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
    const confirmation = await Swal.fire({
      title: '¿Aplicar plantilla?',
      text: `Se agregarán a tu banco los indicadores de ${selectedSubject}${selectedCourse ? ` para ${selectedCourse.institution}: ${selectedCourse.name} (grado/nivel ${selectedCourse.grade})` : ''}. Los que ya existan se omitirán.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, aplicar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmation.isConfirmed) return;
    setApplying(true);
    try {
      const payload = { subject: selectedSubject, course_id: courseId || null, teacher_id: tid };
      console.info('[Plantillas] Enviando aplicación de plantilla', payload);
      const response = await axiosClient.post('/indicators/apply-template', payload);
      const created = response.data?.count || 0;
      const skipped = response.data?.skipped || 0;
      console.info('[Plantillas] Respuesta de aplicación de plantilla', {
        success: response.data?.success,
        count: created,
        skipped,
        insertedIds: (response.data?.data || []).map((indicator) => indicator.id)
      });
      await Swal.fire({
        title: created > 0 ? 'Plantilla aplicada' : 'La plantilla ya estaba aplicada',
        text: `Se agregaron ${created} indicadores para ${selectedSubject}.${skipped ? ` Se omitieron ${skipped} que ya existían.` : ''}`,
        icon: 'success'
      });
      setSelectedSubject('');
      setCourseId('');
      setTemplateIndicators([]);
      fetchApplied();
    } catch (e) {
      console.error('[Plantillas] Error aplicando plantilla', {
        status: e.response?.status,
        message: e.response?.data?.message || e.message,
        payload: { subject: selectedSubject, course_id: courseId || null, teacher_id: tid }
      });
      Swal.fire({
        title: 'Error',
        text: e.response?.data?.message || 'No se pudo aplicar la plantilla',
        icon: 'error'
      });
    } finally {
      setApplying(false);
    }
  };

  if (!user || (user.role !== 'docente' && user.role !== 'super_administrador')) {
    return (
      <div className="alert alert-warning">
        Solo docentes y superadministradores pueden usar plantillas por asignatura.
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
            Las plantillas son <strong>paquetes de indicadores sugeridos</strong> por asignatura. Puedes agregarlos al banco general o asociarlos desde el inicio a uno de tus cursos.
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
                      <th>Institución / curso</th>
                      <th>Grado / nivel</th>
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
                        <td>{[i.institution, i.course_name].filter(Boolean).join(' / ') || 'Banco general'}</td>
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
                    onChange={(e) => {
                      setTeacherId(e.target.value ? parseInt(e.target.value, 10) : null);
                      setTeacherContextIds([]);
                      setSelectedSubject('');
                      setCourseId('');
                    }}
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
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setCourseId('');
                    setTemplateIndicators([]);
                  }}
                >
                  <option value="">Seleccionar...</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Curso / grado (opcional)</label>
                  <select
                    className="form-select"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    disabled={!selectedSubject || subjectCourses.length === 0}
                  >
                    <option value="">Banco general, sin curso</option>
                    {subjectCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.institution} — {course.name} (grado/nivel {course.grade})
                      </option>
                    ))}
                  </select>
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!selectedSubject || !templateIndicators.length || applying || !tid}
                  onClick={handleApply}
                >
                  {applying ? 'Aplicando…' : 'Aplicar plantilla'}
                </button>
              </div>
            </div>
            {contextError && <div className="alert alert-warning py-2 mb-0" role="alert">{contextError}</div>}

            {selectedSubject && templateIndicators.length === 0 && (
              <div className="alert alert-info py-2">
                Esta asignatura pertenece al docente, pero todavía no tiene un paquete de plantilla configurado.
              </div>
            )}

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
