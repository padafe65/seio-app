// pages/results/ResultDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ResultDetail = () => {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchResultDetail = async () => {
      try {
        // Obtener el resultado
        const resultResponse = await axios.get(`${API_URL}/api/evaluation-results/${id}`);
        const resultData = resultResponse.data;
        
        if (!resultData) {
          throw new Error('No se encontró el resultado');
        }
        
        // Obtener detalles del intento
        const attemptResponse = await axios.get(
          `${API_URL}/api/quiz-attempts/${resultData.selected_attempt_id}`
        );
        
        const attemptData = attemptResponse.data;
        
        // Obtener detalles del cuestionario
        let questionnaireData = null;
        if (attemptData && attemptData.questionnaire_id) {
          const questionnaireResponse = await axios.get(
            `${API_URL}/api/questionnaires/${attemptData.questionnaire_id}`
          );
          questionnaireData = questionnaireResponse.data.questionnaire || questionnaireResponse.data;
        }
        
        // Obtener detalles del estudiante
        let studentData = null;
        if (attemptData && attemptData.student_id) {
          const studentResponse = await axios.get(
            `${API_URL}/api/students/${attemptData.student_id}`
          );
          studentData = studentResponse.data;
        }
        
        // Combinar todos los datos
        setResult({
          ...resultData,
          attempt: attemptData,
          questionnaire: questionnaireData,
          student: studentData
        });
        
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
              <h4>Información del Estudiante</h4>
              <div className="row mb-4">
                <div className="col-md-6">
                  <p><strong>Nombre:</strong> {result.student?.name || 'N/A'}</p>
                  <p><strong>Email:</strong> {result.student?.contact_email || 'N/A'}</p>
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
                  <p><strong>Fecha:</strong> {formatDate(result.recorded_at)}</p>
                </div>
                <div className="col-md-6">
                  <p><strong>Número de Intento:</strong> {result.attempt?.attempt_number || 'N/A'}</p>
                  <p><strong>Fecha del Intento:</strong> {formatDate(result.attempt?.attempt_date)}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultDetail;
