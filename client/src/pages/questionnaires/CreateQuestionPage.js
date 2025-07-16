// src/pages/questionnaires/QuestionnaireQuestions.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/axios';
import Swal from 'sweetalert2';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import { ArrowLeft, Plus } from 'lucide-react';

const CreateQuestionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
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
    category: questionnaire?.category || '', // Inicializar con la categoría del cuestionario si está disponible
    image: null
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [showLatexGuide, setShowLatexGuide] = useState(false);
  const [showRawText, setShowRawText] = useState({}); // Para controlar la visualización de texto plano vs renderizado
  const [showRawCurrent, setShowRawCurrent] = useState(false); // Para la pregunta actual
  
  useEffect(() => {
    const fetchQuestionnaireData = async () => {
      try {
        setIsLoading(true);
        
        // 1. Obtener los datos del cuestionario
        const questionnaireResponse = await api.get(`/api/questionnaires/${id}`);
        const questionnaireData = questionnaireResponse.data.data; // Ajustar según la estructura de la respuesta
        setQuestionnaire(questionnaireData);
        
        // 2. Obtener las preguntas del cuestionario
        console.log('Obteniendo preguntas para el cuestionario ID:', id);
        const questionsResponse = await api.get(`/api/questions?questionnaire_id=${id}`);
        console.log('Respuesta de preguntas:', questionsResponse);
        
        // Asegurarse de que la respuesta tenga el formato esperado
        let questionsData = [];
        if (questionsResponse.data && questionsResponse.data.success) {
          questionsData = questionsResponse.data.data || [];
        } else if (Array.isArray(questionsResponse.data)) {
          // Si la respuesta es directamente un array
          questionsData = questionsResponse.data;
        }
        
        console.log('Preguntas obtenidas:', questionsData);
        
        // Procesar las preguntas
        const processedQuestions = questionsData.map(question => {
          // Asegurarse de que todas las propiedades necesarias existan
          const processedQuestion = {
            id: question.id,
            question_text: question.question_text || '',
            option1: question.option1 || '',
            option2: question.option2 || '',
            option3: question.option3 || '',
            option4: question.option4 || '',
            correct_answer: question.correct_answer || '1',
            category: question.category || questionnaireData.category || '',
            image_url: question.image_url || null,
            options: [
              question.option1,
              question.option2,
              question.option3,
              question.option4
            ].filter(Boolean) // Filtrar opciones vacías
          };
          
          console.log('Pregunta procesada:', processedQuestion);
          return processedQuestion;
        });
        
        setQuestions(processedQuestions);
        
        // Actualizar el estado actual con la categoría del cuestionario
        setCurrentQuestion(prev => ({
          ...prev,
          questionnaire_id: id,
          category: questionnaireData.category || ''
        }));
        
      } catch (error) {
        console.error('Error al cargar el cuestionario:', {
          error,
          response: error.response?.data,
          status: error.response?.status
        });
        
        Swal.fire({ 
          icon: 'error', 
          title: 'Error', 
          text: 'No se pudieron cargar las preguntas del cuestionario. Por favor, inténtalo de nuevo.'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      fetchQuestionnaireData();
    }
  }, [id]);
  
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
  
  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    
    // Validar campos requeridos
    const requiredFields = ['question_text', 'option1', 'option2', 'correct_answer', 'category'];
    const missingFields = requiredFields.filter(field => !currentQuestion[field]);
    
    if (missingFields.length > 0) {
      Swal.fire({
        icon: 'error',
        title: 'Campos requeridos',
        text: `Por favor completa los siguientes campos: ${missingFields.join(', ')}`
      });
      return;
    }
    
    // Obtener el texto de la opción correcta basado en el índice
    const correctAnswerIndex = parseInt(currentQuestion.correct_answer) - 1; // Convertir a 0-based index
    const options = [
      currentQuestion.option1,
      currentQuestion.option2,
      currentQuestion.option3,
      currentQuestion.option4
    ].filter(Boolean);
    
    const correctAnswerText = options[correctAnswerIndex];
    
    if (!correctAnswerText) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'La respuesta correcta seleccionada no es válida. Por favor, verifica las opciones.'
      });
      return;
    }
    
    try {
      const formData = new FormData();
      
      // Agregar campos obligatorios
      formData.append('questionnaire_id', id);
      formData.append('question_text', currentQuestion.question_text || '');
      formData.append('option1', currentQuestion.option1 || '');
      formData.append('option2', currentQuestion.option2 || '');
      formData.append('option3', currentQuestion.option3 || '');
      formData.append('option4', currentQuestion.option4 || '');
      
      // Enviar el texto de la opción correcta en lugar del índice
      formData.append('correct_answer', correctAnswerText);
      formData.append('category', currentQuestion.category || '');
      
      console.log('Enviando respuesta correcta:', correctAnswerText);
      
      // Solo agregar la imagen si existe
      if (currentQuestion.image) {
        formData.append('image', currentQuestion.image);
      } else if (imagePreview && !currentQuestion.image) {
        // Si hay una imagen previa pero no se ha seleccionado una nueva, mantener la existente
        formData.append('keep_existing_image', 'true');
      }
      
      let response;
      
      if (isEditing) {
        // Actualizar pregunta existente
        response = await api.put(`/api/questions/${currentQuestion.id}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        // Actualizar la pregunta en la lista
        setQuestions(questions.map(q => 
          q.id === currentQuestion.id ? { ...currentQuestion, image_url: imagePreview || q.image_url } : q
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
    } catch (error) {
      console.error('Error al procesar la pregunta:', {
        error,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
        request: error.request
      });
      
      let errorMessage = 'Hubo un problema al procesar la pregunta';
      
      if (error.response) {
        // El servidor respondió con un estado de error
        if (error.response.status === 404) {
          errorMessage = 'No se encontró el recurso solicitado. Por favor, verifica la URL.';
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else {
          errorMessage = `Error del servidor (${error.response.status}): ${error.response.statusText}`;
        }
      } else if (error.request) {
        // La solicitud fue hecha pero no se recibió respuesta
        errorMessage = 'No se recibió respuesta del servidor. Verifica tu conexión.';
      }
      
      Swal.fire({
        icon: 'error',
        title: 'Error',
        html: `
          <div style="text-align: left;">
            <p>${errorMessage}</p>
            ${error.response?.data?.details ? `<p><strong>Detalles:</strong> ${error.response.data.details}</p>` : ''}
            ${process.env.NODE_ENV === 'development' ? `<pre style="font-size: 12px; text-align: left; overflow: auto; max-height: 200px;">${JSON.stringify({
              status: error.response?.status,
              data: error.response?.data,
              config: {
                url: error.config?.url,
                method: error.config?.method,
                headers: error.config?.headers
              }
            }, null, 2)}</pre>` : ''}
          </div>
        `,
        confirmButtonText: 'Entendido',
        width: '600px'
      });
    }
  };

  const handleEditQuestion = (question) => {
    console.log('Editando pregunta:', question);
    
    // Asegurarse de que la respuesta correcta esté en el formato correcto (1, 2, 3 o 4)
    const correctAnswer = question.correct_answer ? String(question.correct_answer) : '1';
    
    setCurrentQuestion(prev => ({
      ...prev,  // Mantener el estado actual para no perder ningún campo
      id: question.id,
      question_text: question.question_text || '',
      option1: question.option1 || '',
      option2: question.option2 || '',
      option3: question.option3 || '',
      option4: question.option4 || '',
      correct_answer: correctAnswer,
      category: question.category || questionnaire?.category || '', // Usar la categoría de la pregunta o del cuestionario
      image: null
    }));
    
    // Si hay una URL de imagen, establecer la vista previa
    if (question.image_url) {
      setImagePreview(question.image_url);
    } else {
      setImagePreview(null);
    }
    
    setIsEditing(true);
    setShowRawCurrent(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleCancelEdit = () => {
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
    setShowRawCurrent(false);
  };
  
  const handleDeleteQuestion = async (questionId) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await api.delete(`/api/questions/${questionId}`);
        setQuestions(questions.filter(q => q.id !== questionId));
        
        Swal.fire(
          '¡Eliminada!',
          'La pregunta ha sido eliminada.',
          'success'
        );
      } catch (error) {
        console.error('Error al eliminar la pregunta:', error);
        Swal.fire(
          'Error',
          'No se pudo eliminar la pregunta',
          'error'
        );
      }
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
  
  if (isLoading) {
    return (
      <div className="d-flex justify-content-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }
  
  return (
    <MathJaxContext>
      <div className="container my-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Preguntas del Cuestionario</h2>
          <button 
            className="btn btn-outline-secondary d-flex align-items-center gap-2"
            onClick={() => navigate('/cuestionarios')}
          >
            <ArrowLeft size={18} />
            Volver
          </button>
        </div>
        
        {questionnaire && questions.length > 0 ? (
          <div className="row">
            <div className="col-md-12">
              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h5><strong>{questionnaire.title}</strong></h5>
                    <p className="text-muted mb-0">{questionnaire.description}</p>
                  </div>
                  {questionnaire.course_name && (
                    <div className="text-end">
                      <span className="badge bg-info text-dark">
                        <i className="fas fa-book me-1"></i>
                        {questionnaire.course_name} 
                        {questionnaire.course_grade && `(${questionnaire.course_grade}° grado)`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-md-12">
              <div className="mb-3">
                <label htmlFor="questionnaireSelect" className="form-label">Seleccionar cuestionario</label>
                <select 
                  className="form-select" 
                  id="questionnaireSelect"
                  value={questionnaire.id}
                  disabled
                >
                  <option value="">Seleccione un cuestionario</option>
                  <option value={questionnaire.id}>{questionnaire.title}</option>
                </select>
              </div>
            </div>
            <div className="col-md-12">
              <div className="card mb-4">
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">{questionnaire.title}</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-3">
                      <strong>Categoría:</strong> {questionnaire.category.replace('_', ' - ')}
                    </div>
                    <div className="col-md-3">
                      <strong>Grado:</strong> {questionnaire.grade}°
                    </div>
                    <div className="col-md-3">
                      <strong>Fase:</strong> {questionnaire.phase}
                    </div>
                    <div className="col-md-3">
                      <strong>Curso:</strong> {questionnaire.course_name}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card mb-4">
            <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                {isEditing ? 'Editar Pregunta' : 'Añadir Nueva Pregunta'}
              </h5>
              {isEditing && (
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-light"
                  onClick={handleCancelEdit}
                >
                  Cancelar edición
                </button>
              )}
            </div>
            <div className="card-body">
              <p className="text-muted">No hay preguntas existentes en este cuestionario. Añade la primera pregunta.</p>
            </div>
          </div>
        )}
        
        <div className="card mb-4">
          <div className="card-header bg-success text-white">
            <h5 className="mb-0">Añadir Nueva Pregunta</h5>
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
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong>Vista previa:</strong>
                      <button 
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setShowRawCurrent(!showRawCurrent)}
                      >
                        <i className={`fas fa-${showRawCurrent ? 'eye' : 'code'}`}></i> {showRawCurrent ? 'Ver renderizado' : 'Ver código'}
                      </button>
                    </div>
                    <div className="d-flex flex-column gap-2">
                      <div className={`p-3 bg-white rounded border ${!showRawCurrent ? 'd-block' : 'd-none'}`}>
                        <MathJax>
                          <div dangerouslySetInnerHTML={{ 
                            __html: (currentQuestion.question_text || '')
                              .replace(/\\text\{(.*?)\}/g, '$1')
                              .replace(/\$(.*?)\$/g, '\\($1\\)')
                          }} />
                        </MathJax>
                      </div>
                      <div className={`${showRawCurrent ? 'd-block' : 'd-none'}`}>
                        <pre className="mb-0 p-2 bg-light rounded"><code>{currentQuestion.question_text}</code></pre>
                      </div>
                      <div className="form-text">
                        <button 
                          type="button" 
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setShowRawCurrent(!showRawCurrent)}
                        >
                          <i className={`fas fa-${showRawCurrent ? 'eye' : 'code'}`}></i> 
                          {showRawCurrent ? 'Ver renderizado' : 'Ver código'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Vista previa de opciones */}
                    <div className="mt-4">
                      <h6 className="mb-3"><strong>Opciones de respuesta:</strong></h6>
                      {[1, 2, 3, 4].map(optNum => {
                        const optionText = currentQuestion[`option${optNum}`] || '';
                        const isCorrect = currentQuestion.correct_answer === String(optNum);
                        
                        return (
                          <div 
                            key={optNum} 
                            className={`p-3 mb-2 rounded ${isCorrect ? 'bg-success bg-opacity-10 border border-success' : 'bg-light'}`}
                          >
                            <div className="form-check d-flex align-items-start">
                              <div className="d-flex align-items-center me-3">
                                <input 
                                  className="form-check-input" 
                                  type="radio" 
                                  name={`correct-${currentQuestion.id}`} 
                                  checked={isCorrect}
                                  onChange={() => {}}
                                  disabled={!isEditing}
                                />
                                <span className="badge bg-primary ms-2 me-2">Opción {optNum}</span>
                                {isCorrect && (
                                  <span className="badge bg-success">
                                    <i className="fas fa-check me-1"></i> Correcta
                                  </span>
                                )}
                              </div>
                              <div className="flex-grow-1">
                                {showRawCurrent ? (
                                  <pre className="mb-0"><code>{optionText}</code></pre>
                                ) : (
                                  <MathJax>
                                    <div dangerouslySetInnerHTML={{ 
                                      __html: optionText
                                        .replace(/\\text\{(.*?)\}/g, '$1')
                                        .replace(/\$(.*?)\$/g, '\\($1\\)') 
                                    }} />
                                  </MathJax>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                            <td><code>{example.latex}</code></td>
                            <td><code>${example.ejemplo}$</code></td>
                            <td>
                              <MathJax>
                                <div dangerouslySetInnerHTML={{ __html: `\\(${example.ejemplo}\\)` }} />
                              </MathJax>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Subida de imagen */}
              <div className="mb-3">
                <label htmlFor="image" className="form-label">Imagen (opcional)</label>
                <input
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
                      className="form-check-input"
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
                  <div className="ms-4">
                    <div className="p-2 border rounded bg-light">
                      <MathJax>
                        <div dangerouslySetInnerHTML={{ 
                          __html: (currentQuestion.option1 || '')
                            .replace(/\\text\{(.*?)\}/g, '$1')
                            .replace(/\$(.*?)\$/g, '\\($1\\)') 
                        }} />
                      </MathJax>
                    </div>
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
                      className="form-check-input"
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
                  <div className="ms-4">
                    <div className="p-2 border rounded bg-light">
                      <MathJax>
                        <div dangerouslySetInnerHTML={{ 
                          __html: (currentQuestion.option2 || '')
                            .replace(/\\text\{(.*?)\}/g, '$1')
                            .replace(/\$(.*?)\$/g, '\\($1\\)') 
                        }} />
                      </MathJax>
                    </div>
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
                      className="form-check-input"
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
                  <div className="ms-4">
                    <div className="p-2 border rounded bg-light">
                      <MathJax>
                        <div dangerouslySetInnerHTML={{ 
                          __html: (currentQuestion.option3 || '')
                            .replace(/\\text\{(.*?)\}/g, '$1')
                            .replace(/\$(.*?)\$/g, '\\($1\\)') 
                        }} />
                      </MathJax>
                    </div>
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
                      className="form-check-input"
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
                  <div className="ms-4">
                    <div className="p-2 border rounded bg-light">
                      <MathJax>
                        <div dangerouslySetInnerHTML={{ 
                          __html: (currentQuestion.option4 || '')
                            .replace(/\\text\{(.*?)\}/g, '$1')
                            .replace(/\$(.*?)\$/g, '\\($1\\)') 
                        }} />
                      </MathJax>
                    </div>
                  </div>
                )}
                
                <div className="form-text text-muted">
                  Selecciona el botón de radio junto a la opción correcta.
                </div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary me-2"
                    onClick={handleFinish}
                  >
                    <i className="fas fa-arrow-left me-1"></i> Volver
                  </button>
                  {isEditing && (
                    <button 
                      type="button" 
                      className="btn btn-outline-danger"
                      onClick={handleCancelEdit}
                    >
                      <i className="fas fa-times me-1"></i> Cancelar edición
                    </button>
                  )}
                </div>
                <div className="d-flex gap-2">
                  {isEditing && (
                    <button 
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleDeleteQuestion(currentQuestion.id)}
                    >
                      Eliminar Pregunta
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="btn btn-success d-flex align-items-center gap-2"
                  >
                    {isEditing ? (
                      <>
                        <i className="fas fa-save"></i>
                        Guardar Cambios
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Añadir Pregunta
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
        
        {/* Lista de preguntas existentes */}
        <div className="card">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">Preguntas ({questions.length})</h5>
          </div>
          <div className="card-body">
            {questions.length === 0 ? (
              <div className="alert alert-info">
                No hay preguntas añadidas a este cuestionario. Utiliza el formulario de arriba para añadir preguntas.
              </div>
            ) : (
              <div className="list-group">
                {questions.map((question, index) => (
                  <div key={question.id} className="list-group-item list-group-item-action">
                    <div className="d-flex w-100 justify-content-between">
                      <div className="d-flex flex-column w-100">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <h5 className="mb-0">Pregunta {index + 1}</h5>
                          {question.course_name && (
                            <span className="badge bg-info">
                              Curso: {question.course_name} {question.course_grade ? `(${question.course_grade}° grado)` : ''}
                            </span>
                          )}
                          <button 
                            type="button" 
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleEditQuestion(question)}
                          >
                            <i className="fas fa-edit"></i> Editar
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setShowRawText(prev => ({
                              ...prev,
                              [question.id]: !prev[question.id]
                            }))}
                          >
                            <i className={`fas fa-${showRawText[question.id] ? 'eye' : 'code'}`}></i> {showRawText[question.id] ? 'Ver renderizado' : 'Ver código'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mb-3">
                      {/* Enunciado de la pregunta */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="flex-grow-1">
                          <h6 className="mb-2">
                            <strong>Enunciado:</strong>
                          </h6>
                          {showRawText[question.id] ? (
                            <pre className="mb-0"><code>{question.question_text}</code></pre>
                          ) : (
                            <div className="p-2 bg-white rounded border">
                              <MathJax>
                                <div dangerouslySetInnerHTML={{ 
                                  __html: (question.question_text || '')
                                    .replace(/\\text\{(.*?)\}/g, '$1')
                                    .replace(/\$(.*?)\$/g, '\\($1\\)') 
                                }} />
                              </MathJax>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Respuesta correcta */}
                      <div className="mb-3 p-2 bg-success bg-opacity-10 rounded border border-success">
                        <h6 className="mb-2 text-success">
                          <i className="fas fa-check-circle me-1"></i> Respuesta correcta:
                        </h6>
                        <div className="p-2 bg-white rounded">
                          <MathJax>
                            <div dangerouslySetInnerHTML={{ 
                              __html: (question[`option${question.correct_answer}`] || '')
                                .replace(/\\text\{(.*?)\}/g, '$1')
                                .replace(/\$(.*?)\$/g, '\\($1\\)') 
                            }} />
                          </MathJax>
                          <div className="text-muted small mt-1">
                            Opción {question.correct_answer}
                          </div>
                        </div>
                      </div>
                      
                      {/* Todas las opciones */}
                      <div className="mt-3">
                        <h6 className="small text-muted mb-2">
                          <i className="fas fa-list-ul me-1"></i> Todas las opciones:
                        </h6>
                        {[1, 2, 3, 4].map(optNum => {
                          const optionText = question[`option${optNum}`] || '';
                          if (!optionText) return null;
                          
                          const isCorrect = question.correct_answer === String(optNum);
                          
                          return (
                            <div 
                              key={optNum} 
                              className={`p-2 mb-2 rounded small ${isCorrect ? 'border border-success' : 'border'}`}
                            >
                              <div className="d-flex align-items-center">
                                <span className={`badge ${isCorrect ? 'bg-success' : 'bg-secondary'} me-2`}>
                                  {optNum}
                                </span>
                                {showRawText[question.id] ? (
                                  <code className="small">{optionText}</code>
                                ) : (
                                  <MathJax>
                                    <div className="small" dangerouslySetInnerHTML={{ 
                                      __html: optionText
                                        .replace(/\\text\{(.*?)\}/g, '$1')
                                        .replace(/\$(.*?)\$/g, '\\($1\\)')
                                    }} />
                                  </MathJax>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {question.image_url && (
                      <img 
                        src={question.image_url} 
                        alt="Imagen de la pregunta" 
                        className="img-thumbnail mt-2" 
                        style={{ maxHeight: '100px' }} 
                      />
                    )}
                    <div className="mt-2">
                      <div className={`badge ${question.correct_answer === '1' ? 'bg-success' : 'bg-secondary'} me-2`}>
                        1: {question.option1}
                      </div>
                      <div className={`badge ${question.correct_answer === '2' ? 'bg-success' : 'bg-secondary'} me-2`}>
                        2: {question.option2}
                      </div>
                      <div className={`badge ${question.correct_answer === '3' ? 'bg-success' : 'bg-secondary'} me-2`}>
                        3: {question.option3}
                      </div>
                      <div className={`badge ${question.correct_answer === '4' ? 'bg-success' : 'bg-secondary'} me-2`}>
                        4: {question.option4}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MathJaxContext>
  );
};

export default CreateQuestionPage;
