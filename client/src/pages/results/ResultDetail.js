// pages/results/ResultDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Edit } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ResultDetail = () => {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [allAttempts, setAllAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchResultDetail = async () => {
      try {
        // Obtener token de autenticación
        const token = localStorage.getItem('authToken');
        if (!token) {
          setError('No se encontró el token de autenticación. Por favor, inicia sesión nuevamente.');
          setLoading(false);
          return;
        }

        // Configuración de headers con token
        const config = {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        };

        // Obtener el resultado
        const resultResponse = await axios.get(`${API_URL}/api/evaluation-results/${id}`, config);
        const resultData = resultResponse.data;
        
        if (!resultData) {
          throw new Error('No se encontró el resultado');
        }
        
        // Obtener detalles del intento
        const attemptResponse = await axios.get(
          `${API_URL}/api/quiz-attempts/${resultData.selected_attempt_id}`,
          config
        );
        
        const attemptData = attemptResponse.data;
        
        // Obtener detalles del cuestionario
        let questionnaireData = null;
        if (attemptData && attemptData.questionnaire_id) {
          const questionnaireResponse = await axios.get(
            `${API_URL}/api/questionnaires/${attemptData.questionnaire_id}`,
            config
          );
          questionnaireData = questionnaireResponse.data.questionnaire || questionnaireResponse.data;
        }
        
        // Obtener detalles del estudiante
        let studentData = null;
        if (attemptData && attemptData.student_id) {
          const studentResponse = await axios.get(
            `${API_URL}/api/students/${attemptData.student_id}`,
            config
          );
          studentData = studentResponse.data;
        }
        
        // Combinar todos los datos
        // Corregir la estructura de studentData si viene anidada
        const actualStudentData = studentData?.data || studentData;
        
        const combinedResult = {
          ...resultData,
          attempt: attemptData,
          questionnaire: questionnaireData,
          student: actualStudentData
        };
        
        console.log('📊 Datos combinados del resultado:', combinedResult);
        console.log('👤 Datos del estudiante:', studentData);
        console.log('📝 Datos del cuestionario:', questionnaireData);
        console.log('🎯 Datos del intento:', attemptData);
        
        // Debug específico para verificar campos del estudiante
        if (actualStudentData) {
          console.log('🔍 Verificación de campos del estudiante:');
          console.log('  - user_name:', actualStudentData.user_name);
          console.log('  - name:', actualStudentData.name);
          console.log('  - user_email:', actualStudentData.user_email);
          console.log('  - contact_email:', actualStudentData.contact_email);
          console.log('  - grade:', actualStudentData.grade);
          console.log('  - course_name:', actualStudentData.course_name);
          console.log('  - Estructura completa:', actualStudentData);
        }
        
        // Obtener todos los intentos del estudiante para este cuestionario
        if (attemptData && attemptData.student_id && attemptData.questionnaire_id) {
          try {
            const attemptsResponse = await axios.get(
              `${API_URL}/api/quiz-attempts/student/${attemptData.student_id}/questionnaire/${attemptData.questionnaire_id}`,
              config
            );
            setAllAttempts(attemptsResponse.data || []);
            console.log('🎯 Todos los intentos del estudiante:', attemptsResponse.data);
          } catch (attemptsError) {
            console.warn('No se pudieron obtener todos los intentos:', attemptsError);
            setAllAttempts([attemptData]); // Usar al menos el intento actual
          }
        } else {
          setAllAttempts([attemptData]);
        }
        
        setResult(combinedResult);
        
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar detalles:', error);
        setError('No se pudieron cargar los detalles. Por favor, intenta de nuevo.');
        setLoading(false);
      }
    };
    
    fetchResultDetail();
  }, [id]);
  
  // Función para formatear la fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  };
  
  // Función para formatear el puntaje de manera segura
  const formatScore = (score) => {
    try {
      const numScore = parseFloat(score);
      return !isNaN(numScore) ? numScore.toFixed(2) : 'N/A';
    } catch (error) {
      return 'N/A';
    }
  };
  
  if (loading) {
    return (
      <div className="text-center py-4">
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
  
  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Detalles del Resultado</h5>
          <Link to="/resultados" className="btn btn-light btn-sm d-flex align-items-center">
            <ArrowLeft size={16} className="me-1" /> Volver
          </Link>
        </div>
        <div className="card-body">
          {result && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="mb-0">Información del Estudiante</h4>
                <Link 
                  to={`/estudiantes/${result.student?.id || result.student_id}/editar`}
                  className="btn btn-outline-primary btn-sm d-flex align-items-center"
                >
                  <Edit size={16} className="me-1" /> Editar
                </Link>
              </div>
              <div className="row mb-4">
                <div className="col-md-6">
                  <p><strong>Nombre:</strong> {result.student?.user_name || result.student?.name || 'N/A'}</p>
                  <p><strong>Email:</strong> {result.student?.user_email || result.student?.contact_email || 'N/A'}</p>
                </div>
                <div className="col-md-6">
                  <p><strong>Grado:</strong> {result.student?.grade || 'N/A'}</p>
                  <p><strong>Curso:</strong> {result.student?.course_name || 'N/A'}</p>
                </div>
              </div>
              
              <h4>Información del Cuestionario</h4>
              <div className="row mb-4">
                <div className="col-md-6">
                  <p><strong>Título:</strong> {result.questionnaire?.title || 'N/A'}</p>
                  <p><strong>Fase:</strong> {result.attempt?.phase || 'N/A'}</p>
                </div>
                <div className="col-md-6">
                  <p><strong>Descripción:</strong> {result.questionnaire?.description || 'Sin descripción'}</p>
                  <p><strong>Categoría:</strong> {result.questionnaire?.category || 'N/A'}</p>
                </div>
              </div>
              
              <h4>Resultados</h4>
              <div className="row">
                <div className="col-md-6">
                  <p><strong>Mejor Puntaje:</strong> 
                    <span className={`badge ms-2 ${parseFloat(result.best_score) >= 3.5 ? 'bg-success' : 'bg-danger'}`}>
                      {formatScore(result.best_score)}
                    </span>
                  </p>
                  <p><strong>Fecha del Resultado:</strong> {formatDate(result.recorded_at)}</p>
                </div>
                <div className="col-md-6">
                  <p><strong>Total de Intentos:</strong> {allAttempts.length} / 2</p>
                  {allAttempts.length === 1 && (
                    <p className="text-warning"><strong>⚠️ Le queda 1 intento disponible</strong></p>
                  )}
                  {allAttempts.length === 2 && (
                    <p className="text-info"><strong>✅ Completó todos los intentos</strong></p>
                  )}
                </div>
              </div>
              
              {/* Mostrar todos los intentos */}
              {allAttempts.length > 0 && (
                <div className="mt-4">
                  <h5>Historial de Intentos</h5>
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Intento</th>
                          <th>Puntaje</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allAttempts.map((attempt, index) => (
                          <tr key={attempt.id || index}>
                            <td>{attempt.attempt_number || (index + 1)}</td>
                            <td>
                              <span className={`badge ${parseFloat(attempt.score) >= 3.5 ? 'bg-success' : 'bg-danger'}`}>
                                {formatScore(attempt.score)}
                              </span>
                            </td>
                            <td>{formatDate(attempt.attempt_date)}</td>
                            <td>
                              {attempt.id === result.selected_attempt_id ? (
                                <span className="badge bg-primary">Seleccionado</span>
                              ) : (
                                <span className="badge bg-secondary">Disponible</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultDetail;
