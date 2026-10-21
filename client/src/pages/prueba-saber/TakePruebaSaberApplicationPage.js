import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import QuestionFigureSet from '../../components/QuestionFigureSet';
import Swal from 'sweetalert2';

export default function TakePruebaSaberApplicationPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(null);
  const [busy, setBusy] = useState(false);
  const questions = data?.questions || [];
  const current = questions[index];
  const remaining = seconds == null ? null : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  useEffect(() => {
    axiosClient.get(`/prueba-saber/applications/${applicationId}`).then((response) => {
      const result = response.data.data;
      setData(result);
      if (result.attempt?.answers_json) {
        try { setAnswers(JSON.parse(result.attempt.answers_json)); } catch { setAnswers({}); }
      }
      if (result.attempt?.remaining_seconds != null) setSeconds(Math.max(0, Number(result.attempt.remaining_seconds)));
    }).catch((error) => Swal.fire('No disponible', error.response?.data?.message || 'No se pudo abrir la aplicación.', 'error').then(() => navigate('/student/prueba-saber')));
  }, [applicationId, navigate]);

  useEffect(() => {
    if (seconds == null || seconds <= 0 || data?.attempt?.status === 'submitted' || data?.attempt?.status === 'expired') return undefined;
    const timer = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds, data]);

  const submit = async (force = false) => {
    if (!data || data.attempt?.status === 'submitted' || data.attempt?.status === 'expired' || busy) return;
    if (!force) {
      const confirmation = await Swal.fire({
        title: '¿Enviar respuestas?',
        text: `Respondidas ${Object.keys(answers).length} de ${questions.length}. Las preguntas sin responder cuentan como incorrectas.`,
        icon: 'question', showCancelButton: true, confirmButtonText: 'Enviar', cancelButtonText: 'Seguir respondiendo'
      });
      if (!confirmation.isConfirmed) return;
    }
    setBusy(true);
    try {
      const response = await axiosClient.post(`/prueba-saber/applications/${applicationId}/submit`, { answers });
      setData({ ...data, attempt: response.data.data });
    } catch (error) { Swal.fire('Error', error.response?.data?.message || 'No se pudo guardar la calificación.', 'error'); }
    finally { setBusy(false); }
  };

  const selectAnswer = (questionId, option) => {
    const next = { ...answers, [questionId]: option };
    setAnswers(next);
    axiosClient.put(`/prueba-saber/applications/${applicationId}/progress`, { answers: next })
      .catch((error) => console.error('No se guardó el avance de la prueba:', error));
  };

  useEffect(() => { if (seconds === 0 && data && !['submitted', 'expired'].includes(data.attempt?.status)) submit(true); }, [seconds, data]);

  if (!data) return <div className="container py-5 text-center">Cargando aplicación...</div>;
  const { application, attempt } = data;
  if (attempt?.status === 'submitted' || attempt?.status === 'expired') return <div className="container py-5"><div className="card"><div className="card-body text-center"><h2>{application.title}</h2><p className="lead">Calificación informativa: <strong>{attempt.score} / 5.0</strong></p><p>{attempt.correct_count} correctas de {attempt.total_questions}. Este resultado no se promedia con tus fases.</p><button className="btn btn-primary" onClick={() => navigate('/student/prueba-saber')}>Volver a mis pruebas</button></div></div></div>;
  if (!current) return <div className="container py-5">Esta aplicación no contiene preguntas.</div>;

  return <main className="container py-4">
    <div className="d-flex justify-content-between align-items-center mb-3"><div><h2>{application.title}</h2><p className="text-muted mb-0">{application.subject} · {application.course_name}</p></div>{remaining !== null && <span className="badge bg-warning text-dark fs-5">{remaining}</span>}</div>
    <div className="progress mb-3"><div className="progress-bar" style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
    <section className="card"><div className="card-header">Pregunta {index + 1} de {questions.length}</div><div className="card-body">
      <h5 style={{ whiteSpace: 'pre-wrap' }}>{current.question_text}</h5>
      {current.image_url && <QuestionFigureSet questionId={current.id} fallbackSrc={current.image_url} alt="Figura de pregunta" className="img-fluid my-3" style={{ maxHeight: 420 }} />}
      {[1, 2, 3, 4].map((number) => <label key={number} className={`d-block border rounded p-3 my-2 ${Number(answers[current.id]) === number ? 'border-primary bg-light' : ''}`}>
        <input type="radio" name={`q-${current.id}`} className="me-2" checked={Number(answers[current.id]) === number} onChange={() => selectAnswer(current.id, number)} />
        {String.fromCharCode(64 + number)}. {current[`option${number}`]}
      </label>)}
    </div></section>
    <div className="d-flex justify-content-between mt-3"><button className="btn btn-outline-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Anterior</button><span>Respondidas {Object.keys(answers).length}/{questions.length}</span>{index < questions.length - 1 ? <button className="btn btn-primary" onClick={() => setIndex(index + 1)}>Siguiente</button> : <button className="btn btn-success" disabled={busy} onClick={() => submit()}>{busy ? 'Guardando...' : 'Enviar prueba'}</button>}</div>
  </main>;
}
