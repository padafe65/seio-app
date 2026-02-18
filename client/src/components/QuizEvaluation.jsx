import React, { useState, useEffect } from 'react';
import axios from 'axios';

const QuizEvaluation = ({ studentId, questionnaireId, academicYear }) => {
    const [session, setSession] = useState(null);
    const [answers, setAnswers] = useState({});
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initQuiz = async () => {
            try {
                const res = await axios.post('/api/quiz/start', { student_id: studentId, questionnaire_id: questionnaireId, academic_year: academicYear });
                setSession(res.data);
                setAnswers(typeof res.data.answers_json === 'string' ? JSON.parse(res.data.answers_json) : (res.data.answers_json || {}));
                // Obtener preguntas
                if (res.data.question_ids_json) {
                    const ids = JSON.parse(res.data.question_ids_json);
                    const qRes = await axios.get(`/api/questions/by-ids?ids=${ids.join(',')}`);
                    setQuestions(qRes.data);
                }
                setLoading(false);
            } catch (err) {
                setLoading(false);
            }
        };
        initQuiz();
    }, []);

    const handleAnswer = async (questionId, value) => {
        const newAnswers = { ...answers, [questionId]: value };
        setAnswers(newAnswers);
        await axios.post('/api/quiz/save-progress', { session_id: session.id, answers: newAnswers });
    };

    const finishQuiz = async () => {
        await axios.post('/api/quiz/finish', { session_id: session.id, answers });
        alert('Evaluación enviada');
    };

    if (loading || !session) return <p>Cargando cuestionario...</p>;

    return (
        <div className="quiz-container">
            <h3>Intento #{session.attempt_number} - Año {session.academic_year}</h3>
            {questions.map(q => (
                <div key={q.id}>
                    <p>{q.text}</p>
                    <input
                        type="text"
                        value={answers[q.id] || ''}
                        onChange={e => handleAnswer(q.id, e.target.value)}
                    />
                </div>
            ))}
            <button onClick={finishQuiz}>Enviar Evaluación</button>
        </div>
    );
};

export default QuizEvaluation;