import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

const PhaseEvaluation = () => {
  const [selectedPhase, setSelectedPhase] = useState(1);
  const [courses, setCourses] = useState([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axiosClient.get('/phase-evaluation/courses');
        const availableCourses = response.data || [];
        setCourses(availableCourses);
        setSelectedCourseIds([]);
        setError(null);
      } catch (fetchError) {
        console.error('Error al cargar cursos:', fetchError);
        setError('No se pudieron cargar los cursos asignados al docente.');
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!selectedCourseIds.length) {
      setStats(null);
      return;
    }
    const fetchPhaseStats = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        selectedCourseIds.forEach(id => params.append('courseIds', id));
        const response = await axiosClient.get(`/phase-evaluation/phase-stats/${selectedPhase}?${params.toString()}`);
        setStats(response.data);
        setError(null);
      } catch (fetchError) {
        console.error('Error al obtener estadísticas:', fetchError);
        setError('No se pudieron cargar las estadísticas de la fase.');
      } finally {
        setLoading(false);
      }
    };
    fetchPhaseStats();
  }, [selectedPhase, selectedCourseIds]);

  const handleEvaluatePhase = async () => {
    const result = await Swal.fire({
      title: `¿Evaluar/Actualizar Fase ${selectedPhase}?`,
      text: `Se procesarán únicamente los estudiantes de ${selectedCourseIds.length} curso(s) seleccionado(s). Se generarán o actualizarán planes y se enviarán los correos de resultados correspondientes.`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, evaluar/actualizar fase',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      const response = await axiosClient.post(`/phase-evaluation/evaluate-phase/${selectedPhase}`, { courseIds: selectedCourseIds });
      await Swal.fire({
        title: '¡Evaluación completada!',
        html: `<p>${response.data.message}</p>`,
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });
      const params = new URLSearchParams();
      selectedCourseIds.forEach(id => params.append('courseIds', id));
      const statsResponse = await axiosClient.get(`/phase-evaluation/phase-stats/${selectedPhase}?${params.toString()}`);
      setStats(statsResponse.data);
    } catch (evaluateError) {
      console.error('Error al evaluar fase:', evaluateError);
      Swal.fire({
        title: 'Error',
        text: [
          evaluateError.response?.data?.message || 'No se pudo completar la evaluación de la fase',
          evaluateError.response?.data?.error
        ].filter(Boolean).join(': '),
        icon: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'docente') {
    return <div className="alert alert-warning"><AlertTriangle size={24} className="me-2" />Solo los docentes pueden acceder a esta funcionalidad.</div>;
  }

  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-header bg-primary text-white"><h4 className="mb-0">Evaluación de Fase</h4></div>
        <div className="card-body">
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label htmlFor="phaseSelect" className="form-label">Seleccionar Fase:</label>
              <select id="phaseSelect" className="form-select" value={selectedPhase} onChange={event => setSelectedPhase(parseInt(event.target.value, 10))}>
                <option value={1}>Fase 1</option><option value={2}>Fase 2</option><option value={3}>Fase 3</option><option value={4}>Fase 4 (Final)</option>
              </select>
            </div>
            <div className="col-md-6">
              <label htmlFor="courseSelect" className="form-label">Cursos o grupos a evaluar:</label>
              <select id="courseSelect" className="form-select" multiple size={Math.min(Math.max(courses.length, 3), 6)} value={selectedCourseIds} onChange={event => setSelectedCourseIds(Array.from(event.target.selectedOptions, option => option.value))} aria-describedby="courseSelectHelp">
                {courses.map(course => <option key={course.id} value={String(course.id)}>{course.name}{course.grades ? ` · Grado ${course.grades}` : ''}{course.institution ? ` · ${course.institution}` : ''} ({course.student_count} estudiantes)</option>)}
              </select>
              <div id="courseSelectHelp" className="form-text">Elige uno o varios cursos. Usa Ctrl (Windows) o Cmd (Mac) para seleccionar más de uno.</div>
            </div>
            <div className="col-12">
              <button className="btn btn-primary w-100" onClick={handleEvaluatePhase} disabled={loading || selectedCourseIds.length === 0} title="Se procesarán solo los cursos seleccionados">
                {loading ? <><RefreshCw size={18} className="me-2 spinner" /> Procesando...</> : <><CheckCircle size={18} className="me-2" /> Evaluar/Actualizar Fase {selectedPhase} ({selectedCourseIds.length} cursos)</>}
              </button>
            </div>
          </div>

          {error && <div className="alert alert-danger"><AlertTriangle size={18} className="me-2" />{error}</div>}
          {!courses.length && !error && <div className="alert alert-info">Este docente no tiene cursos asignados para evaluar.</div>}
          {courses.length > 0 && selectedCourseIds.length === 0 && <div className="alert alert-warning">Selecciona al menos un curso para consultar estadísticas o evaluar.</div>}

          {stats && (
            <div className="card mt-4">
              <div className="card-header bg-info text-white"><h5 className="mb-0">Estadísticas de la Fase {selectedPhase}</h5></div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-3"><div className="card text-center h-100"><div className="card-body"><h3>{stats.total_students || 0}</h3><p className="mb-0">Estudiantes con nota en la fase</p></div></div></div>
                  <div className="col-md-3"><div className="card text-center h-100 border-success"><div className="card-body"><h3>{stats.approved_students || 0}</h3><p className="mb-0">Aprobados</p></div></div></div>
                  <div className="col-md-3"><div className="card text-center h-100 border-danger"><div className="card-body"><h3>{stats.failed_students || 0}</h3><p className="mb-0">No aprobados</p></div></div></div>
                  <div className="col-md-3"><div className="card text-center h-100 border-info"><div className="card-body"><h3>{stats.average_score ? Number(stats.average_score).toFixed(2) : 'N/A'}</h3><p className="mb-0">Promedio</p></div></div></div>
                </div>
                <div className="alert alert-info mt-4 mb-0">
                  <strong>Nota:</strong> Al evaluar, se generan o actualizan planes para quienes tengan nota inferior a 3.5 y se envían los correos de resultados. Solo se procesarán los cursos seleccionados.
                  {selectedPhase === 4 && <span className="d-block mt-2"><strong>Importante:</strong> En la fase final también se generan planes de habilitación para promedios inferiores a 3.0.</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhaseEvaluation;
