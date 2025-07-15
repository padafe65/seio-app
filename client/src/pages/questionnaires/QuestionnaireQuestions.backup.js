// src/pages/questionnaires/QuestionnaireQuestions.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/axios';
import Swal from 'sweetalert2';
import MathJax from 'better-react-mathjax';
import { MathJaxContext } from 'better-react-mathjax';
import { ArrowLeft, Save, Plus, Edit3, Trash2, CheckCircle } from 'lucide-react';

const QuestionnaireQuestions = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  const [currentQuestion, setCurrentQuestion] = useState({
    id: null,
    question_text: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correct_answer: '1',
    image: null
  });
  const [isEditing, setIsEditing] = useState(false);
  
  const [imagePreview, setImagePreview] = useState(null);
  const [showLatexGuide, setShowLatexGuide] = useState(false);
  
  useEffect(() => {
    const fetchQuestionnaireData = async () => {
      try {
        setLoading(true);
        console.log('=== INICIO DE CARGA DE DATOS ===');
        console.log('Solicitando cuestionario con ID:', id);
        
        // 1. Obtener el token del localStorage
        const token = localStorage.getItem('authToken');
        console.log('Token de autenticación:', token ? 'Presente' : 'No encontrado');
        
        // 2. Configurar los headers con el token
        const config = {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        };
        
        // 3. Obtener los datos del cuestionario con el token en los headers
        console.log('Realizando solicitud a:', `/api/questionnaires/${id}`);
        
        const response = await api.get(`/api/questionnaires/${id}`, config);
        
        console.log('=== RESPUESTA DE LA API ===');
        console.log('Status:', response.status, response.statusText);
        
        // Verificar si la respuesta es exitosa
        if (response.data && response.data.success) {
          // La respuesta exitosa debería tener un objeto data con las propiedades questionnaire, questions, etc.
          const responseData = response.data.data || response.data;
          
          if (!responseData) {
            throw new Error('No se recibieron datos del cuestionario en la respuesta');
          }
          
          // Extraer los datos del cuestionario y las preguntas
          const questionnaireData = responseData.questionnaire || responseData;
          const questionsData = responseData.questions || [];
          
          console.log('=== DETALLES DEL CUESTIONARIO ===');
          console.log('ID del cuestionario:', questionnaireData.id);
          console.log('Título:', questionnaireData.title);
          console.log('Creado por (teacher_id):', questionnaireData.created_by);
          console.log('Número de preguntas recibidas:', questionsData.length);
          
          if (questionsData.length > 0) {
            console.log('Primera pregunta recibida:', {
              id: questionsData[0].id,
              question_text: questionsData[0].question_text?.substring(0, 50) + '...',
              options: {
                option1: questionsData[0].option1?.substring(0, 30) + '...',
                option2: questionsData[0].option2?.substring(0, 30) + '...',
                correct_answer: questionsData[0].correct_answer
              }
            });
          }
          
          // Actualizar el estado con los datos del cuestionario
          setQuestionnaire(questionnaireData);
          
          // Asegurarse de que las preguntas tengan un ID único y los campos necesarios
          const processedQuestions = questionsData.map((q, index) => ({
            id: q.id || `temp-${Date.now()}-${index}`,
            question_text: q.question_text || '',
            option1: q.option1 || '',
            option2: q.option2 || '',
            option3: q.option3 || '',
            option4: q.option4 || '',
            correct_answer: q.correct_answer || '1',
            image: q.image || null,
            questionnaire_id: q.questionnaire_id || id
          }));
          
          console.log('Preguntas procesadas (primeras 2):', 
            processedQuestions.slice(0, 2).map(q => ({
              id: q.id,
              question_text: q.question_text?.substring(0, 30) + '...',
              options: [q.option1, q.option2, q.option3, q.option4],
              correct_answer: q.correct_answer
            }))
          );
          
          setQuestions(processedQuestions);
          
          // Mostrar mensaje si no hay preguntas
          if (processedQuestions.length === 0) {
            console.log('El cuestionario no tiene preguntas aún');
          }
        } else {
          // Si la respuesta no es exitosa, mostrar un mensaje de error
          console.error('La respuesta de la API no fue exitosa:', response.data);
          throw new Error(response.data?.message || 'Error al cargar el cuestionario');
        }
      } catch (error) {
        console.error('Error al cargar cuestionario:', error);
        
        // Extraer el mensaje de error de la respuesta de la API o usar un mensaje predeterminado
        let errorMessage = 'No se pudo cargar la información del cuestionario';
        
        if (error.response) {
          // El servidor respondió con un código de estado fuera del rango 2xx
          if (error.response.status === 403) {
            errorMessage = 'No tienes permiso para ver este cuestionario';
          } else if (error.response.status === 404) {
            errorMessage = 'El cuestionario solicitado no existe';
          } else if (error.response.data?.message) {
            errorMessage = error.response.data.message;
          }
        } else if (error.request) {
          // La solicitud fue hecha pero no se recibió respuesta
          errorMessage = 'No se recibió respuesta del servidor. Verifica tu conexión a internet.';
        }
        
        // Mostrar mensaje de error al usuario
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage,
          confirmButtonText: 'Entendido',
          allowOutsideClick: false
        });
        
        // Redirigir en caso de errores de autorización o no encontrado
        if (error.response?.status === 403 || error.response?.status === 404) {
          navigate('/cuestionarios');
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchQuestionnaireData();
    } else {
      setLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se proporcionó un ID de cuestionario válido',
        confirmButtonText: 'Entendido'
      }).then(() => {
        navigate('/cuestionarios');
      });
    }
  }, [id, navigate]);
  
  const handleQuestionChange = (e) => {
    const { name, value } = e.target;
    setCurrentQuestion({ ...currentQuestion, [name]: value });
  };
  
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedImage = e.target.files[0];
      setCurrentQuestion({ ...currentQuestion, image: selectedImage });
      setImagePreview(URL.createObjectURL(selectedImage));
    }
  };
  
  const handleEditQuestion = (question) => {
    setCurrentQuestion({
      id: question.id,
      question_text: question.question_text,
      option1: question.option1,
      option2: question.option2,
      option3: question.option3,
      option4: question.option4,
      correct_answer: question.correct_answer.toString(),
      image: null
    });
    setImagePreview(question.image_url || null);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setCurrentQuestion({
      id: null,
      question_text: '',
      option1: '',
      option2: '',
      option3: '',
      option4: '',
      correct_answer: '1',
      image: null
    });
    setImagePreview(null);
    setIsEditing(false);
  };

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    
    try {
      const formData = new FormData();
      formData.append('questionnaire_id', id);
      formData.append('question_text', currentQuestion.question_text);
      formData.append('option1', currentQuestion.option1);
      formData.append('option2', currentQuestion.option2);
      formData.append('option3', currentQuestion.option3);
      formData.append('option4', currentQuestion.option4);
      formData.append('correct_answer', currentQuestion.correct_answer);
      
      if (currentQuestion.image) {
        formData.append('image', currentQuestion.image);
      }

      let response;
      
      if (isEditing && currentQuestion.id) {
        // Actualizar pregunta existente
        response = await api.put(`/api/questions/${currentQuestion.id}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        // Actualizar la pregunta en la lista
        setQuestions(questions.map(q => 
          q.id === currentQuestion.id ? { ...q, ...currentQuestion, image_url: imagePreview } : q
        ));

        Swal.fire({
          icon: 'success',
          title: 'Pregunta actualizada',
          text: 'La pregunta ha sido actualizada correctamente'
        });
      } else {
        // Crear nueva pregunta
        response = await api.post('/api/questions', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        // Añadir la nueva pregunta a la lista
        const newQuestion = {
          id: response.data.id,
          question_text: currentQuestion.question_text,
          option1: currentQuestion.option1,
          option2: currentQuestion.option2,
          option3: currentQuestion.option3,
          option4: currentQuestion.option4,
          correct_answer: currentQuestion.correct_answer,
          image_url: imagePreview
        };
        
        setQuestions([...questions, newQuestion]);
        
        Swal.fire({
          icon: 'success',
          title: 'Pregunta añadida',
          text: 'La pregunta ha sido añadida correctamente'
        });
      }
      
      // Limpiar el formulario
      resetForm();
    } catch (error) {
      console.error('Error al guardar la pregunta:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Hubo un problema al ${isEditing ? 'actualizar' : 'añadir'} la pregunta: ${error.response?.data?.message || error.message}`
      });
    }
  };
  
  const handleDeleteQuestion = async (questionId) => {
    try {
      await api.delete(`/api/questions/${questionId}`);
      
      // Actualizar la lista de preguntas
      setQuestions(questions.filter(q => q.id !== questionId));
      
      Swal.fire({
        icon: 'success',
        title: 'Pregunta eliminada',
        text: 'La pregunta ha sido eliminada correctamente'
      });
    } catch (error) {
      console.error('Error al eliminar pregunta:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al eliminar la pregunta'
      });
    }
  };
  
  const handleFinish = () => {
    Swal.fire({
      icon: 'success',
      title: 'Cuestionario completado',
      text: `Se han añadido ${questions.length} preguntas al cuestionario`
    }).then(() => {
      navigate('/cuestionarios');
    });
  };
  
  // Ejemplos de LaTeX para la guía
  const latexExamples = [
    { description: 'Fracciones', latex: '\\frac{numerador}{denominador}', ejemplo: '\\frac{1}{2}' },
    { description: 'Exponentes', latex: 'base^{exponente}', ejemplo: 'x^{2}' },
    { description: 'Subíndices', latex: 'base_{subíndice}', ejemplo: 'x_{i}' },
    { description: 'Raíces', latex: '\\sqrt{expresión}', ejemplo: '\\sqrt{16}' },
    { description: 'Raíz n-ésima', latex: '\\sqrt[n]{expresión}', ejemplo: '\\sqrt[3]{27}' }
  ];
  
  if (loading) {
    return (
      <div className="container py-4">
        {/* Encabezado de carga */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <div className="placeholder-glow">
              <h2 className="placeholder col-6 rounded" style={{ height: '2rem' }}></h2>
            </div>
            <div className="placeholder-glow mt-2">
              <p className="placeholder col-8 rounded" style={{ height: '1.5rem' }}></p>
            </div>
          </div>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>

        {/* Formulario de carga */}
        <div className="card mb-4">
          <div className="card-header bg-light">
            <div className="placeholder-glow">
              <span className="placeholder col-3 rounded"></span>
            </div>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <div className="placeholder-glow">
                <span className="placeholder col-12 rounded" style={{ height: '100px' }}></span>
              </div>
            </div>
            <div className="row g-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="col-md-6">
                  <div className="placeholder-glow">
                    <span className="placeholder col-12 rounded" style={{ height: '60px' }}></span>
                  </div>
                </div>
              ))}
            </div>
            <div className="d-flex justify-content-end mt-3">
              <div className="placeholder-glow">
                <span className="placeholder col-3 rounded" style={{ height: '38px' }}></span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de preguntas de carga */}
        <div className="card">
          <div className="card-header bg-light">
            <div className="placeholder-glow">
              <span className="placeholder col-2 rounded"></span>
            </div>
          </div>
          <div className="card-body">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card mb-3 border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex align-items-center w-100">
                      <div className="bg-light rounded-circle me-3" style={{ width: '36px', height: '36px' }}></div>
                      <div className="w-100">
                        <div className="placeholder-glow w-100">
                          <span className="placeholder col-8 rounded"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="row g-2">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="col-md-6">
                        <div className="p-3 rounded bg-light">
                          <div className="d-flex align-items-start">
                            <div className="me-2">{j}.</div>
                            <div className="placeholder-glow w-100">
                              <span className="placeholder col-10 rounded"></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (!questionnaire) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Cuestionario no encontrado</h2>
        <p className="text-gray-500 mb-4">El cuestionario solicitado no existe o no tienes permiso para verlo.</p>
        <button 
          onClick={() => navigate('/cuestionarios')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Volver a la lista de cuestionarios
        </button>
      </div>
    );
  }

                {questionnaire.description || 'Agrega y gestiona las preguntas de este cuestionario'}
              </p>
              <div className="flex items-center text-sm text-gray-500 space-x-4">
                <span>Fase: {questionnaire.phase || 'No especificada'}</span>
                <span>Grado: {questionnaire.grade || 'No especificado'}</span>
                {questionnaire.teacher_name && (
                  <span>Docente: {`${questionnaire.teacher_name} ${questionnaire.teacher_lastname || ''}`.trim()}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate('/cuestionarios')}
              className="flex items-center px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a cuestionarios
            </button>
          </div>
        </div>
        
        <div className="card mb-4">
          <div className={`card-header ${isEditing ? 'bg-warning' : 'bg-success'} text-white`}>
            <h5 className="mb-0">{isEditing ? 'Editar Pregunta' : 'Añadir Nueva Pregunta'}</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmitQuestion}>
              {/* Texto de la pregunta con soporte para LaTeX */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <label htmlFor="question_text" className="form-label">Texto de la pregunta</label>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-info"
                    onClick={() => setShowLatexGuide(!showLatexGuide)}
                  >
                    {showLatexGuide ? 'Ocultar guía LaTeX' : 'Mostrar guía LaTeX'}
                  </button>
                </div>
                <textarea
                  id="question_text"
                  name="question_text"
                  value={currentQuestion.question_text}
                  onChange={handleQuestionChange}
                  className="form-control"
                  rows="3"
                  required
                  placeholder="Escribe la pregunta aquí. Puedes usar sintaxis LaTeX entre $ $ para expresiones matemáticas."
                />
                {currentQuestion.question_text && (
                  <div className="mt-2 p-3 border rounded bg-light">
                    <strong>Vista previa:</strong>
                    <MathJax>
                      <div dangerouslySetInnerHTML={{ __html: currentQuestion.question_text.replace(/\$(.*?)\$/g, '\\($1\\)') }} />
                    </MathJax>
                  </div>
                )}
              </div>
              
              {/* Guía de LaTeX (colapsable) */}
              {showLatexGuide && (
                <div className="mb-3 p-3 border rounded bg-light">
                  <h5>Guía rápida de LaTeX</h5>
                  <p className="text-muted">Escribe expresiones matemáticas entre símbolos $ $ en tu texto.</p>
                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Descripción</th>
                          <th>Sintaxis</th>
                          <th>Ejemplo</th>
                          <th>Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latexExamples.map((example, index) => (
                          <tr key={index}>
                            <td>{example.description}</td>
                  type="file"
                  id="image"
                  name="image"
                  onChange={handleImageChange}
                  className="form-control"
                  accept="image/*"
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img 
                      src={imagePreview} 
                      alt="Vista previa" 
                      style={{ maxHeight: '200px', maxWidth: '100%' }} 
                      className="img-thumbnail"
                    />
                  </div>
                )}
              </div>
              
              {/* Opciones de respuesta con soporte para LaTeX */}
              <div className="mb-3">
                <label className="form-label">Opciones de respuesta</label>
                
                {/* Opción 1 */}
                <div className="input-group mb-2">
                  <div className="input-group-text">
                    <input
                      type="radio"
                      name="correct_answer"
                      value="1"
                      checked={currentQuestion.correct_answer === '1'}
                      onChange={handleQuestionChange}
                      required
                    />
                  </div>
                  <input
                    type="text"
                    name="option1"
                    value={currentQuestion.option1}
                    onChange={handleQuestionChange}
                    className="form-control"
                    placeholder="Opción 1 (puedes usar LaTeX entre $ $)"
                    required
                  />
                </div>
                {currentQuestion.option1 && (
                  <div className="mb-2 ms-4 p-2 border rounded bg-light">
                    <MathJax>
                      <div dangerouslySetInnerHTML={{ __html: currentQuestion.option1.replace(/\$(.*?)\$/g, '\\($1\\)') }} />
                    </MathJax>
                  </div>
                )}
                
                {/* Opción 2 */}
                <div className="input-group mb-2">
                  <div className="input-group-text">
                    <input
                      type="radio"
                      name="correct_answer"
                      value="2"
                      checked={currentQuestion.correct_answer === '2'}
                      onChange={handleQuestionChange}
                      required
                    />
                  </div>
                  <input
                    type="text"
                    name="option2"
                    value={currentQuestion.option2}
                    onChange={handleQuestionChange}
                    className="form-control"
                    placeholder="Opción 2 (puedes usar LaTeX entre $ $)"
                    required
                  />
                </div>
                {currentQuestion.option2 && (
                  <div className="mb-2 ms-4 p-2 border rounded bg-light">
                    <MathJax>
                      <div dangerouslySetInnerHTML={{ __html: currentQuestion.option2.replace(/\$(.*?)\$/g, '\\($1\\)') }} />
                    </MathJax>
                  </div>
                )}
                
                {/* Opción 3 */}
                <div className="input-group mb-2">
                  <div className="input-group-text">
                    <input
                      type="radio"
                      name="correct_answer"
                      value="3"
                      checked={currentQuestion.correct_answer === '3'}
                      onChange={handleQuestionChange}
                      required
                    />
                  </div>
                  <input
                    type="text"
                    name="option3"
                    value={currentQuestion.option3}
                    onChange={handleQuestionChange}
                    className="form-control"
                    placeholder="Opción 3 (puedes usar LaTeX entre $ $)"
                    required
                  />
                </div>
                {currentQuestion.option3 && (
                  <div className="mb-2 ms-4 p-2 border rounded bg-light">
                    <MathJax>
                      <div dangerouslySetInnerHTML={{ __html: currentQuestion.option3.replace(/\$(.*?)\$/g, '\\($1\\)') }} />
                    </MathJax>
                  </div>
                )}
                
                {/* Opción 4 */}
                <div className="input-group mb-2">
                  <div className="input-group-text">
                    <input
                      type="radio"
                      name="correct_answer"
                      value="4"
                      checked={currentQuestion.correct_answer === '4'}
                      onChange={handleQuestionChange}
                      required
                    />
                  </div>
                  <input
                    type="text"
                    name="option4"
                    value={currentQuestion.option4}
                    onChange={handleQuestionChange}
                    className="form-control"
                    placeholder="Opción 4 (puedes usar LaTeX entre $ $)"
                    required
                  />
                </div>
                {currentQuestion.option4 && (
                  <div className="mb-2 ms-4 p-2 border rounded bg-light">
                    <MathJax>
                      <div dangerouslySetInnerHTML={{ __html: currentQuestion.option4.replace(/\$(.*?)\$/g, '\\($1\\)') }} />
                    </MathJax>
                  </div>
                )}
                
                <div className="form-text text-muted">
                  Selecciona el botón de radio junto a la opción correcta.
                </div>
              </div>
              
              <div className="d-flex justify-content-between">
                <div>
                  {isEditing && (
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary me-2"
                      onClick={resetForm}
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary"
                    onClick={handleFinish}
                  >
                    Finalizar
                  </button>
                </div>
                <button 
                  type="submit" 
                  className={`btn ${isEditing ? 'btn-warning' : 'btn-success'} d-flex align-items-center gap-2`}
                >
                  {isEditing ? (
                    <>
                      <Save size={18} />
                      Actualizar Pregunta
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Añadir Pregunta
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        
        {/* Lista de preguntas existentes */}
        <div className="card">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Preguntas ({questions.length})</h5>
            <button 
              className="btn btn-sm btn-outline-light"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <Plus size={16} className="me-1" />
              Agregar Pregunta
            </button>
          </div>
          <div className="card-body">
            {questions.length === 0 ? (
              <div className="text-center py-5">
                <div className="mb-3">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="48" 
                    height="48" 
                    fill="currentColor" 
                    className="bi bi-question-circle text-muted" 
                    viewBox="0 0 16 16"
                  >
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
                  </svg>
                </div>
                <h5 className="text-muted mb-3">No hay preguntas en este cuestionario</h5>
                <p className="text-muted mb-4">
                  Comienza agregando la primera pregunta utilizando el formulario de arriba.
                </p>
                <button 
                  className="btn btn-primary"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  <Plus size={16} className="me-1" />
                  Agregar Primera Pregunta
                </button>
              </div>
            ) : (
              <div className="list-group">
                {console.log('=== RENDERIZANDO PREGUNTAS ===', questions)}
                {questions.length > 0 && questions.map((question, index) => {
                  console.log(`Pregunta ${index + 1}:`, {
                    id: question.id,
                    text: question.question_text?.substring(0, 50) + '...',
                    options: [question.option1, question.option2, question.option3, question.option4],
                    correct: question.correct_answer
                  });
                  
                  return (
                    <div key={question.id || `question-${index}`} className="card mb-4 border-0 shadow-sm">
                      <div className="card-body">
                        {/* Encabezado de la pregunta */}
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div className="d-flex align-items-center">
                            <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                              <span className="fw-bold">{index + 1}</span>
                            </div>
                            <h5 className="mb-0 ms-3">
                              {question.question_text ? (
                                <MathJax>
                                  <div dangerouslySetInnerHTML={{ 
                                    __html: typeof question.question_text === 'string' 
                                      ? question.question_text.replace(/\$(.*?)\$/g, '\\($1\\)') 
                                      : 'Texto de pregunta no disponible' 
                                  }} />
                                </MathJax>
                              ) : (
                                <span className="text-muted fst-italic">Pregunta sin texto</span>
                              )}
                            </h5>
                          </div>
                          
                          {/* Botones de acción */}
                          <div className="btn-group" role="group">
                            <button 
                              className="btn btn-sm btn-outline-primary d-flex align-items-center"
                              onClick={() => handleEditQuestion(question)}
                              title="Editar pregunta"
                            >
                              <Edit3 size={14} className="me-1" />
                              <span className="d-none d-md-inline">Editar</span>
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger d-flex align-items-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteQuestion(question.id);
                              }}
                              title="Eliminar pregunta"
                            >
                              <Trash2 size={14} className="me-1" />
                              <span className="d-none d-md-inline">Eliminar</span>
                            </button>
                          </div>
                        </div>
                        
                        {/* Imagen de la pregunta si existe */}
                        {question.image_url && (
                          <div className="mb-3 text-center">
                            <img 
                              src={question.image_url} 
                              alt="Imagen de la pregunta" 
                              className="img-fluid rounded border" 
                              style={{ maxHeight: '200px' }} 
                            />
                          </div>
                        )}
                        
                        {/* Opciones de respuesta */}
                        <div className="row g-2 mt-3">
                          {[1, 2, 3, 4].map((num) => {
                            const optionKey = `option${num}`;
                            const isCorrect = question.correct_answer === num.toString();
                            const optionText = question[optionKey];
                            
                            return optionText ? (
                              <div key={num} className="col-md-6">
                                <div className={`p-3 rounded ${isCorrect ? 'bg-success bg-opacity-10 border border-success' : 'bg-light'}`}>
                                  <div className="d-flex align-items-start">
                                    <div className={`me-2 fw-bold ${isCorrect ? 'text-success' : 'text-muted'}`}>
                                      {num}.
                                    </div>
                                    <div className="flex-grow-1">
                                      <MathJax>
                                        <div 
                                          className={isCorrect ? 'text-success fw-medium' : ''}
                                          dangerouslySetInnerHTML={{ 
                                            __html: typeof optionText === 'string' 
                                              ? optionText.replace(/\$(.*?)\$/g, '\\($1\\)')
                                              : 'Opción sin texto' 
                                          }} 
                                        />
                                      </MathJax>
                                    </div>
                                    {isCorrect && (
                                      <div className="ms-2 text-success">
                                        <CheckCircle size={18} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </MathJaxContext>
  );
};

export default QuestionnaireQuestions;
