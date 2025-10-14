// src/components/EditarPregunta.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { ArrowLeft } from 'lucide-react';
// Importaciones para KaTeX
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const EditarPreguntas = () => {
  const { id } = useParams(); // Obtiene el ID de la pregunta desde la URL
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [preview, setPreview] = useState(null);
  
  const [formData, setFormData] = useState({
    question_text: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correct_answer: '1',
    questionnaire_id: '',
    category: '',
    image: null,
    image_url: ''
  });

  // Estado para previsualizar expresiones matemáticas
  const [mathPreview, setMathPreview] = useState({
    question_text: false,
    option1: false,
    option2: false,
    option3: false,
    option4: false
  });

  // Cargar cuestionarios disponibles
  useEffect(() => {
    const fetchQuestionnaires = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const config = {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };
        const res = await axios.get(`${API_URL}/api/questionnaires`, config);
        setQuestionnaires(res.data);
      } catch (err) {
        console.error('Error cargando cuestionarios:', err.message);
        setError('Error al cargar los cuestionarios');
      }
    };

    fetchQuestionnaires();
  }, []);

  // Cargar datos de la pregunta específica
  // En el useEffect que carga los datos de la pregunta
useEffect(() => {
  const fetchQuestionData = async () => {
    if (id) {
      setLoading(true);
      try {
        console.log(`Cargando pregunta con ID: ${id}`);
        const token = localStorage.getItem('authToken');
        const config = {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };
        const response = await axios.get(`${API_URL}/api/questions/question/${id}`, config);
        const questionData = response.data.data || response.data;
        
        setFormData({
          question_text: questionData.question_text || '',
          option1: questionData.option1 || '',
          option2: questionData.option2 || '',
          option3: questionData.option3 || '',
          option4: questionData.option4 || '',
          correct_answer: String(questionData.correct_answer) || '1',
          questionnaire_id: questionData.questionnaire_id || '',
          category: questionData.category || '',
          image: null,
          image_url: questionData.image_url || ''
        });
        
        if (questionData.image_url) {
          setPreview(questionData.image_url ? `${API_URL}${questionData.image_url}` : null);
          console.log('Imagen cargada:', API_URL+questionData.image_url);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar datos de la pregunta:', error);
        setError('Error al cargar los datos de la pregunta');
        setLoading(false);
      }
    }
  };

  fetchQuestionData();
}, [id]);


  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      const file = files[0];
      setFormData(prev => ({ ...prev, image: file }));
      setPreview(file ? URL.createObjectURL(file) : null);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      
      // Si cambia el cuestionario, actualizar la categoría automáticamente
      if (name === 'questionnaire_id' && value) {
        const selectedQuestionnaire = questionnaires.find(q => q.id === parseInt(value) || q.id === value);
        if (selectedQuestionnaire) {
          setFormData(prev => ({
            ...prev,
            category: selectedQuestionnaire.category
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const data = new FormData();

    // Añadir todos los campos al FormData
    Object.keys(formData).forEach(key => {
      if (key !== 'image' && formData[key]) {
        data.append(key, formData[key]);
      }
    });
    
    // Añadir la imagen si existe
    if (formData.image) {
      data.append('image', formData.image);
    }
    
    // Si no se seleccionó una nueva imagen, mantener la existente
    if (!formData.image && preview) {
      data.append('image_url', preview.replace(`${API_URL}`, ''));
    }

    try {
      // Obtener token de autenticación
      const token = localStorage.getItem('authToken');
      
      // Actualizar pregunta
      await axios.put(`${API_URL}/api/questions/${id}`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      Swal.fire('Pregunta actualizada', '', 'success');
      
      // Redirigir a la lista de preguntas
      navigate('/dashboard');
    } catch (error) {
      console.error('Error al actualizar la pregunta:', error);
      Swal.fire('Error al actualizar la pregunta', '', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        {error}
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Editar Pregunta</h5>
          <button
            type="button"
            className="btn btn-light btn-sm"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={16} className="me-1" /> Volver
          </button>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} encType="multipart/form-data">
            <div className="mb-3">
              <label className="form-label">Cuestionario</label>
              <select
                className="form-select"
                name="questionnaire_id"
                value={formData.questionnaire_id}
                onChange={handleChange}
                required
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

            <div className="mb-3">
              <label htmlFor="image" className="form-label">Imagen (opcional)</label>
              <input
                type="file"
                className="form-control"
                id="image"
                name="image"
                onChange={handleChange}
                accept="image/*"
              />
              {preview && (
                <div className="mt-2">
                  <img 
                    src={preview} 
                    alt="Vista previa" 
                    className="img-thumbnail" 
                    style={{ maxHeight: '200px' }} 
                  />
                </div>
              )}
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
                  required
                />
              </div>
            </div>
            
            <div className="d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard')}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Actualizar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditarPreguntas;
