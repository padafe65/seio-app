// src/pages/StudentDashboardPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import LearningResourcesSection from '../components/educational-resources/LearningResourcesSection';
import StudentGuidesPanel from '../components/educational-resources/StudentGuidesPanel';
import Swal from 'sweetalert2';

const StudentDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [teachers, setTeachers] = useState([]); // Docentes/materias del estudiante
  const [selectedTeacherId, setSelectedTeacherId] = useState(null); // Filtro por docente/materia
  
  useEffect(() => {
    const fetchData = async () => {
      if (user && user.role === 'estudiante') {
        try {
          // Obtener datos del estudiante
          const studentResponse = await axiosClient.get(`/students/by-user/${user.id}`);
          
          // Si el estudiante no existe (404), redirigir a completar registro
          if (!studentResponse.data || !studentResponse.data.id) {
            console.log('⚠️ Estudiante no tiene registro completo, redirigiendo a CompleteStudent...');
            
            // Guardar user_id en localStorage para que CompleteStudent lo use
            localStorage.setItem('user_id', user.id);
            
            Swal.fire({
              icon: 'info',
              title: 'Completar Registro',
              html: `<p>Necesitas completar tu información de estudiante para acceder al dashboard.</p>`,
              confirmButtonText: 'Ir a completar registro',
              confirmButtonColor: '#3085d6'
            }).then(() => {
              navigate('/CompleteStudent');
            });
            
            setLoading(false);
            return;
          }
          
          setStudentData(studentResponse.data);
          
          // Obtener docentes/materias del estudiante
          try {
            const teachersResponse = await axiosClient.get(`/students/by-user/${user.id}/teachers`);
            const teachersList = teachersResponse.data.data || [];
            setTeachers(teachersList);
            
            // Si hay docentes, seleccionar el primero por defecto (o mostrar todos)
            if (teachersList.length > 0) {
              // No seleccionar ninguno por defecto, mostrar todos
              setSelectedTeacherId(null);
            }
          } catch (teacherError) {
            console.error('Error al cargar docentes del estudiante:', teacherError);
            setTeachers([]);
          }
          
          // Obtener evaluaciones del estudiante
          const evaluationsResponse = await axiosClient.get(`/quiz/evaluations-by-phase/${user.id}`);
          setEvaluations(evaluationsResponse.data);
          
          // Obtener intentos recientes
          const attemptsResponse = await axiosClient.get(`/student/attempts/${user.id}`);
          setRecentAttempts(attemptsResponse.data.slice(0, 3)); // Solo los 3 más recientes
          
          setLoading(false);
        } catch (error) {
          console.error('Error al cargar datos del estudiante:', error);
          
          // Si es error 404 (estudiante no encontrado), redirigir a completar registro
          if (error.response?.status === 404) {
            console.log('⚠️ Estudiante no tiene registro completo (404), redirigiendo a CompleteStudent...');
            
            // Guardar user_id en localStorage para que CompleteStudent lo use
            localStorage.setItem('user_id', user.id);
            
            Swal.fire({
              icon: 'info',
              title: 'Completar Registro',
              html: `<p>Necesitas completar tu información de estudiante para acceder al dashboard.</p>`,
              confirmButtonText: 'Ir a completar registro',
              confirmButtonColor: '#3085d6'
            }).then(() => {
              navigate('/CompleteStudent');
            });
          }
          
          setLoading(false);
        }
      }
    };
    
    fetchData();
  }, [user, navigate]);
  
  // Función auxiliar para formatear calificaciones
  const formatGrade = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return parseFloat(value).toFixed(1);
  };
  
  // Función para formatear fechas
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  // Filtrar evaluaciones e intentos por docente seleccionado
  const filteredEvaluations = selectedTeacherId 
    ? evaluations.filter(e => e.teacher_id === selectedTeacherId)
    : evaluations;
  
  const filteredRecentAttempts = selectedTeacherId
    ? recentAttempts.filter(a => a.teacher_id === selectedTeacherId)
    : recentAttempts;

  return (
    <div className="container py-4">
      <div className="row mb-4">
        <div className="col-12">
          <h1 className="h3">Bienvenido, {user.name}</h1>
          <p className="text-muted">
            {studentData?.institution || studentData?.user_institution ? (
              <>
                {studentData.institution || studentData.user_institution}
                {evaluations.length > 0 && evaluations[0]?.academic_year && (
                  <> • Período Académico {evaluations[0].academic_year}</>
                )}
              </>
            ) : (
              <>
                Aquí puedes ver tu progreso académico
                {evaluations.length > 0 && evaluations[0]?.academic_year && (
                  <> • Período Académico {evaluations[0].academic_year}</>
                )}
              </>
            )}
          </p>
        </div>
      </div>
      
      {/* Sección de materias/docentes */}
      {teachers.length > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Mis Materias y Docentes</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label htmlFor="teacherFilter" className="form-label">
                    Filtrar por materia/docente:
                  </label>
                  <select
                    id="teacherFilter"
                    className="form-select"
                    value={selectedTeacherId || ''}
                    onChange={(e) => setSelectedTeacherId(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Todas las materias</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.subject} - {teacher.name}
                        {teacher.institution && ` (${teacher.institution})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {teachers.map(teacher => (
                    <button
                      key={teacher.id}
                      type="button"
                      className={`btn btn-sm ${selectedTeacherId === teacher.id ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setSelectedTeacherId(selectedTeacherId === teacher.id ? null : teacher.id)}
                    >
                      {teacher.subject} - {teacher.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Tarjetas de resumen */}
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Grado</h5>
              <p className="card-text display-6">{studentData?.grade || 'N/A'}°</p>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Curso</h5>
              <p className="card-text display-6">{studentData?.course_name || 'N/A'}</p>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Institución</h5>
              <p className="card-text display-6" style={{fontSize: '1.5rem'}}>
                {studentData?.institution || studentData?.user_institution || 'N/A'}
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Promedio General</h5>
              <p className="card-text display-6">
                {evaluations.find(e => e.overall_average)?.overall_average 
                  ? formatGrade(evaluations.find(e => e.overall_average).overall_average) 
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Progreso por fase */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Progreso por Fase</h5>
              <Link to="/student/results" className="btn btn-sm btn-outline-primary">
                Ver detalles
              </Link>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Fase</th>
                      <th>Evaluaciones</th>
                      <th>Nota automática (sistema)</th>
                      <th>Nota manual</th>
                      <th>Definitiva</th>
                      <th>Docente</th>
                      <th>Institución</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvaluations.length > 0 ? (
                      filteredEvaluations.map((phase, index) => {
                        const hasManual = phase.average_score_manual != null && !isNaN(parseFloat(phase.average_score_manual));
                        return (
                          <tr key={index}>
                            <td>Fase {phase.phase}</td>
                            <td>{phase.total_evaluations}</td>
                            <td>{formatGrade(phase.average_score)}</td>
                            <td>
                              {hasManual ? (
                                formatGrade(phase.average_score_manual)
                              ) : (
                                <span className="text-muted small">—</span>
                              )}
                            </td>
                            <td>
                              {formatGrade(phase.phase_average)}
                              {!hasManual && (phase.average_score != null || phase.phase_average != null) && (
                                <span className="text-muted small d-block">(solo sistema)</span>
                              )}
                            </td>
                            <td>{phase.teacher_name || 'N/A'}</td>
                            <td>{phase.institution || studentData?.institution || studentData?.user_institution || 'N/A'}</td>
                            <td>
                              {phase.phase_average ? (
                                parseFloat(phase.phase_average) >= 3.0 ? (
                                  <span className="badge bg-success">Aprobado</span>
                                ) : (
                                  <span className="badge bg-danger">Reprobado</span>
                                )
                              ) : (
                                <span className="badge bg-secondary">Sin datos</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" className="text-center">
                          {selectedTeacherId 
                            ? 'No hay evaluaciones registradas para esta materia' 
                            : 'No hay evaluaciones registradas'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredEvaluations.some(p => (p.average_score_manual == null || isNaN(parseFloat(p.average_score_manual))) && (p.average_score != null || p.phase_average != null)) && (
                <div className="alert alert-info mt-3 mb-0 small">
                  <strong>Nota:</strong> En las fases en que no hay nota manual, la definitiva corresponde únicamente a la nota del sistema.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Intentos recientes */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Intentos Recientes</h5>
              <Link to="/student/results" className="btn btn-sm btn-outline-primary">
                Ver todos
              </Link>
            </div>
            <div className="card-body">
              {filteredRecentAttempts.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Evaluación</th>
                        <th>Fase</th>
                        <th>Calificación</th>
                        <th>Docente</th>
                        <th>Institución</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecentAttempts.map((attempt, index) => (
                        <tr key={index}>
                          <td>{attempt.title}</td>
                          <td>Fase {attempt.phase}</td>
                          <td>
                            <span className={`badge ${parseFloat(attempt.score) >= 3 ? 'bg-success' : 'bg-danger'}`}>
                              {formatGrade(attempt.score)}
                            </span>
                          </td>
                          <td>{attempt.teacher_name || 'N/A'}</td>
                          <td>{attempt.institution || studentData?.institution || studentData?.user_institution || 'N/A'}</td>
                          <td>{formatDate(attempt.attempted_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-muted">
                  {selectedTeacherId 
                    ? 'No hay intentos recientes para esta materia' 
                    : 'No hay intentos recientes'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Acciones rápidas */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Acciones Rápidas</h5>
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2">
                <Link to="/student/take-quiz" className="btn btn-primary">
                  Realizar Evaluación
                </Link>
                <Link to="/student/results" className="btn btn-info">
                  Ver Resultados
                </Link>
                <Link to="/student/improvement" className="btn btn-success">
                  Plan de Mejora
                </Link>
                {studentData && studentData.grade && [3, 5, 9, 11].includes(parseInt(studentData.grade)) && (
                  <Link to="/student/prueba-saber/resultados" className="btn btn-warning">
                    Resultados Prueba Saber
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Guías de Estudio */}
      {studentData?.id && (
        <div className="row mb-4">
          <div className="col-12">
            <StudentGuidesPanel studentData={studentData} />
          </div>
        </div>
      )}
      
      {/* Recursos de Aprendizaje */}
      {studentData?.id && (
        <div className="row">
          <div className="col-12">
            <LearningResourcesSection 
              studentId={studentData.id} 
              grade={studentData.grade}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboardPage;
