// pages/CreateQuestionPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ArrowLeft } from 'lucide-react';
// Importaciones para KaTeX
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const CreateQuestionPage = () => {
  const { id: questionnaireIdFromUrl } = useParams();
  const navigate = useNavigate();
  
  const initialFormState = {
    questionnaire_id: questionnaireIdFromUrl || '',
    question_text: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correct_answer: '',
    category: '',
    image: null,
    image_url: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [preview, setPreview] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [currentQuestionnaire, setCurrentQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(true);
  // Estado para previsualizar expresiones matemáticas
  const [mathPreview, setMathPreview] = useState({
    question_text: false,
    option1: false,
    option2: false,
    option3: false,
    option4: false
  });
  
  // Estado para controlar la vista de las preguntas (latex o texto)
  const [viewMode, setViewMode] = useState('latex'); // 'latex' o 'text'

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Si hay un ID de cuestionario en la URL, carga solo las preguntas de ese cuestionario
        if (questionnaireIdFromUrl) {
          setFormData(prev => ({
            ...prev,
            questionnaire_id: questionnaireIdFromUrl
          }));
          
          // Cargar detalles del cuestionario y sus preguntas en una sola petición
          const questionnaireResponse = await axios.get(`${API_URL}/api/questionnaires/${questionnaireIdFromUrl}`);
          console.log("Cuestionario create:", questionnaireResponse.data);
          
          // Verificar si el cuestionario existe
          if (!questionnaireResponse.data.data) {
            throw new Error('Cuestionario no encontrado');
          }
          
          // Establecer el cuestionario actual
          const data = questionnaireResponse.data.data;
          setCurrentQuestionnaire(data);
          
          // IMPORTANTE: Establecer la categoría del cuestionario en el estado del formulario
          setFormData(prev => ({
            ...prev,
            category: data.category
          }));
          
          // Usar las preguntas que vienen en la respuesta del cuestionario
          setQuestions(data.questions);
        } else {
          // Si no hay ID, carga todos los cuestionarios y preguntas como antes
          fetchQuestions();
          fetchQuestionnaires();
        }
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, [questionnaireIdFromUrl]);

  const fetchQuestions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/questions`);
      setQuestions(res.data);
    } catch (err) {
      console.error('Error cargando preguntas:', err.message);
    }
  };

  const fetchQuestionnaires = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/questionnaires`);
      setQuestionnaires(res.data);
    } catch (err) {
      console.error('Error cargando cuestionarios:', err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      const file = files[0];
      setFormData({ ...formData, image: file });
      setPreview(file ? URL.createObjectURL(file) : null);
    } else {
      setFormData({ ...formData, [name]: value });
      
      // Si cambia el cuestionario, actualizar la categoría automáticamente
      if (name === 'questionnaire_id' && value) {
        const selectedQuestionnaire = questionnaires.find(q => q.id === parseInt(value) || q.id === value);
        if (selectedQuestionnaire) {
          setFormData(prev => ({
            ...prev,
            category: selectedQuestionnaire.category,
            [name]: value
          }));
        }
      }
    }
  };

  // Función para alternar entre vista normal y matemática
  const toggleMathPreview = (field) => {
    setMathPreview(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Función para detectar si un texto contiene expresiones LaTeX
  const containsLatex = (text) => {
    return text && (text.includes('\\') || text.includes('{') || text.includes('}'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();

    for (let key in formData) {
      if (formData[key]) {
        data.append(key, formData[key]);
      }
    }

    // Si no se seleccionó una nueva imagen, mantener la existente
    if (editingId && !formData.image && preview) {
      data.append('image_url', preview.replace(`${API_URL}`, ''));
    }

    try {
      const successMessage = editingId ? 'Pregunta actualizada' : 'Pregunta creada';

      if (editingId) {
        await axios.put(`${API_URL}/api/questions/${editingId}`, data);
      } else {
        await axios.post(`${API_URL}/api/questions`, data);
      }

      Swal.fire(successMessage, '', 'success').then(() => {
        // Si estamos en la página de un cuestionario específico, volvemos a la lista de cuestionarios.
        // Si no, simplemente reseteamos el formulario para poder crear otra pregunta de otro cuestionario.
        if (questionnaireIdFromUrl) {
          navigate('/cuestionarios');
        } else {
          resetForm();
          fetchQuestions(); // Recargar la lista general si aplica
        }
      });
    } catch (error) {
      console.error(error);
      Swal.fire('Error al guardar la pregunta', '', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      ...initialFormState,
      questionnaire_id: questionnaireIdFromUrl || ''
    });
    setPreview(null);
    setEditingId(null);
    // Resetear también la vista previa matemática
    setMathPreview({
      question_text: false,
      option1: false,
      option2: false,
      option3: false,
      option4: false
    });
  };

  const handleEdit = (question) => {
    setEditingId(question.id);
    setFormData({
      questionnaire_id: question.questionnaire_id,
      question_text: question.question_text,
      option1: question.option1,
      option2: question.option2,
      option3: question.option3,
      option4: question.option4,
      correct_answer: question.correct_answer,
      category: question.category,
      image: null,
      image_url: question.image_url || ''
    });
    setPreview(question.image_url ? `${API_URL}${question.image_url}` : null);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción no se puede deshacer",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await axios.delete(`${API_URL}/api/questions/${id}`);
        Swal.fire('Eliminada', 'La pregunta ha sido eliminada', 'success');
        
        if (questionnaireIdFromUrl) {
          // Recargar solo las preguntas del cuestionario actual
          const questionsResponse = await axios.get(`${API_URL}/api/questions?questionnaire_id=${questionnaireIdFromUrl}`);
          setQuestions(questionsResponse.data);
        } else {
          fetchQuestions();
        }
      } catch (error) {
        console.error('Error al eliminar:', error);
        Swal.fire('Error', 'No se pudo eliminar la pregunta', 'error');
      }
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

  return (
    <div className="container mt-4">
      {questionnaireIdFromUrl && currentQuestionnaire && (
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <Link to="/cuestionarios" className="btn btn-outline-secondary">
                <ArrowLeft size={18} className="me-1" /> Volver a Cuestionarios
              </Link>
            </div>
            <h2 className="mb-0">Gestión de Preguntas</h2>
            <div className="btn-group">
              <button 
                type="button" 
                className={`btn ${viewMode === 'text' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('text')}
              >
                Vista de Texto
              </button>
              <button 
                type="button" 
                className={`btn ${viewMode === 'latex' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('latex')}
              >
                Vista LaTeX
              </button>
            </div>
          </div>
          
          <div className="card mb-4">
            <div className="card-header bg-light">
              <h4 className="card-title mb-0">{currentQuestionnaire.title}</h4>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-3">
                  <p className="mb-1"><strong>Categoría:</strong></p>
                  <p className="bg-light p-2 rounded">{currentQuestionnaire.category.replace('_', ' - ')}</p>
                </div>
                <div className="col-md-2">
                  <p className="mb-1"><strong>Grado:</strong></p>
                  <p className="bg-light p-2 rounded">{currentQuestionnaire.grade}°</p>
                </div>
                <div className="col-md-2">
                  <p className="mb-1"><strong>Fase:</strong></p>
                  <p className="bg-light p-2 rounded">{currentQuestionnaire.phase}</p>
                </div>
                <div className="col-md-5">
                  <p className="mb-1"><strong>Curso:</strong></p>
                  <p className="bg-light p-2 rounded">{currentQuestionnaire.course_name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <h4 className="card-title mb-4">{editingId ? 'Editar Pregunta' : 'Crear Nueva Pregunta'}</h4>

          <form onSubmit={handleSubmit} encType="multipart/form-data">
            <div className="mb-3">
              <label className="form-label">Cuestionario</label>
              <select
                className="form-select"
                name="questionnaire_id"
                value={formData.questionnaire_id}
                onChange={handleChange}
                required
                disabled={!!questionnaireIdFromUrl}
              >
                <option value="">Seleccione un cuestionario</option>
                {questionnaires.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} - {q.category.replace('_', ' - ')} (Grado {q.grade}, Fase {q.phase})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label">
                Texto de la pregunta
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary ms-2"
                  onClick={() => toggleMathPreview('question_text')}
                >
                  {mathPreview.question_text ? 'Editar' : 'Ver como fórmula'}
                </button>
              </label>
              
              {mathPreview.question_text ? (
                <div className="border rounded p-3 bg-light">
                  <BlockMath math={formData.question_text || ''} />
                </div>
              ) : (
                <textarea
                  className="form-control"
                  name="question_text"
                  value={formData.question_text}
                  onChange={handleChange}
                  required
                  rows={3}
                  placeholder="Usa sintaxis LaTeX para expresiones matemáticas. Ej: \frac{1}{2} para fracciones"
                />
              )}
              
              <small className="form-text text-muted">
                Para fracciones usa \frac{'n'}{'d'}, para raíces \sqrt{'x'}, para potencias x^{'n'}
              </small>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label">Imagen (opcional)</label>
                <input
                  type="file"
                  className="form-control"
                  name="image"
                  accept="image/*"
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6 d-flex align-items-end">
                {preview && (
                  <img
                    src={preview}
                    alt="Preview"
                    className="img-fluid border rounded"
                    style={{ maxHeight: '200px' }}
                  />
                )}
              </div>
            </div>

            <div className="row g-3 mb-3">
              {[1, 2, 3, 4].map((i) => (
                <div className="col-md-6 mb-3" key={i}>
                  <label className="form-label">
                    Opción {i}
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline-secondary ms-2"
                      onClick={() => toggleMathPreview(`option${i}`)}
                    >
                      {mathPreview[`option${i}`] ? 'Editar' : 'Ver como fórmula'}
                    </button>
                  </label>
                  
                  {mathPreview[`option${i}`] ? (
                    <div className="border rounded p-3 bg-light">
                      <InlineMath math={formData[`option${i}`] || ''} />
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="form-control"
                      name={`option${i}`}
                      value={formData[`option${i}`]}
                      onChange={handleChange}
                      required
                      placeholder="Usa sintaxis LaTeX para expresiones matemáticas"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label">Respuesta Correcta</label>
                <select
                  className="form-select"
                  name="correct_answer"
                  value={formData.correct_answer}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccione una opción</option>
                  {[1, 2, 3, 4].map((i) => (
                    <option key={i} value={i}>
                      Opción {i}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="col-md-6">
                <label className="form-label">Categoría</label>
                <input
                  type="text"
                  className="form-control"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  readOnly={!!formData.questionnaire_id}
                />
              </div>
            </div>

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Actualizar Pregunta' : 'Guardar Pregunta'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h4 className="card-title mb-4">Preguntas Existentes</h4>
          
          {questions.length === 0 ? (
            <div className="alert alert-info">
              No hay preguntas registradas {questionnaireIdFromUrl ? 'para este cuestionario' : ''}.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover">
                <thead className="table-light">
                  <tr>
                    <th style={{width: '5%'}}>ID</th>
                    <th style={{width: '30%'}}>Pregunta</th>
                    <th style={{width: '35%'}}>Opciones de Respuesta</th>
                    <th style={{width: '5%'}}>Resp.</th>
                    {!questionnaireIdFromUrl && <th style={{width: '10%'}}>Cuestionario</th>}
                    <th style={{width: '10%'}}>Imagen</th>
                    <th style={{width: '15%'}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => {
                    const hasLatexInQuestion = containsLatex(q.question_text);
                    return (
                      <tr key={q.id}>
                        <td className="align-middle">{q.id}</td>
                        <td className="align-middle">
                          <div className="d-flex flex-column">
                            {viewMode === 'latex' && hasLatexInQuestion ? (
                              <div className="border rounded p-2 bg-light mb-2">
                                <BlockMath math={q.question_text} />
                              </div>
                            ) : (
                              <div className="p-2">
                                {q.question_text}
                              </div>
                            )}
                            {hasLatexInQuestion && (
                              <small className="text-muted">
                                <button 
                                  className="btn btn-sm btn-link p-0"
                                  onClick={() => setViewMode(viewMode === 'latex' ? 'text' : 'latex')}
                                >
                                  {viewMode === 'latex' ? 'Ver en texto plano' : 'Ver en LaTeX'}
                                </button>
                              </small>
                            )}
                          </div>
                        </td>
                        <td className="align-middle">
                          <ol className="mb-0 ps-3">
                            {[1, 2, 3, 4].map((n) => {
                              const option = q[`option${n}`];
                              const hasLatex = containsLatex(option);
                              return (
                                <li key={n} className="mb-2">
                                  <div className="d-flex flex-column">
                                    {viewMode === 'latex' && hasLatex ? (
                                      <div className="border rounded p-2 bg-light">
                                        <InlineMath math={option} />
                                      </div>
                                    ) : (
                                      <div className="p-1">{option}</div>
                                    )}
                                    {hasLatex && (
                                      <small className="text-muted">
                                        <button 
                                          className="btn btn-sm btn-link p-0"
                                          onClick={() => setViewMode(viewMode === 'latex' ? 'text' : 'latex')}
                                        >
                                          {viewMode === 'latex' ? 'Ver en texto' : 'Ver en LaTeX'}
                                        </button>
                                      </small>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        </td>
                      <td className="text-center">{q.correct_answer}</td>
                      {!questionnaireIdFromUrl && (
                        <td>
                          {questionnaires.find(quest => quest.id === parseInt(q.questionnaire_id))?.title || q.questionnaire_id}
                        </td>
                      )}
                      <td className="text-center">
                        {q.image_url ? (
                          <img
                            src={`${API_URL}${q.image_url}`}
                            alt="Pregunta"
                            style={{ width: '100px' }}
                            className="img-thumbnail"
                          />
                        ) : (
                          <span className="text-muted">Sin imagen</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-center gap-2">
                          <button onClick={() => handleEdit(q)} className="btn btn-warning btn-sm">
                            Editar
                          </button>
                          <button onClick={() => handleDelete(q.id)} className="btn btn-danger btn-sm">
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Guía rápida de LaTeX */}
      <div className="card mt-4">
        <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Guía Rápida de LaTeX para Matemáticas</h5>
          <button 
            className="btn btn-sm btn-light" 
            onClick={() => setViewMode(viewMode === 'latex' ? 'text' : 'latex')}
          >
            {viewMode === 'latex' ? 'Cambiar a vista de texto' : 'Cambiar a vista LaTeX'}
          </button>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-4">
              <h6>Fracciones</h6>
              <p><code>{'\\frac{numerador}{denominador}'}</code> → <InlineMath math="\frac{1}{2}" /></p>
              
              <h6>Potencias</h6>
              <p><code>{'x^{2}'}</code> → <InlineMath math="x^{2}" /></p>
            </div>
            <div className="col-md-4">
              <h6>Raíces</h6>
              <p><code>{'\\sqrt{x}'}</code> → <InlineMath math="\sqrt{x}" /></p>
              
              <h6>Números mixtos</h6>
              <p><code>{'2\\frac{3}{4}'}</code> → <InlineMath math="2\frac{3}{4}" /></p>
            </div>
            <div className="col-md-4">
              <h6>Operadores</h6>
              <p><code>{'\\times'}</code> → <InlineMath math="\times" /></p>
              <p><code>{'\\div'}</code> → <InlineMath math="\div" /></p>
              <p><code>{'\\pm'}</code> → <InlineMath math="\pm" /></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateQuestionPage;
