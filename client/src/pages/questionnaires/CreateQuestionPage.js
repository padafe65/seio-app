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
  
  const [loading, setLoading] = useState(true);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionOptions, setQuestionOptions] = useState({});
  
  const [currentQuestion, setCurrentQuestion] = useState({
    question_text: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correct_answer: '1',
    image: null
  });
  
  const [imagePreview, setImagePreview] = useState(null);
  const [showLatexGuide, setShowLatexGuide] = useState(false);
  
  useEffect(() => {
    const fetchQuestionnaireData = async () => {
      try {
        const response = await api.get(`/api/questionnaires/${id}`);
        console.log('Respuesta del backend:', response.data);
        
        if (!response.data.success) {
          throw new Error(response.data.message || 'Error al obtener el cuestionario');
        }
        
        const data = response.data.data;
        setQuestionnaire(data);
        
        // Procesar las preguntas y sus opciones
        const processedQuestions = data.questions.map(question => ({
          ...question,
          options: question.options ? question.options.split('|||') : []
        }));
        
        setQuestions(processedQuestions);
        setCurrentQuestion(prev => ({ 
          ...prev, 
          questionnaire_id: id,
          category: data.category 
        }));
        
      } catch (error) {
        console.error('Error al cargar cuestionario:', error);
        Swal.fire({ 
          icon: 'error', 
          title: 'Error', 
          text: error.message || 'Error al cargar el cuestionario'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionnaireData();
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
  
  const handleAddQuestion = async (e) => {
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
      
      const response = await api.post('/api/questions', formData, {
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
      
      // Limpiar el formulario
      setCurrentQuestion({
        question_text: '',
        option1: '',
        option2: '',
        option3: '',
        option4: '',
        correct_answer: '1',
        image: null
      });
      setImagePreview(null);
      
      Swal.fire({
        icon: 'success',
        title: 'Pregunta añadida',
        text: 'La pregunta ha sido añadida correctamente'
      });
    } catch (error) {
      console.error('Error al añadir pregunta:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al añadir la pregunta'
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
                <h5><strong>{questionnaire.title}</strong></h5>
                <p className="text-muted">{questionnaire.description}</p>
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
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">Añadir Nueva Pregunta</h5>
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
            <form onSubmit={handleAddQuestion}>
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
                <button 
                  type="button" 
                  className="btn btn-outline-secondary"
                  onClick={handleFinish}
                >
                  Finalizar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-success d-flex align-items-center gap-2"
                >
                  <Plus size={18} />
                  Añadir Pregunta
                </button>
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
                      <h5 className="mb-1">Pregunta {index + 1}</h5>
                      <button 
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeleteQuestion(question.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                    <MathJax>
                      <p className="mb-1" dangerouslySetInnerHTML={{ __html: question.question_text.replace(/\$(.*?)\$/g, '\\($1\\)') }} />
                    </MathJax>
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
