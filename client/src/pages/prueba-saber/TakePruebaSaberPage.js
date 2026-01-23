// src/pages/prueba-saber/TakePruebaSaberPage.js
import React, { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { GraduationCap, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const TakePruebaSaberPage = () => {
  const { questionnaireId } = useParams();
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // Función para detectar si un texto contiene expresiones LaTeX
  const containsLatex = (text) => {
    if (!text) return false;
    // Detectar comandos LaTeX comunes
    return text.includes('\\text') || 
           text.includes('\\frac') || 
           text.includes('\\sqrt') ||
           text.includes('\\sum') ||
           text.includes('\\int') ||
           text.includes('\\lim') ||
           text.includes('$');
  };

  // Verificar autenticación
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);


  // Cargar el cuestionario y las preguntas automáticamente
  useEffect(() => {
    if (!questionnaireId || !user) return;
    
    const fetchAndStartTest = async () => {
      try {
        setLoading(true);
        
        // 1. Obtener datos del cuestionario
        const qResponse = await axiosClient.get(`/questionnaires/${questionnaireId}`);
        const questionnaire = qResponse.data.questionnaire;
        
        // 2. Cargar preguntas usando el endpoint de quiz (con sesión)
        const response = await axiosClient.get(`/quiz/questions/${questionnaireId}`);
        
        setQuestions(response.data.questions || []);
        setSelectedQuestionnaire({
          ...questionnaire,
          ...response.data.questionnaire
        });
        setSessionId(response.data.session?.id || null);
        setRemainingSeconds(
          typeof response.data.session?.remaining_seconds === 'number' 
            ? response.data.session.remaining_seconds 
            : null
        );
        setAnswers({});
        setSubmitted(false);
        setMaxAttemptsReached(false);
        setCurrentQuestionIndex(0);
        
      } catch (error) {
        console.error('Error al cargar Prueba Saber:', error);
        const msg = error.response?.data?.error || error.response?.data?.message || 'Error al cargar la prueba';
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: msg,
          confirmButtonText: 'Volver',
          confirmButtonColor: '#3085d6'
        }).then(() => {
          navigate('/student/prueba-saber');
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchAndStartTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaireId]);

  // (La verificación de intentos se hace en StudentPruebaSaberListPage)

  // Contador regresivo de tiempo
  useEffect(() => {
    if (remainingSeconds === null) return;
    if (submitted) return;
    if (maxAttemptsReached) return;
    if (remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return null;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds, submitted, maxAttemptsReached]);

  // Auto-entrega al expirar el tiempo
  useEffect(() => {
    if (remainingSeconds === null) return;
    if (submitted) return;
    if (maxAttemptsReached) return;
    if (remainingSeconds !== 0) return;

    handleSubmit({ forceSubmit: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, submitted, maxAttemptsReached]);

  // Seleccionar respuesta
  const handleSelectAnswer = (questionId, optionNumber) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionNumber }));
  };

  // Navegación entre preguntas
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Enviar prueba
  const handleSubmit = async ({ forceSubmit = false } = {}) => {
    const answeredQuestions = Object.keys(answers).length;
    
    if (!forceSubmit && answeredQuestions === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin respuestas',
        text: 'Por favor, responde al menos una pregunta antes de enviar.',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    
    if (!forceSubmit && answeredQuestions < questions.length) {
      const result = await Swal.fire({
        icon: 'warning',
        title: '¿Enviar incompleto?',
        text: `Debes responder todas las preguntas antes de enviar. Te faltan ${questions.length - answeredQuestions}.`,
        showCancelButton: true,
        confirmButtonText: 'Continuar respondiendo',
        cancelButtonText: 'Enviar de todas formas',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33'
      });
      
      if (result.isConfirmed) {
        return;
      }
    }
  
    if (submitted) {
      Swal.fire({
        icon: 'info',
        title: 'Ya enviado',
        text: 'Ya has enviado tus respuestas.',
        confirmButtonText: 'Entendido'
      });
      return;
    }
  
    setLoading(true);
  
    try {
      const response = await axiosClient.post('/quiz/submit', {
        student_id: user.id,
        questionnaire_id: selectedQuestionnaire.id,
        answers,
        session_id: sessionId
      });
      
      setSubmitted(true);
      
      // Mostrar resultado
      await Swal.fire({
        icon: 'success',
        title: '¡Prueba Saber completada!',
        html: `<p><strong>Tu calificación:</strong> ${response.data.score}</p>
               ${typeof response.data.percentage !== 'undefined' ? `<p><strong>Porcentaje:</strong> ${response.data.percentage}% (${response.data.correctCount}/${response.data.totalQuestions})</p>` : ''}
               ${response.data.phaseAverage ? `<p><strong>Promedio actual:</strong> ${response.data.phaseAverage}</p>` : ''}
               <p>La evaluación ha sido registrada correctamente.</p>`,
        confirmButtonText: 'Volver a Pruebas Saber',
        confirmButtonColor: '#3085d6'
      });
      
      // Volver al listado de Pruebas Saber
      navigate('/student/prueba-saber');
      setQuestions([]);
      setAnswers({});
      setCurrentQuestionIndex(0);
      
    } catch (error) {
      console.error('Error al enviar respuestas:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error al enviar respuestas',
        confirmButtonText: 'Entendido'
      });
    } finally {
      setLoading(false);
    }
  };

  // Volver al listado
  const handleBackToList = () => {
    setSelectedQuestionnaire(null);
    setQuestions([]);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setSubmitted(false);
  };

  // Renderizar texto con LaTeX
  const renderTextWithLatex = (text) => {
    if (!text) return null;
    
    // Si el texto contiene $ delimitadores, usar la lógica anterior
    if (text.includes('$')) {
      const parts = [];
      let remaining = text;
      let key = 0;

      // Patrones para detectar LaTeX con delimitadores
      const blockPattern = /\$\$(.*?)\$\$/;
      const inlinePattern = /\$(.*?)\$/;

      while (remaining.length > 0) {
        const blockMatch = remaining.match(blockPattern);
        const inlineMatch = remaining.match(inlinePattern);

        if (blockMatch && (!inlineMatch || blockMatch.index <= inlineMatch.index)) {
          const beforeMatch = remaining.substring(0, blockMatch.index);
          if (beforeMatch) parts.push(<span key={key++}>{beforeMatch}</span>);

          parts.push(<BlockMath key={key++} math={blockMatch[1]} />);
          remaining = remaining.substring(blockMatch.index + blockMatch[0].length);
        } else if (inlineMatch) {
          const beforeMatch = remaining.substring(0, inlineMatch.index);
          if (beforeMatch) parts.push(<span key={key++}>{beforeMatch}</span>);

          parts.push(<InlineMath key={key++} math={inlineMatch[1]} />);
          remaining = remaining.substring(inlineMatch.index + inlineMatch[0].length);
        } else {
          parts.push(<span key={key++}>{remaining}</span>);
          break;
        }
      }

      return <>{parts}</>;
    }
    
    // Si contiene comandos LaTeX pero sin $, renderizar como inline LaTeX
    if (containsLatex(text)) {
      try {
        return <InlineMath math={text} />;
      } catch (error) {
        console.error('Error renderizando LaTeX:', error);
        return <span>{text}</span>;
      }
    }
    
    // Texto plano
    return <span>{text}</span>;
  };

  // Vista de carga
  if (loading && !selectedQuestionnaire) {
    return (
      <div className="container py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3">Cargando Pruebas Saber...</p>
        </div>
      </div>
    );
  }

  // Vista de prueba en progreso
  if (selectedQuestionnaire && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];
    const isAnswered = answers[currentQuestion?.id] !== undefined;
    const allAnswered = questions.every(q => answers[q.id] !== undefined);

    return (
      <div className="container py-4">
        {/* Header con timer */}
        <div className="card mb-4">
          <div className="card-header bg-primary text-white">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h4 className="mb-0">
                  <GraduationCap className="me-2" size={24} />
                  {selectedQuestionnaire.title}
                </h4>
                <small>
                  Prueba Saber - Grado {selectedQuestionnaire.grade} - {selectedQuestionnaire.prueba_saber_level}°
                </small>
              </div>
              {remainingSeconds !== null && (
                <div className="text-end">
                  <Clock className="me-2" size={20} />
                  <strong>
                    {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Indicador de progreso */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span>Pregunta {currentQuestionIndex + 1} de {questions.length}</span>
              <span className="badge bg-info">
                Respondidas: {Object.keys(answers).length}/{questions.length}
              </span>
            </div>
            <div className="progress">
              <div 
                className="progress-bar" 
                role="progressbar" 
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                aria-valuenow={currentQuestionIndex + 1} 
                aria-valuemin="0" 
                aria-valuemax={questions.length}
              />
            </div>
          </div>
        </div>

        {/* Pregunta actual */}
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title mb-4">
              Pregunta {currentQuestionIndex + 1}
              {!isAnswered && (
                <span className="badge bg-warning text-dark ms-2">
                  <AlertCircle size={14} className="me-1" />
                  Sin responder
                </span>
              )}
            </h5>

            <div className="question-text mb-4" style={{ fontSize: '1.1rem' }}>
              {renderTextWithLatex(currentQuestion.question_text)}
            </div>

            {currentQuestion.image_url && (
              <div className="mb-4 text-center">
                <img 
                  src={currentQuestion.image_url.startsWith('http') 
                    ? currentQuestion.image_url 
                    : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${currentQuestion.image_url}`
                  }
                  alt="Pregunta"
                  className="img-fluid rounded shadow-sm"
                  style={{ maxWidth: '500px', maxHeight: '400px' }}
                />
              </div>
            )}

            {/* Opciones de respuesta */}
            <div className="options-container">
              {[1, 2, 3, 4].map(num => (
                <div 
                  key={num} 
                  className={`form-check mb-3 p-3 border rounded ${answers[currentQuestion.id] === num ? 'border-primary bg-light' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSelectAnswer(currentQuestion.id, num)}
                >
                  <input
                    className="form-check-input"
                    type="radio"
                    name={`question_${currentQuestion.id}`}
                    id={`q${currentQuestion.id}_opt${num}`}
                    value={num}
                    checked={answers[currentQuestion.id] === num}
                    onChange={() => handleSelectAnswer(currentQuestion.id, num)}
                  />
                  <label 
                    className="form-check-label w-100" 
                    htmlFor={`q${currentQuestion.id}_opt${num}`}
                    style={{ cursor: 'pointer', fontSize: '1rem' }}
                  >
                    <strong className="me-2">{String.fromCharCode(64 + num)}.</strong>
                    {renderTextWithLatex(currentQuestion[`option${num}`])}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Botones de navegación */}
        <div className="d-flex justify-content-between mb-4">
          <button
            className="btn btn-outline-secondary"
            onClick={handlePrevQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft size={18} className="me-1" />
            Anterior
          </button>

          <button
            className="btn btn-outline-secondary"
            onClick={handleBackToList}
          >
            Cancelar Prueba
          </button>

          <button
            className="btn btn-outline-primary"
            onClick={handleNextQuestion}
            disabled={currentQuestionIndex === questions.length - 1}
          >
            Siguiente
            <ChevronRight size={18} className="ms-1" />
          </button>
        </div>

        {/* Botón de enviar */}
        <div className="card">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <p className="mb-0">
                  {allAnswered ? (
                    <span className="text-success">
                      ✓ Todas las preguntas respondidas
                    </span>
                  ) : (
                    <span className="text-warning">
                      ⚠ Faltan {questions.length - Object.keys(answers).length} preguntas por responder
                    </span>
                  )}
                </p>
              </div>
              <button
                className="btn btn-success btn-lg"
                onClick={() => handleSubmit({ forceSubmit: false })}
                disabled={loading || submitted}
              >
                {loading ? 'Enviando...' : 'Enviar Prueba Saber'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si no hay cuestionario seleccionado, mostrar loading o redirigir
  if (!selectedQuestionnaire && !loading) {
    return (
      <div className="container py-5 text-center">
        <AlertCircle size={48} className="text-warning mb-3" />
        <h3>No se encontró la Prueba Saber</h3>
        <button 
          className="btn btn-primary mt-3"
          onClick={() => navigate('/student/prueba-saber')}
        >
          Volver a Pruebas Saber
        </button>
      </div>
    );
  }

  // Mostrar loading mientras carga
  return (
    <div className="container py-5 text-center">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Cargando...</span>
      </div>
      <p className="mt-3 text-muted">Cargando Prueba Saber...</p>
    </div>
  );
};

export default TakePruebaSaberPage;
