// src/pages/students/StudentGrades.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const StudentGrades = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [grades, setGrades] = useState(null);
  const [phaseAverages, setPhaseAverages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Obtener token de autenticación
        const token = localStorage.getItem('authToken');
        if (!token) {
          setError('No se encontró token de autenticación');
          setLoading(false);
          return;
        }

        const config = {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };

        // Obtener información del estudiante
        const studentResponse = await axios.get(`${API_URL}/api/students/${id}`, config);
        setStudent(studentResponse.data);
        
        // Obtener calificaciones por fase
        const gradesResponse = await axios.get(`${API_URL}/api/quiz/evaluations-by-phase/${studentResponse.data.user_id}`, config);
        setPhaseAverages(gradesResponse.data);
        
        // Obtener calificaciones generales
        const [studentGrades] = gradesResponse.data.filter(g => g.overall_average !== null);
        setGrades(studentGrades || null);
        
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar calificaciones:', error);
        setError('No se pudo cargar la información de calificaciones');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
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
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        {error}
      </div>
    );
  }
  
  if (!student) {
    return (
      <div className="alert alert-warning">
        No se encontró el estudiante solicitado.
      </div>
    );
  }
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Calificaciones de {student.name}</h4>
        <div>
          <Link to={`/estudiantes/${id}`} className="btn btn-outline-secondary me-2">
            Ver Perfil
          </Link>
          <Link to={user.role === 'docente' ? "/mis-estudiantes" : "/estudiantes"} className="btn btn-outline-secondary">
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
              <p><strong>Nombre:</strong> {student.name}</p>
              <p><strong>Email:</strong> {student.email}</p>
            </div>
            <div className="col-md-6">
              <p><strong>Grado:</strong> {student.grade}°</p>
              <p><strong>Curso:</strong> {student.course_name}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card mb-4">
        <div className="card-header bg-white">
          <h5 className="mb-0">Calificaciones por Fase</h5>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead className="table-light">
                <tr>
                  <th>Fase</th>
                  <th>Evaluaciones Completadas</th>
                  <th>Promedio</th>
                </tr>
              </thead>
              <tbody>
                {phaseAverages.length > 0 ? (
                  phaseAverages.map((phase, index) => (
                    <tr key={index}>
                      <td>Fase {phase.phase}</td>
                      <td>{phase.total_evaluations}</td>
                      <td>
                        {phase.phase_average ? (
                          <span className={`badge ${phase.phase_average >= 3.0 ? 'bg-success' : 'bg-danger'}`}>
                            {parseFloat(phase.phase_average).toFixed(1)}
                          </span>
                        ) : 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="text-center">No hay evaluaciones registradas</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="table-light">
                <tr>
                  <th colSpan="2">Promedio General</th>
                  <th>
                    {grades?.overall_average ? (
                      <span className={`badge ${parseFloat(grades.overall_average) >= 3.0 ? 'bg-success' : 'bg-danger'}`}>
                        {parseFloat(grades.overall_average).toFixed(1)}
                      </span>
                    ) : 'N/A'}
                  </th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentGrades;
