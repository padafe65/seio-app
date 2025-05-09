// src/pages/TakeQuizPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';

const TakeQuizPage = () => {
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questionnaireId, setQuestionnaireId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [phaseAverage, setPhaseAverage] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [intentos, setIntentos] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);
  const [detailedAttempts, setDetailedAttempts] = useState([]);
  const [currentQuestionnaire, setCurrentQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [count, setCount] = useState();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const { user } = useAuth();
  const studentId = user?.id;
  const navigate = useNavigate();

  // Verificar si el usuario está autenticado
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Función para redirigir al dashboard del estudiante
  const handleReturnToDashboard = () => {
    navigate('/student/dashboard');
  };

  // Cargar cuestionarios al inicio
  useEffect(() => {
    if (!studentId) return;
    
    axios
      .get(`/api/questionnaires?studentId=${studentId}`)
      .then((res) => {
        console.log('Cuestionarios cargados:', res.data);
        setQuestionnaires(res.data);
      })
      .catch((err) => console.error('Error al cargar cuestionarios:', err));
  }, [studentId]);

  // Cargar TODOS los intentos del estudiante para todos los cuestionarios
  useEffect(() => {
    if (!studentId) return;
    
    console.log("Cargando todos los intentos para el estudiante ID:", studentId);
    
    axios
      .get(`/api/quiz/attempts/all/${studentId}`)
      .then((res) => {
        console.log("Todos los intentos recibidos:", res.data+" estudentId:"+studentId);
        setAllAttempts(res.data.attempts || []);
      })
      .catch((err) => {
        console.error('Error al cargar todos los intentos:', err);
      });
  }, [studentId]);
  
  //Intentos api 2
  useEffect(() => {
    if (!studentId) return;
    
    console.log("Cargando todos los intentos para el estudiante ID:", studentId);
    
    axios
      .get(`/api/intentos-por-fase/${studentId}`)
      .then((res) => {
        console.log("Todos los intentos recibidos API 2:", res.data+" estudentId:"+studentId);
        setIntentos(res.data || []);
      })
      .catch((err) => {
        console.error('Error al cargar todos los intentos:', err);
      });
  }, [studentId]);

  // Cargar intentos detallados
  useEffect(() => {
    if (!studentId) return;
    
    axios
      .get(`/api/student/attempts/${studentId}`)
      .then((res) => setDetailedAttempts(res.data || []))
      .catch((err) => console.error('Error al cargar intentos detallados:', err));
      
  }, [studentId]);

  // Cargar preguntas e intentos al seleccionar un cuestionario
  useEffect(() => {
    if (!questionnaireId || !studentId) return;
    
    console.log("API: "+studentId+ " QId: "+questionnaireId);
    
    axios
      .get(`/api/quiz/attempts/${studentId}/${questionnaireId}`)
      .then((res) => {
        setAttempts(res.data.attempts || []);
        setCount(res.data.count);
        console.log("res.data.count: "+res.data.count);
        if ((res.data.count || 0) >= 2) {
          setMaxAttemptsReached(true);
          setQuestions([]);
          setScore(null);
          setSubmitted(false);
          setCurrentQuestionnaire(null);
        } else {
          setMaxAttemptsReached(false);
          setCurrentQuestionIndex(0); // Reiniciar el índice de pregunta
          axios
            .get(`/api/quiz/questions/${questionnaireId}`)
            .then((res) => {
              setQuestions(res.data.questions || []);
              setCurrentQuestionnaire(res.data.questionnaire || null);
              setAnswers({});
              setScore(null);
              setSubmitted(false);
              console.log("Api/quiz/question: "+questionnaireId);
            })
            .catch((err) => console.error('Error al cargar preguntas:', err));
        }
      })
      .catch((err) => console.error('Error al verificar intentos:', err));
  }, [questionnaireId, studentId]);

  const getAttemptCount = (questionnaireId) => {
    // Convertir a números para asegurar una comparación correcta
    const qId = parseInt(questionnaireId);
    
    // Buscar el intento correspondiente a este cuestionario
    const attemptInfo = allAttempts.find(a => parseInt(a.questionnaire_id) === qId);
    
    console.log("Buscando intentos para cuestionario:", qId, "Encontrado:", attemptInfo);
    
    // Devolver el conteo o 0 si no se encuentra
    return attemptInfo ? parseInt(attemptInfo.attempt_count) : 0;
  };
  
  // Función para obtener información de intentos por fase para un cuestionario específico
  const getIntentosPorFase = (questionnaireId) => {
    return intentos.find(i => parseInt(i.questionnaire_id) === parseInt(questionnaireId)) || null;
  };

  const handleSelectAnswer = (questionId, optionNumber) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionNumber }));
  };

  // Función para ir a la siguiente pregunta
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // Función para ir a la pregunta anterior
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    // Verificar que haya respuestas seleccionadas
    const answeredQuestions = Object.keys(answers).length;
    if (answeredQuestions === 0) {
      alert('Por favor, responde al menos una pregunta antes de enviar.');
      return;
    }
  
    // Evitar múltiples envíos
    if (submitted) {
      alert('Ya has enviado tus respuestas. Por favor, regresa al dashboard para realizar otro intento si aún tienes disponibles.');
      return;
    }
  
    setLoading(true);
    setError(null);
  
    try {
      // Enviar respuestas al servidor
      const res = await axios.post('/api/quiz/submit', {
        student_id: studentId,
        questionnaire_id: questionnaireId,
        answers,
      });
  
      setScore(res.data.score);
      setPhaseAverage(res.data.phaseAverage); // Añadir esta línea para recibir el promedio de fase
      setSubmitted(true); // Marcar como enviado
  
      // Actualizar todos los intentos
      const allUpdated = await axios.get(`/api/quiz/attempts/all/${studentId}`);
      setAllAttempts(allUpdated.data.attempts || []);
  
      // Actualizar la lista de intentos detallados
      try {
        const detailedRes = await axios.get(`/api/student/attempts/${studentId}`);
        setDetailedAttempts(detailedRes.data || []);
        console.log("Intentos detallados actualizados:", detailedRes.data);
      } catch (err) {
        console.error('Error al actualizar intentos detallados:', err);
      }
  
      // Actualizar intentos por fase
      try {
        const intentosRes = await axios.get(`/api/intentos-por-fase/${studentId}`);
        setIntentos(intentosRes.data || []);
      } catch (err) {
        console.error('Error al actualizar intentos por fase:', err);
      }
  
      // Actualizar intentos
      const updated = await axios.get(`/api/quiz/attempts/${studentId}/${questionnaireId}`);
      setAttempts(updated.data.attempts || []);
  
      if ((updated.data.count || 0) >= 2) {
        setMaxAttemptsReached(true);
      }
  
      // Mostrar mensaje de éxito con el promedio de fase
      alert(`Tu calificación es: ${res.data.score}. 
             Promedio actual de la fase: ${res.data.phaseAverage}.
             La evaluación ha sido registrada correctamente.`);
      
      // Redirigir automáticamente al dashboard después de mostrar la alerta
      navigate('/student/dashboard');
      
    } catch (err) {
      console.error('Error al enviar respuestas:', err);
      setError(err.response?.data?.message || 'Error al enviar respuestas');
      alert(err.response?.data?.message || 'Error al enviar respuestas');
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Presentar evaluación: 👩‍💻 {user?.name}</h2>

      <div className="mb-4">
        <label className="mr-2">Filtrar por fase:</label>
        <select 
          className="form-select" 
          value={selectedPhase || ''} 
          onChange={(e) => setSelectedPhase(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">Todas las fases</option>
          <option value="1">Fase 1</option>
          <option value="2">Fase 2</option>
          <option value="3">Fase 3</option>
          <option value="4">Fase 4</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="mr-2">Selecciona un cuestionario:</label>
        {questionnaires
          .filter(q => selectedPhase ? q.phase === selectedPhase : true)
          .length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questionnaires
              .filter(q => selectedPhase ? q.phase === selectedPhase : true)
              .map((q) => {
                const attemptCount = getAttemptCount(q.id);
                const hasTwoAttempts = attemptCount >= 2;
                const intentoInfo = getIntentosPorFase(q.id);

                return (
                  <div key={q.id} className="border p-4 rounded shadow">
                    <h3 className="underline hover:text-blue-600 dark:hover:text-blue-400" 
                        style={{ backgroundColor: '#0D5EFF', color: '#F0F0F0', padding: '1%' }}>
                      {q.title}
                    </h3>

                    <p><strong>Materia:</strong> {q.subject_name || q.category?.split('_')[1] || ''}</p>
                    <p><strong>Docente:</strong> {q.teacher_name || ''}</p>
                    <p><strong>Curso:</strong> {q.course_name || ''}</p>
                    <p><strong>Fase:</strong> {q.phase || 'No especificada'}</p>
                    
                    {/* Mostrar información de intentos por fase */}
                    {intentoInfo ? (
                      <div className="mt-2 p-2 bg-gray-100 rounded">
                        <p><strong>Intentos realizados:</strong> {intentoInfo.attempt_number || 0}/2</p>
                        <p><strong>Última calificación:</strong> {intentoInfo.score || 'N/A'}</p>
                        
                        {/* Mostrar notas por fase según la fase del cuestionario */}
                        {q.phase === 1 && intentoInfo.phase1 !== null && (
                          <p><strong>Nota Fase 1:</strong> {intentoInfo.phase1}</p>
                        )}
                        {q.phase === 2 && intentoInfo.phase2 !== null && (
                          <p><strong>Nota Fase 2:</strong> {intentoInfo.phase2}</p>
                        )}
                        {q.phase === 3 && intentoInfo.phase3 !== null && (
                          <p><strong>Nota Fase 3:</strong> {intentoInfo.phase3}</p>
                        )}
                        {q.phase === 4 && intentoInfo.phase4 !== null && (
                          <p><strong>Nota Fase 4:</strong> {intentoInfo.phase4}</p>
                        )}
                        
                        {intentoInfo.average !== null && (
                          <p><strong>Promedio:</strong> {intentoInfo.average}</p>
                        )}
                        
                        {/* Barra de progreso visual con personaje */}
                        <div style={{ 
                          width: '100%', 
                          backgroundColor: '#F98071', 
                          borderRadius: '9999px', 
                          height: '20px', 
                          marginTop: '8px',
                          overflow: 'visible',
                          position: 'relative'
                        }}>
                          <div 
                            style={{ 
                              width: intentoInfo && intentoInfo.attempt_number ? `${(intentoInfo.attempt_number / 2) * 100}%` : '0%',
                              backgroundColor: '#21808D',
                              height: '20px',
                              borderRadius: '9999px',
                              transition: 'width 0.5s ease-in-out'
                            }}>
                          </div>
                          <div 
                            style={{ 
                              position: 'absolute',
                              top: '-15px',
                              left: intentoInfo && intentoInfo.attempt_number ? `${(intentoInfo.attempt_number / 2) * 100}%` : '0%',
                              transform: 'translateX(-50%)',
                              fontSize: '24px',
                              transition: 'left 0.5s ease-in-out',
                              animation: 'walking 0.5s infinite'
                            }}
                          >
                            👨‍🎓
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p><strong>Intentos:</strong> 0/2</p>
                    )}

                    {hasTwoAttempts ? (
                      <p className="text-red-500 font-semibold mt-2">Ya alcanzaste los 2 intentos</p>
                    ) : (
                      <button onClick={() => setQuestionnaireId(q.id)} className="btn btn-primary mt-2">
                        Presentar evaluación
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {maxAttemptsReached && (
        <div className="text-red-600 font-semibold mb-4">
          Ya has realizado los 2 intentos permitidos para este cuestionario.
        </div>
      )}

      {error && (
        <div className="text-red-600 font-semibold mb-4">
          {error}
        </div>
      )}

      {!maxAttemptsReached && questions.length > 0 && (
        <div className="mb-4 p-4 border rounded shadow">
          {currentQuestionnaire && (
          <div className="d-flex align-items-start justify-content-between flex-wrap">
            {/* Lado izquierdo: Texto */}
            <div style={{ flex: '1 1 60%' }}>
              <h3 className="text-xl font-bold" style={{ backgroundColor: '#0D5EFF', color: '#F0F0F0', padding: '1%' }}>
                {currentQuestionnaire.title}
              </h3>
              <p><strong>Materia:</strong> {currentQuestionnaire.subject_name}</p>
              <p><strong>Docente:</strong> {currentQuestionnaire.teacher_name}</p>
              <p><strong>Curso:</strong> {currentQuestionnaire.course_name}</p>
              <p><strong>Fase:</strong> {currentQuestionnaire.phase}</p>
            </div>     
          </div>
        )}

          
          {/* Barra de progreso para preguntas respondidas */}
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Pregunta {currentQuestionIndex + 1} de {questions.length}  - porcentaje de preguntas contestadas: </span>
              <span className="text-sm font-medium">{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
            </div>
            <div style={{ 
              width: '100%', 
              backgroundColor: '#F98071', 
              borderRadius: '9999px', 
              height: '20px',
              marginTop: '8px',
              marginBottom: '25px',
              position: 'relative',
              overflow: 'visible'
            }}>
              <div 
                style={{ 
                  width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  backgroundColor: '#21808D',
                  height: '20px',
                  borderRadius: '9999px',
                  transition: 'width 0.5s ease-in-out'
                }}>
              </div>
              <div 
                style={{ 
                  position: 'absolute',
                  top: '-25px',
                  left: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  transform: 'translateX(-50%)',
                  fontSize: '24px',
                  transition: 'left 0.5s ease-in-out',
                  animation: 'walking 0.5s infinite'
                }}>
                👨‍🎓
              </div>
            </div>
          </div>
          
          {/* Mostrar solo la pregunta actual */}
          {questions.length > 0 && (
            <div className="mb-4 p-4 border rounded bg-white shadow">
              <p className="font-semibold text-lg mb-3" style={{fontSize:'18px', color:'#0060C1'}}><strong>{currentQuestionIndex + 1}. {questions[currentQuestionIndex].question_text}</strong></p>
              
              {questions[currentQuestionIndex].image_url && (
                <div className="text-center mb-4">
                  {/* Lado derecho: Imagen */}
                  <div style={{ flex: '1 1 35%', textAlign: 'center' }}>
                    <img
                      src={"/img/evaluacion.gif"} // Asegúrate de que la ruta sea correcta
                      alt="Imagen cuestionario"
                      className="img-fluid"
                      style={{ maxWidth: '7%', height: 'auto', marginLeft: '75%', animation: 'walking 3s infinite' }}
                    />
                  </div>
                  <img 
                    src={questions[currentQuestionIndex].image_url} 
                    alt="Imagen pregunta" 
                    className="my-2 img-fluid mx-auto" 
                    style={{ maxWidth: '300px' }} 
                  />
                </div>
              )}
                    
              <div className="space-y-2">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="p-2 hover:bg-gray-100 rounded">
                    <label className="flex items-start cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${questions[currentQuestionIndex].id}`}
                        value={n}
                        checked={answers[questions[currentQuestionIndex].id] === n}
                        onChange={() => handleSelectAnswer(questions[currentQuestionIndex].id, n)}
                        className="mt-1 mr-2"
                      />
                       
                      <span style={{color:'#0060C1'}}><strong> {questions[currentQuestionIndex][`option${n}`]}</strong></span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Botones de navegación */}
          <div className="flex justify-between mt-4">
            <button 
              onClick={handlePrevQuestion}
              className="btn btn-secondary"
              disabled={currentQuestionIndex === 0}
            >
              Anterior
            </button>
            
            {currentQuestionIndex < questions.length - 1 ? (
              <button 
                onClick={handleNextQuestion}
                className="btn btn-primary"
              >
                Siguiente
              </button>
            ) : (
              <button 
                onClick={handleSubmit} 
                className="btn btn-success"
                disabled={loading}
              >
                {loading ? 'Enviando...' : 'Finalizar y enviar'}
              </button>
            )}
          </div>
          
          {/* Indicador de preguntas respondidas */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Has respondido {Object.keys(answers).length} de {questions.length} preguntas
            </p>
          </div>
        </div>
      )}

      {submitted && (
        <div className="mt-4 p-4 border rounded bg-green-50">
          <div className="text-green-600 font-bold text-lg mb-3">
            Tu nota final: {score}
          </div>
          {phaseAverage && (
            <div className="text-blue-600 font-bold text-lg mb-3">
              Promedio actual de la fase: {phaseAverage}
            </div>
          )}
          <button 
            onClick={handleReturnToDashboard} 
            className="btn btn-success"
          >
            Volver al Dashboard
          </button>
        </div>
      )}

      {/* Estilos para la animación del personaje caminando */}
      <style jsx>{`
        @keyframes walking {
          0% { transform: translateX(-50%) translateY(0) rotate(0deg); }
          25% { transform: translateX(-50%) translateY(-3px) rotate(5deg); }
          50% { transform: translateX(-50%) translateY(0) rotate(0deg); }
          75% { transform: translateX(-50%) translateY(-3px) rotate(-5deg); }
          100% { transform: translateX(-50%) translateY(0) rotate(0deg); }
        }
      `}</style>
    </div>
  );
};

export default TakeQuizPage;
