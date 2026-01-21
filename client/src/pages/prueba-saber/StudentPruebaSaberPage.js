// pages/prueba-saber/StudentPruebaSaberPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { GraduationCap, Play, BookOpen } from 'lucide-react';

const StudentPruebaSaberPage = () => {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState(null);
  const [questionsByLevel, setQuestionsByLevel] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [isTakingTest, setIsTakingTest] = useState(false);

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      // Obtener datos del estudiante
      const studentResponse = await axiosClient.get(`/students/by-user/${user.id}`);
      setStudentData(studentResponse.data);
      
      // Obtener preguntas Prueba Saber
      const questionsResponse = await axiosClient.get('/questions/prueba-saber');
      const questions = questionsResponse.data.data || [];
      
      // Agrupar por nivel
      const grouped = questions.reduce((acc, question) => {
        const level = question.prueba_saber_level;
        if (level && [3, 5, 9, 11].includes(level)) {
          if (!acc[level]) acc[level] = [];
          acc[level].push(question);
        }
        return acc;
      }, {});
      
      setQuestionsByLevel(grouped);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las preguntas Prueba Saber'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = (level) => {
    const questions = questionsByLevel[level] || [];
    if (questions.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin preguntas',
        text: `No hay preguntas disponibles para grado ${level}°`
      });
      return;
    }
    
    setSelectedLevel(level);
    setSelectedQuestions(questions);
    setAnswers({});
    setIsTakingTest(true);
  };

  const handleSubmitTest = async () => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Una vez que envíes, no podrás cambiar tus respuestas',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      // Calcular respuestas correctas
      let correct = 0;
      let total = selectedQuestions.length;
      
      selectedQuestions.forEach(question => {
        if (answers[question.id] && parseInt(answers[question.id]) === question.correct_answer) {
          correct++;
        }
      });

      const score = ((correct / total) * 5).toFixed(2);
      
      Swal.fire({
        title: '¡Prueba Completada!',
        html: `
          <div>
            <h3>Puntuación: ${score}/5.0</h3>
            <p>Respuestas correctas: <strong>${correct} de ${total}</strong></p>
            <p>Porcentaje: <strong>${((correct / total) * 100).toFixed(1)}%</strong></p>
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'Cerrar'
      });

      setIsTakingTest(false);
      setSelectedLevel(null);
      setSelectedQuestions([]);
      setAnswers({});
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (isTakingTest) {
    return (
      <div className="container py-4">
        <div className="card">
          <div className="card-header bg-primary text-white">
            <h4 className="mb-0">Prueba Saber - Grado {selectedLevel}°</h4>
          </div>
          <div className="card-body">
            {selectedQuestions.map((question, index) => (
              <div key={question.id} className="mb-4 p-3 border rounded">
                <h5>Pregunta {index + 1}</h5>
                <p className="mb-3">{question.question_text}</p>
                
                {question.image_url && (
                  <div className="mb-3">
                    <img 
                      src={question.image_url.startsWith('http') ? question.image_url : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${question.image_url}`}
                      alt="Pregunta"
                      className="img-fluid"
                      style={{ maxWidth: '300px' }}
                    />
                  </div>
                )}

                <div className="mb-3">
                  {[1, 2, 3, 4].map(num => (
                    <div key={num} className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="radio"
                        name={`question_${question.id}`}
                        id={`q${question.id}_opt${num}`}
                        value={num}
                        checked={answers[question.id] === num.toString()}
                        onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                      />
                      <label className="form-check-label" htmlFor={`q${question.id}_opt${num}`}>
                        {question[`option${num}`]}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="d-flex justify-content-between mt-4">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsTakingTest(false);
                  setSelectedLevel(null);
                  setSelectedQuestions([]);
                  setAnswers({});
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-success"
                onClick={handleSubmitTest}
                disabled={Object.keys(answers).length < selectedQuestions.length}
              >
                Enviar Prueba
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="mb-4">
        <h2 className="mb-3">
          <GraduationCap className="me-2" size={28} />
          Prueba Saber
        </h2>
        <p className="text-muted">
          Practica con preguntas tipo Prueba Saber para los diferentes grados
        </p>
      </div>

      <div className="row g-3">
        {[3, 5, 9, 11].map(level => {
          const questionCount = questionsByLevel[level]?.length || 0;
          return (
            <div key={level} className="col-md-6 col-lg-3">
              <div className="card h-100">
                <div className="card-body text-center">
                  <BookOpen size={48} className="mb-3 text-primary" />
                  <h4>Grado {level}°</h4>
                  <p className="text-muted">
                    {questionCount === 0 
                      ? 'Sin preguntas disponibles' 
                      : `${questionCount} pregunta${questionCount !== 1 ? 's' : ''} disponible${questionCount !== 1 ? 's' : ''}`
                    }
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleStartTest(level)}
                    disabled={questionCount === 0}
                  >
                    <Play size={18} className="me-2" />
                    {questionCount === 0 ? 'No disponible' : 'Iniciar Prueba'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StudentPruebaSaberPage;
