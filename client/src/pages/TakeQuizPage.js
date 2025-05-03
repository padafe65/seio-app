// src/pages/TakeQuizPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.js';

const TakeQuizPage = () => {
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questionnaireId, setQuestionnaireId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);
  const [detailedAttempts, setDetailedAttempts] = useState([]);
  const [currentQuestionnaire, setCurrentQuestionnaire] = useState(null);
  const { user } = useAuth();
  const studentId = user?.id;

  // Cargar cuestionarios al inicio
  useEffect(() => {
    axios
      .get('/api/questionnaires')
      .then((res) => {
        console.log('Cuestionarios cargados:', res.data);
        setQuestionnaires(res.data);
      })
      .catch((err) => console.error('Error al cargar cuestionarios:', err));
  }, []);

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
    if (!questionnaireId) return;
    console.log("API: "+studentId+ " QId: "+questionnaireId);
    axios
      .get(`/api/quiz/attempts/${studentId}/${questionnaireId}`)
      .then((res) => {
        setAttempts(res.data.attempts || []);
        if ((res.data.count || 0) >= 2) {
          setMaxAttemptsReached(true);
          setQuestions([]);
          setScore(null);
          setSubmitted(false);
          setCurrentQuestionnaire(null);
        } else {
          setMaxAttemptsReached(false);
          axios
            .get(`/api/quiz/questions/${questionnaireId}`)
            .then((res) => {
              // Actualizar para manejar la nueva estructura de respuesta
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

  const handleSelectAnswer = (questionId, optionNumber) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionNumber }));
  };

  const handleSubmit = async () => {
    try {
      const res = await axios.post('/api/quiz/submit', {
        student_id: studentId,
        questionnaire_id: questionnaireId,
        answers,
      });

      setScore(res.data.score);
      setSubmitted(true);

      const updated = await axios.get(`/api/quiz/attempts/${studentId}/${questionnaireId}`);
      setAttempts(updated.data.attempts || []);

      if ((updated.data.count || 0) >= 2) {
        setMaxAttemptsReached(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al enviar respuestas');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Presentar evaluación: 👩‍💻 {user?.name}</h2>

      <div className="mb-4">
        <label className="mr-2">Selecciona un cuestionario:</label>
        {questionnaires.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questionnaires.map((q) => {
              const userAttempts = attempts.filter((a) => a.questionnaire_id === q.id);
              const hasTwoAttempts = userAttempts.length >= 2;

              return (
                <div key={q.id} className="border p-4 rounded shadow">
                  <h3 className="underline hover:text-blue-600 dark:hover:text-blue-400" style={{ backgroundColor: '#0D5EFF', color: '#F0F0F0', padding: '1%' }}>{q.title}</h3>

                 

                  {currentQuestionnaire && (
            <div className="mb-4">

              <p><strong>Materia:</strong> {currentQuestionnaire.subject_name}</p>
              <p><strong>Docente:</strong> {currentQuestionnaire.teacher_name}</p>
              <p><strong>Curso:</strong> {currentQuestionnaire.course_name}</p>
            </div>
          )}

                  {hasTwoAttempts ? (
                    <p className="text-red-500 font-semibold mt-2">Ya alcanzaste los 2 intentos</p>
                  ) : (
                    <button onClick={() => setQuestionnaireId(q.id)} className="btn btn-primary">
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

      {!maxAttemptsReached && questions.length > 0 && (
        <div className="mb-4 p-4 border rounded shadow">
          {currentQuestionnaire && (
            <div className="mb-4">
              <h3 className="text-xl font-bold" style={{ backgroundColor: '#0D5EFF', color: '#F0F0F0', padding: '1%' }}>
                {currentQuestionnaire.title}
              </h3>
              <p><strong>Materia:</strong> {currentQuestionnaire.subject_name}</p>
              <p><strong>Docente:</strong> {currentQuestionnaire.teacher_name}</p>
              <p><strong>Curso:</strong> {currentQuestionnaire.course_name}</p>
            </div>
          )}
          
          {questions.map((q) => (
            <div key={q.id} className="mb-4">
              <p className="font-semibold">{q.question_text}</p>
              {q.image_url && (
                <img src={q.image_url} alt="Imagen pregunta" className="w-48 my-2" width={'25%'} height={'21%'} />
              )}
              {[1, 2, 3, 4].map((n) => (
                <div key={n}>
                  <label>
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      value={n}
                      checked={answers[q.id] === n}
                      onChange={() => handleSelectAnswer(q.id, n)}
                    />
                    {q[`option${n}`]}
                  </label>
                </div>
              ))}
            </div>
          ))}
          
          {!submitted && (
            <button onClick={handleSubmit} className="bg-blue-500 text-white px-4 py-2 rounded mt-4">
              Enviar respuestas
            </button>
          )}
        </div>
      )}

      {submitted && (
        <div className="mt-4 text-green-600 font-bold text-lg">
          Tu nota final: {score}
        </div>
      )}

      {detailedAttempts.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">Evaluaciones realizadas:</h3>
          <ul className="list-disc pl-5 text-gray-700">
            {detailedAttempts.map((attempt, index) => (
              <li key={index}>
                <strong>{attempt.title}</strong> - Materia: {attempt.subject_name}, Docente: {attempt.teacher_name}, Curso: {attempt.course_name} <br />
                Intento #{attempt.attempt_number}: {attempt.score} puntos - {new Date(attempt.attempted_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TakeQuizPage;
