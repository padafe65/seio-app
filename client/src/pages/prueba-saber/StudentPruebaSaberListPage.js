// src/pages/prueba-saber/StudentPruebaSaberListPage.js
import React, { useEffect, useState, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { GraduationCap, BookOpen, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const StudentPruebaSaberListPage = () => {
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allAttempts, setAllAttempts] = useState([]);
  const [studentData, setStudentData] = useState(null);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // Verificar autenticación
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Cargar datos del estudiante
  useEffect(() => {
    const fetchStudentData = async () => {
      if (user && user.role === 'estudiante') {
        try {
          const studentResponse = await axiosClient.get(`/students/by-user/${user.id}`);
          setStudentData(studentResponse.data);
        } catch (error) {
          console.error('Error al cargar datos del estudiante:', error);
        }
      }
    };
    
    fetchStudentData();
  }, [user]);

  // Función para obtener el conteo de intentos
  const getAttemptCount = useCallback((questionnaireId) => {
    // Verificar que allAttempts sea un array
    if (!Array.isArray(allAttempts)) {
      console.warn('⚠️ allAttempts no es un array:', allAttempts);
      return 0;
    }
    
    const attempt = allAttempts.find(a => a.questionnaire_id === parseInt(questionnaireId));
    console.log(`Buscando intentos para cuestionario: ${questionnaireId} Encontrado:`, attempt);
    return attempt ? attempt.attempt_count : 0;
  }, [allAttempts]);

  // Cargar cuestionarios Prueba Saber
  useEffect(() => {
    if (!user || user.role !== 'estudiante') return;
    
    const fetchQuestionnaires = async () => {
      try {
        setLoading(true);
        const response = await axiosClient.get('/questionnaires');
        
        // Filtrar solo cuestionarios de Prueba Saber
        const pruebaSaberQuestionnaires = response.data.filter(q => 
          q.is_prueba_saber === 1 || q.is_prueba_saber === true
        );
        
        setQuestionnaires(pruebaSaberQuestionnaires);
        
        if (pruebaSaberQuestionnaires.length === 0) {
          Swal.fire({
            icon: 'info',
            title: 'No hay Pruebas Saber disponibles',
            text: 'No tienes Pruebas Saber asignadas en este momento.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#3085d6'
          });
        }
      } catch (error) {
        console.error('Error al cargar cuestionarios Prueba Saber:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las Pruebas Saber. Por favor, intenta más tarde.',
          confirmButtonText: 'Entendido'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionnaires();
  }, [user]);

  // Cargar todos los intentos del estudiante
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchAttempts = async () => {
      try {
        // Usar el endpoint correcto: /quiz/attempts/all/:student_id (user_id)
        const attemptsResponse = await axiosClient.get(`/quiz/attempts/all/${user.id}`);
        
        // El endpoint devuelve { attempts: [...], count: ... }
        const attempts = attemptsResponse.data?.attempts || [];
        
        console.log('📊 Intentos cargados:', attempts);
        setAllAttempts(attempts);
      } catch (error) {
        console.error('Error al cargar intentos:', error);
        setAllAttempts([]); // Asegurar que sea array incluso en error
      }
    };
    
    fetchAttempts();
  }, [user]);

  const handleStartTest = (questionnaireId) => {
    navigate(`/student/prueba-saber/test/${questionnaireId}`);
  };

  const formatLevel = (level) => {
    const levelMap = {
      3: '3°',
      5: '5°',
      7: '7°',
      9: '9°',
      11: '11°'
    };
    return levelMap[level] || level;
  };

  const formatType = (type) => {
    const typeMap = {
      'saber': 'Saber',
      'saber_pro': 'Saber Pro',
      'saber_tyt': 'Saber TyT'
    };
    return typeMap[type] || 'Saber';
  };

  return (
    <div className="container-fluid mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <GraduationCap className="me-2" size={32} />
            Pruebas Saber
          </h2>
          <p className="text-muted">
            Selecciona una Prueba Saber para comenzar. Tienes máximo 2 intentos por prueba.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Cargando Pruebas Saber...</p>
        </div>
      ) : questionnaires.length === 0 ? (
        <div className="alert alert-info d-flex align-items-center">
          <AlertCircle className="me-2" size={24} />
          <div>
            <h5 className="alert-heading mb-1">No hay Pruebas Saber disponibles</h5>
            <p className="mb-0">No tienes Pruebas Saber asignadas en este momento.</p>
          </div>
        </div>
      ) : (
        <div className="row">
          {questionnaires.map((q) => {
            const attemptCount = getAttemptCount(q.id);
            const maxAttempts = 2;
            const canTakeTest = attemptCount < maxAttempts;
            const isStudentGrade = studentData && parseInt(studentData.grade) === parseInt(q.grade);

            return (
              <div key={q.id} className="col-md-6 col-lg-4 mb-4">
                <div className={`card h-100 shadow-sm ${!canTakeTest || !isStudentGrade ? 'border-secondary' : 'border-primary'}`}>
                  <div className="card-header bg-gradient text-white" style={{
                    background: !canTakeTest || !isStudentGrade 
                      ? 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  }}>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h5 className="card-title mb-1">{q.title}</h5>
                        <p className="mb-0 small opacity-90">
                          {formatType(q.prueba_saber_type)} - Grado {formatLevel(q.prueba_saber_level)}
                        </p>
                      </div>
                      <span className="badge bg-white text-dark">
                        {q.subject}
                      </span>
                    </div>
                  </div>
                  
                  <div className="card-body">
                    {q.description && (
                      <p className="text-muted small mb-3">{q.description}</p>
                    )}
                    
                    <div className="mb-3">
                      <div className="d-flex align-items-center mb-2">
                        <BookOpen size={18} className="text-primary me-2" />
                        <span className="small">
                          <strong>Preguntas:</strong> {q.questions_to_answer || q.question_count || 'Todas'}
                        </span>
                      </div>
                      
                      {q.time_limit_minutes && (
                        <div className="d-flex align-items-center mb-2">
                          <Clock size={18} className="text-warning me-2" />
                          <span className="small">
                            <strong>Tiempo:</strong> {q.time_limit_minutes} minutos
                          </span>
                        </div>
                      )}
                      
                      <div className="d-flex align-items-center">
                        {canTakeTest ? (
                          <>
                            <CheckCircle size={18} className="text-success me-2" />
                            <span className="small text-success">
                              <strong>Intentos:</strong> {attemptCount} de {maxAttempts}
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle size={18} className="text-danger me-2" />
                            <span className="small text-danger">
                              <strong>Intentos agotados:</strong> {attemptCount} de {maxAttempts}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {!isStudentGrade && (
                      <div className="alert alert-warning py-2 mb-3 small">
                        <AlertCircle size={16} className="me-1" />
                        Esta prueba es para grado {q.grade}
                      </div>
                    )}

                    <button
                      className={`btn ${canTakeTest && isStudentGrade ? 'btn-primary' : 'btn-secondary'} w-100`}
                      onClick={() => handleStartTest(q.id)}
                      disabled={!canTakeTest || !isStudentGrade}
                    >
                      {!canTakeTest 
                        ? 'Intentos agotados'
                        : !isStudentGrade
                        ? 'No disponible para tu grado'
                        : 'Iniciar Prueba'
                      }
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentPruebaSaberListPage;
