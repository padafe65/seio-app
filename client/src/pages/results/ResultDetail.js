// pages/results/ResultDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../config/axios';
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
        console.log('🔍 Obteniendo detalles del resultado con ID:', id);
        
        // Obtener el resultado
        const resultResponse = await api.get(`/api/evaluation-results/${id}`);
        console.log('📊 Respuesta completa de la API:', resultResponse);
        
        // Acceder a la propiedad data de la respuesta
        const responseData = resultResponse.data;
        console.log('📊 Datos del resultado:', responseData);
        
        // Verificar si hay datos y si la respuesta es exitosa
        if (!responseData || !responseData.success) {
          throw new Error('No se pudo obtener el resultado de la evaluación');
        }
        
        // Extraer los datos del resultado
        const resultData = responseData.data || responseData;
        console.log('📝 Datos procesados:', resultData);
        
        // Verificar si tenemos el ID del intento
        const selectedAttemptId = resultData.selected_attempt_id || 
                                (resultData.attempt && resultData.attempt.id) || 
                                (resultData.attempt_id);
        
        console.log('🔑 ID del intento seleccionado:', selectedAttemptId);
        
        if (!selectedAttemptId) {
          console.error('❌ No se encontró el ID del intento en:', resultData);
          throw new Error('No se encontró el ID del intento seleccionado en los datos del resultado');
        }
        
        // Obtener detalles del intento
        console.log('🔄 Obteniendo detalles del intento con ID:', selectedAttemptId);
        const attemptResponse = await api.get(
          `/api/evaluation-results/quiz-attempts/${selectedAttemptId}`
        );
        
        console.log('📝 Respuesta del intento:', attemptResponse.data);
        
        const attemptData = attemptResponse.data.data || attemptResponse.data;
        
        // Obtener detalles del cuestionario
        let questionnaireData = null;
        const questionnaireId = attemptData.questionnaire_id || 
                              (resultData.questionnaire && resultData.questionnaire.id) || 
                              resultData.questionnaire_id;
        
        if (questionnaireId) {
          console.log('📋 Obteniendo cuestionario con ID:', questionnaireId);
          try {
            const questionnaireResponse = await api.get(
              `/api/questionnaires/${questionnaireId}`
            );
            questionnaireData = questionnaireResponse.data.questionnaire || 
                              questionnaireResponse.data.data || 
                              questionnaireResponse.data;
          } catch (error) {
            console.error('⚠️ Error al obtener el cuestionario:', error);
            // Continuar sin los datos del cuestionario
          }
        }
        
        // Obtener detalles del estudiante
        let studentData = null;
        const studentId = attemptData.student_id || 
                         (resultData.student && resultData.student.id) || 
                         resultData.student_id;
        
        if (studentId) {
          console.log('👤 Obteniendo estudiante con ID:', studentId);
          try {
            const studentResponse = await api.get(
              `/api/students/${studentId}`
            );
            studentData = studentResponse.data.student || 
                         studentResponse.data.data || 
                         studentResponse.data;
          } catch (error) {
            console.error('⚠️ Error al obtener el estudiante:', error);
            // Continuar sin los datos del estudiante
          }
        }
        
        // Combinar todos los datos
        const combinedData = {
          id: resultData.id,
          best_score: resultData.best_score,
          status: resultData.status,
          recorded_at: resultData.recorded_at,
          student: {
            id: studentId,
            name: resultData.student_name || (studentData && studentData.name) || 'Estudiante desconocido',
            email: resultData.student_email || (studentData && studentData.email),
            course_name: resultData.course_name || (studentData && studentData.course_name),
            ...(studentData || {})
          },
          questionnaire: {
            id: questionnaireId,
            title: resultData.questionnaire_title || (questionnaireData && questionnaireData.title) || 'Cuestionario',
            phase: resultData.phase || (questionnaireData && questionnaireData.phase),
            category: resultData.questionnaire_category || (questionnaireData && questionnaireData.category) || 'Sin categoría',
            description: resultData.questionnaire_description || (questionnaireData && questionnaireData.description) || 'Sin descripción',
            ...(questionnaireData || {})
          },
          attempt: {
            id: selectedAttemptId,
            score: attemptData.score || resultData.score,
            attempt_date: attemptData.attempt_date || resultData.completed_at,
            answers: attemptData.answers,
            correct_answers: attemptData.correct_answers,
            incorrect_answers: attemptData.incorrect_answers,
            total_questions: attemptData.total_questions,
            ...attemptData
          }
        };
        
        console.log('✅ Datos combinados para el estado:', combinedData);
        setResult(combinedData);
        setLoading(false);
        
      } catch (error) {
        console.error('❌ Error al cargar detalles:', error);
        setError(`Error al cargar los detalles: ${error.message || 'Por favor, inténtalo de nuevo más tarde'}`);
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
