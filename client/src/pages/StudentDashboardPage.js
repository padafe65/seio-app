// src/pages/StudentDashboardPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

const StudentDashboardPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [recentAttempts, setRecentAttempts] = useState([]);
  
  useEffect(() => {
    const fetchData = async () => {
      if (user && user.role === 'estudiante') {
        try {
          // Obtener datos del estudiante
          const studentResponse = await axiosClient.get(`/students/by-user/${user.id}`);
          setStudentData(studentResponse.data);
          
          // Obtener evaluaciones del estudiante
          const evaluationsResponse = await axiosClient.get(`/quiz/evaluations-by-phase/${user.id}`);
          setEvaluations(evaluationsResponse.data);
          
          // Obtener intentos recientes
          const attemptsResponse = await axiosClient.get(`/student/attempts/${user.id}`);
          setRecentAttempts(attemptsResponse.data.slice(0, 3)); // Solo los 3 más recientes
          
          setLoading(false);
        } catch (error) {
          console.error('Error al cargar datos del estudiante:', error);
          setLoading(false);
        }
      }
    };
    
    fetchData();
  }, [user]);
  
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
                      <th>Evaluaciones Completadas</th>
                      <th>Promedio</th>
                      <th>Docente</th>
                      <th>Institución</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.length > 0 ? (
                      evaluations.map((phase, index) => (
                        <tr key={index}>
                          <td>Fase {phase.phase}</td>
                          <td>{phase.total_evaluations}</td>
                          <td>{formatGrade(phase.phase_average)}</td>
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center">No hay evaluaciones registradas</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
              {recentAttempts.length > 0 ? (
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
                      {recentAttempts.map((attempt, index) => (
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
                <p className="text-center text-muted">No hay intentos recientes</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Acciones rápidas */}
      <div className="row">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboardPage;
