// pages/CreateQuestionPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from '../api/axiosClient';
import Swal from 'sweetalert2';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
// Importaciones para KaTeX
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { MathJax, MathJaxContext } from 'better-react-mathjax';

// Estilos para las expresiones matemáticas
const styles = {
  mathPreview: {
    overflowX: 'auto',
    maxWidth: '100%',
    padding: '0.5rem 0',
    '& .katex': {
      fontSize: '1.1em',
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    '& .katex-display > .katex': {
      display: 'inline-block',
      textAlign: 'left',
      width: '100%'
    }
  }
};

// URL base para las imágenes (solo para vistas previas)
const IMAGE_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CreateQuestionPage = () => {
  const { id: questionnaireIdFromUrl } = useParams();
  // Se mantiene useNavigate importado para futuras implementaciones
  // const navigate = useNavigate();
  const { user } = useAuth();

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
          const questionnaireResponse = await axios.get(`/questionnaires/${questionnaireIdFromUrl}`);
          console.log("Cuestionario create:", questionnaireResponse.data);
          
          // Establecer el cuestionario actual
          setCurrentQuestionnaire(questionnaireResponse.data.questionnaire);
          
          // IMPORTANTE: Establecer la categoría del cuestionario en el estado del formulario
          setFormData(prev => ({
            ...prev,
            category: questionnaireResponse.data.questionnaire.category
          }));
          
          // Usar las preguntas que vienen en la respuesta del cuestionario
          setQuestions(questionnaireResponse.data.questions);
        } else {
          // Si no hay ID, carga todos los cuestionarios y preguntas como antes
          // Esperar a que el usuario esté disponible antes de cargar cuestionarios
          if (user && user.id) {
            fetchQuestions();
            fetchQuestionnaires();
          } else {
            console.log('⏳ Esperando a que el usuario esté disponible...');
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, [questionnaireIdFromUrl, user]);

  const fetchQuestions = async () => {
    try {
      // Obtener el user_id del usuario autenticado
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        console.error('No hay usuario autenticado');
        return;
      }
      
      const user = JSON.parse(userStr);
      const userId = user.id;
      
      // Obtener solo las preguntas del docente actual
      const res = await axios.get(`/teacher/questions/${userId}`);
      setQuestions(res.data);
    } catch (err) {
      console.error('Error cargando preguntas:', err.message);
    }
  };

  // Función para cargar preguntas por ID de cuestionario
  const fetchQuestionsByQuestionnaire = async (questionnaireId) => {
    try {
      if (!questionnaireId) {
        // Si no hay ID, cargar todas las preguntas del docente
        fetchQuestions();
        return;
      }
      
      // Cargar solo las preguntas del cuestionario seleccionado
      const questionsResponse = await axios.get(`/questions?questionnaire_id=${questionnaireId}`);
      setQuestions(questionsResponse.data);
    } catch (err) {
      console.error('Error cargando preguntas del cuestionario:', err.message);
      // En caso de error, intentar cargar todas las preguntas
      fetchQuestions();
    }
  };

  const fetchQuestionnaires = async () => {
    try {
      // Obtener el user_id del usuario autenticado
      if (!user || !user.id) {
        console.error('No hay usuario autenticado');
        return;
      }
      
      const userId = user.id;
      const userRole = user.role;
      console.log('🔍 Cargando cuestionarios para el usuario:', userId, 'Rol:', userRole);
      
      // Usar axiosClient que ya tiene el baseURL configurado con /api
      // Para super_administrador: cargar todos los cuestionarios
      // Para docente: cargar solo los suyos (el backend filtra automáticamente)
      // No necesitamos pasar created_by porque el backend lo detecta del token
      const res = await axios.get('/questionnaires');
      
      console.log('📋 Respuesta del servidor:', res.data);
      
      // El endpoint puede devolver un array directo o un objeto con data
      let questionnairesData = [];
      
      if (Array.isArray(res.data)) {
        questionnairesData = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        questionnairesData = res.data.data;
      } else if (res.data && res.data.success && Array.isArray(res.data.data)) {
        questionnairesData = res.data.data;
      } else {
        console.warn('⚠️ Formato de respuesta inesperado:', res.data);
        questionnairesData = [];
      }
      
      setQuestionnaires(questionnairesData);
      console.log(`✅ Se cargaron ${questionnairesData.length} cuestionarios ${userRole === 'super_administrador' ? '(todos)' : '(del profesor)'}`);
      
      if (questionnairesData.length === 0) {
        console.warn('⚠️ No se encontraron cuestionarios');
      }
      
    } catch (err) {
      console.error('❌ Error cargando cuestionarios:', err);
      console.error('Detalles del error:', err.response?.data || err.message);
      setQuestionnaires([]);
    }
  };

  const handleChange = async (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      const file = files[0];
      setFormData({ ...formData, image: file });
      setPreview(file ? URL.createObjectURL(file) : null);
    } else {
      setFormData({ ...formData, [name]: value });
      
      // Si cambia el cuestionario, actualizar la categoría y cargar las preguntas del cuestionario
      if (name === 'questionnaire_id') {
        const selectedQuestionnaire = questionnaires.find(q => q.id === parseInt(value) || q.id === value);
        if (selectedQuestionnaire) {
          setFormData(prev => ({
            ...prev,
            category: selectedQuestionnaire.category,
            [name]: value
          }));
          // Cargar solo las preguntas del cuestionario seleccionado
          await fetchQuestionsByQuestionnaire(value);
        } else if (!value) {
          // Si se deselecciona el cuestionario, cargar todas las preguntas del docente
          fetchQuestions();
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
      data.append('image_url', preview.replace(/^https?:\/\/[^/]+/, ''));
    }

    try {
      if (editingId) {
        await axios.put(`/questions/${editingId}`, data, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        Swal.fire('Pregunta actualizada', '', 'success');
      } else {
await axios.post(`/questions/question`, data, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        Swal.fire('Pregunta creada', '', 'success');
      }
      resetForm();
      
      // Recargar las preguntas según el contexto
      const currentQuestionnaireId = questionnaireIdFromUrl || formData.questionnaire_id;
      if (currentQuestionnaireId) {
        // Recargar solo las preguntas del cuestionario actual
        const questionsResponse = await axios.get(`/questions?questionnaire_id=${currentQuestionnaireId}`);
        setQuestions(questionsResponse.data);
      } else {
        // Si no hay cuestionario seleccionado, cargar todas las preguntas del docente
        fetchQuestions();
      }
    } catch (error) {
      console.error(error);
      Swal.fire('Error al guardar la pregunta', '', 'error');
    }
  };

  const resetForm = () => {
    // Mantener el questionnaire_id si hay uno seleccionado (ya sea de URL o del combo)
    const currentQuestionnaireId = questionnaireIdFromUrl || formData.questionnaire_id || '';
    
    setFormData({
      ...initialFormState,
      questionnaire_id: currentQuestionnaireId,
      // Mantener la categoría si hay cuestionario seleccionado
      category: currentQuestionnaireId && questionnaires.find(q => q.id === parseInt(currentQuestionnaireId) || q.id === currentQuestionnaireId)?.category || ''
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
    setPreview(question.image_url ? question.image_url.startsWith('http') ? question.image_url : `${IMAGE_BASE_URL}${question.image_url}` : null);
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
        await axios.delete(`/questions/${id}`);
        Swal.fire('Eliminada', 'La pregunta ha sido eliminada', 'success');
        
        // Recargar las preguntas según el contexto
        const currentQuestionnaireId = questionnaireIdFromUrl || formData.questionnaire_id;
        if (currentQuestionnaireId) {
          // Recargar solo las preguntas del cuestionario actual
          const questionsResponse = await axios.get(`/questions?questionnaire_id=${currentQuestionnaireId}`);
          setQuestions(questionsResponse.data);
        } else {
          // Si no hay cuestionario seleccionado, cargar todas las preguntas del docente
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
    <MathJaxContext>
    <div className="container mt-4">
      {questionnaireIdFromUrl && currentQuestionnaire && (
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Link to="/cuestionarios" className="btn btn-outline-secondary">
              <ArrowLeft size={18} className="me-1" /> Volver a Cuestionarios
            </Link>
            <h2 className="mb-0">Gestión de Preguntas</h2>
          </div>
          
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">{currentQuestionnaire.title}</h5>
              <div className="row mt-3">
                <div className="col-md-3">
                  <p><strong>Categoría:</strong> {currentQuestionnaire.category.replace('_', ' - ')}</p>
                </div>
                <div className="col-md-3">
                  <p><strong>Grado:</strong> {currentQuestionnaire.grade}°</p>
                </div>
                <div className="col-md-3">
                  <p><strong>Fase:</strong> {currentQuestionnaire.phase}</p>
                </div>
                <div className="col-md-3">
                  <p><strong>Curso:</strong> {currentQuestionnaire.course_name}</p>
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
              
              <div className="alert alert-info py-2 mb-2">
                <small>
                  <strong>💡 Tips:</strong>
                  <br />
                  • Escribe texto normal libremente. Presiona <kbd>Enter</kbd> para hacer saltos de línea.
                  <br />
                  • Para fórmulas matemáticas, rodéalas con símbolos de dólar: <code>$formula$</code>
                  <br />
                  <strong>Ejemplo:</strong> {`"Si el radio es $r = 5m$ y la velocidad es $v = 10m/s$, entonces la aceleración centrípeta es $a_c = \\frac{v^2}{r}$"`}
                </small>
              </div>
              
              {mathPreview.question_text ? (
                <div 
                  className="border rounded p-3 bg-light" 
                  style={{
                    minHeight: '200px',
                    width: '100%',
                    overflowY: 'auto',
                    overflowX: 'auto',
                    maxWidth: '100%',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  <strong>📝 Vista previa:</strong>
                  <hr className="my-2" />
                  <MathJax>
                    <div 
                      style={{ 
                        fontSize: '1.05rem', 
                        lineHeight: '1.6'
                      }}
                      dangerouslySetInnerHTML={{ 
                        __html: formData.question_text.replace(/\$(.*?)\$/g, '\\($1\\)') 
                      }} 
                    />
                  </MathJax>
                </div>
              ) : (
                <textarea
                  className="form-control"
                  name="question_text"
                  value={formData.question_text}
                  onChange={handleChange}
                  required
                  rows={8}
                  style={{ 
                    minHeight: '200px',
                    width: '100%',
                    resize: 'vertical', 
                    overflowY: 'auto',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                  placeholder="Ejemplo:&#10;Una piedra atada a una cuerda de longitud $L = 2.5m$ gira con frecuencia $f = 3Hz$.&#10;&#10;¿Cuál es su velocidad angular $\omega = 2\pi f$?&#10;&#10;Presiona Enter para crear saltos de línea y organizar mejor tu pregunta."
                />
              )}
              
              <small className="form-text text-muted">
                <strong>Fórmulas comunes:</strong> Fracciones: <code>{`$\\frac{a}{b}$`}</code> | Raíces: <code>{`$\\sqrt{x}$`}</code> | Potencias: <code>$x^2$</code> | Subíndices: <code>$v_0$</code>
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
              No hay preguntas registradas {questionnaireIdFromUrl || formData.questionnaire_id ? 'para este cuestionario' : ''}.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Texto</th>
                    <th>Opciones</th>
                    <th>Respuesta</th>
                    {!questionnaireIdFromUrl && !formData.questionnaire_id && <th>Cuestionario</th>}
                    <th>Imagen</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id}>
                      <td>{q.id}</td>
                      <td>
                        {q.question_text ? (
                          <div 
                            className="math-preview"
                            style={{
                              maxWidth: '400px',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }}
                          >
                            <MathJax hideUntilTypeset="first">
                              {q.question_text.replace(/\$(.*?)\$/g, '\\($1\\)')}
                            </MathJax>
                          </div>
                        ) : (
                          <span className="text-muted">Sin texto</span>
                        )}
                      </td>
                      <td>
                        <ol className="mb-0 ps-3">
                          {[1, 2, 3, 4].map((n) => (
                            <li key={n}>
                              {q[`option${n}`] ? (
                                <div className="math-preview">
                                  <MathJax hideUntilTypeset="first">
                                    {q[`option${n}`].replace(/\$(.*?)\$/g, '\\($1\\)')}
                                  </MathJax>
                                </div>
                              ) : (
                                <span className="text-muted">Sin opción {n}</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </td>
                      <td className="text-center">{q.correct_answer}</td>
                      {!questionnaireIdFromUrl && !formData.questionnaire_id && (
                        <td>
                          {questionnaires.find(quest => quest.id === parseInt(q.questionnaire_id))?.title || q.questionnaire_id}
                        </td>
                      )}
                      <td className="text-center">
                        {q.image_url ? (
                          <img
                            src={q.image_url.startsWith('http') ? q.image_url : `${IMAGE_BASE_URL}${q.image_url}`}
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
        <div className="card-header bg-info text-white">
          <h5 className="mb-0">Guía Rápida de LaTeX para Matemáticas</h5>
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
    </MathJaxContext>
  );
};

export default CreateQuestionPage;
