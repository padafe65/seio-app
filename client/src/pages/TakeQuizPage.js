// src/pages/TakeQuizPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const TakeQuizPage = ({ studentId }) => {
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questionnaireId, setQuestionnaireId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);

  useEffect(() => {
    axios
      .get('/api/questionnaires')
      .then((res) => setQuestionnaires(res.data))
      .catch((err) => console.error('Error al cargar cuestionarios:', err));
  }, []);

  useEffect(() => {
    if (!questionnaireId) return;

    axios
      .get(`/api/quiz/attempts/${studentId}/${questionnaireId}`)
      .then((res) => {
        setAttempts(res.data.attempts || []);
        if ((res.data.count || 0) >= 2) {
          setMaxAttemptsReached(true);
          setQuestions([]);
          setScore(null);
          setSubmitted(false);
        } else {
          setMaxAttemptsReached(false);
          axios
            .get(`/api/quiz/questions/${questionnaireId}`)
            .then((res) => {
              setQuestions(res.data);
              setAnswers({});
              setScore(null);
              setSubmitted(false);
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

      // Volver a cargar intentos después del submit
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
      <h2 className="text-xl mb-4">Presentar evaluación</h2>

      <div className="mb-4">
        <label className="mr-2">Selecciona un cuestionario:</label>
        <select
          value={questionnaireId}
          onChange={(e) => setQuestionnaireId(e.target.value)}
          className="border px-2 py-1"
        >
          <option value="">-- Selecciona --</option>
          {questionnaires.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title || `Cuestionario ${q.id}`}
            </option>
          ))}
        </select>
      </div>

      {maxAttemptsReached && (
        <div className="text-red-600 font-semibold mb-4">
          Ya has realizado los 2 intentos permitidos para este cuestionario.
        </div>
      )}

      {!maxAttemptsReached &&
        questions.map((q) => (
          <div key={q.id} className="mb-4">
            <p className="font-semibold">{q.question_text}</p>
            {q.image_url && (
              <img src={q.image_url} alt="Imagen pregunta" className="w-48 my-2" />
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

      {!maxAttemptsReached && questions.length > 0 && !submitted && (
        <button
          onClick={handleSubmit}
          className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
        >
          Enviar respuestas
        </button>
      )}

      {submitted && (
        <div className="mt-4 text-green-600 font-bold text-lg">
          Tu nota final: {score}
        </div>
      )}

      {attempts.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">Intentos anteriores:</h3>
          <ul className="list-disc pl-5 text-gray-700">
            {attempts.map((attempt, index) => (
              <li key={index}>
                Intento #{attempt.attempt_number}: {attempt.score} puntos -{' '}
                {new Date(attempt.attempted_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TakeQuizPage;
