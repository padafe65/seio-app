// src/pages/questionnaires/QuestionnaireQuestions.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import { ArrowLeft, Save, Plus } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const QuestionnaireQuestions = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [questions, setQuestions] = useState([]);
  
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
        const response = await axios.get(`${API_URL}/api/questionnaires/${id}`);
        setQuestionnaire(response.data.questionnaire);
        setQuestions(response.data.questions);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar cuestionario:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar la información del cuestionario'
        });
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
      
      const response = await axios.post(`${API_URL}/api/questions/question`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
      await axios.delete(`${API_URL}/api/questions/${questionId}`);
      
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
        
        {questionnaire && (
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
                  <div>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline-success me-2"
                      onClick={() => setShowLatexGuide(!showLatexGuide)}
                    >
                      {showLatexGuide ? 'Ocultar guía LaTeX' : 'Ver guía y ejemplos'}
                    </button>
                  </div>
                </div>
                
                <div className="alert alert-info py-2 mb-2">
                  <small>
                    <strong>💡 Tips:</strong> 
                    <br />
                    • Escribe texto normal libremente. Presiona <kbd>Enter</kbd> para hacer saltos de línea.
                    <br />
                    • Para fórmulas matemáticas, rodéalas con símbolos de dólar: <code>$formula$</code>
                    <br />
                    <strong>Ejemplo:</strong> "Si el radio es $r = 5m$ y la velocidad es $v = 10m/s$, entonces..."
                  </small>
                </div>
                
                <textarea
                  id="question_text"
                  name="question_text"
                  value={currentQuestion.question_text}
                  onChange={handleQuestionChange}
                  className="form-control"
                  rows="8"
                  style={{ 
                    minHeight: '200px',
                    width: '100%',
                    resize: 'vertical', 
                    overflowY: 'auto',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                  required
                  placeholder="Ejemplo:&#10;Una piedra atada a una cuerda de longitud $L = 2.5m$ gira con frecuencia $f = 3Hz$.&#10;&#10;¿Cuál es su velocidad angular $\omega$?&#10;&#10;Presiona Enter para crear saltos de línea y organizar mejor tu pregunta."
                />
                {currentQuestion.question_text && (
                  <div 
                    className="mt-2 p-3 border rounded bg-light"
                    style={{
                      width: '100%',
                      overflowX: 'auto',
                      overflowY: 'auto',
                      maxWidth: '100%'
                    }}
                  >
                    <strong>📝 Vista previa (así se verá la pregunta):</strong>
                    <hr className="my-2" />
                    <MathJax>
                      <div 
                        style={{ 
                          fontSize: '1.05rem', 
                          lineHeight: '1.6'
                        }}
                        dangerouslySetInnerHTML={{ __html: currentQuestion.question_text.replace(/\$(.*?)\$/g, '\\($1\\)') }} 
                      />
                    </MathJax>
                  </div>
                )}
              </div>
              
              {/* Guía de LaTeX (colapsable) */}
              {showLatexGuide && (
                <div className="mb-3 p-4 border rounded" style={{ backgroundColor: '#f8f9fa' }}>
                  <h5 className="text-success mb-3">📚 Guía rápida: Cómo escribir preguntas con fórmulas</h5>
                  
                  <div className="alert alert-success mb-3">
                    <h6 className="mb-2">✅ Ejemplos de preguntas completas:</h6>
                    <div className="mb-3">
                      <strong>Ejemplo 1 (Física):</strong>
                      <div className="bg-white p-2 rounded mt-1 mb-2">
                        <code style={{ fontSize: '0.9rem' }}>
                          Un cuerpo se mueve con velocidad inicial $v_0 = 10m/s$ y aceleración $a = 2m/s^2$. Si el tiempo es $t = 5s$, ¿cuál es la velocidad final usando $v = v_0 + at$?
                        </code>
                      </div>
                      <div className="bg-light p-2 rounded border">
                        <MathJax>
                          <div dangerouslySetInnerHTML={{ __html: 'Un cuerpo se mueve con velocidad inicial \\(v_0 = 10m/s\\) y aceleración \\(a = 2m/s^2\\). Si el tiempo es \\(t = 5s\\), ¿cuál es la velocidad final usando \\(v = v_0 + at\\)?' }} />
                        </MathJax>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <strong>Ejemplo 2 (Matemáticas):</strong>
                      <div className="bg-white p-2 rounded mt-1 mb-2">
                        <code style={{ fontSize: '0.9rem' }}>
                          {`Resuelve la ecuación cuadrática $x^2 - 5x + 6 = 0$ usando la fórmula $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$`}
                        </code>
                      </div>
                      <div className="bg-light p-2 rounded border">
                        <MathJax>
                          <div dangerouslySetInnerHTML={{ __html: 'Resuelve la ecuación cuadrática \\(x^2 - 5x + 6 = 0\\) usando la fórmula \\(x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\)' }} />
                        </MathJax>
                      </div>
                    </div>
                  </div>
                  
                  <h6 className="mt-4 mb-2">📝 Símbolos matemáticos más usados:</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th>Qué necesitas</th>
                          <th>Escribe esto</th>
                          <th>Se verá así</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latexExamples.map((example, index) => (
                          <tr key={index}>
                            <td>{example.description}</td>
                            <td><code className="text-primary">${example.ejemplo}$</code></td>
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
                  
                  <div className="alert alert-warning mt-3 mb-0">
                    <strong>⚠️ Importante:</strong> Solo usa los símbolos <code>$...$</code> alrededor de las fórmulas matemáticas. El resto del texto escríbelo normalmente.
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

export default QuestionnaireQuestions;
