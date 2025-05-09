import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ArrowLeft } from 'lucide-react';

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

  useEffect(() => {
    fetchQuestionnaires();
    
    if (questionnaireIdFromUrl) {
      setFormData(prev => ({
        ...prev,
        questionnaire_id: questionnaireIdFromUrl
      }));
      
      // Cargar solo las preguntas del cuestionario seleccionado
      fetchQuestionsByQuestionnaire(questionnaireIdFromUrl);
      
      // Obtener detalles del cuestionario actual
      fetchQuestionnaireDetails(questionnaireIdFromUrl);
    } else {
      fetchQuestions();
      setLoading(false);
    }
  }, [questionnaireIdFromUrl]);

  const fetchQuestionnaireDetails = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/api/questionnaires/${id}`);
      setCurrentQuestionnaire(res.data.questionnaire);
      setLoading(false);
    } catch (err) {
      console.error('Error cargando detalles del cuestionario:', err.message);
      setLoading(false);
    }
  };

  const fetchQuestionsByQuestionnaire = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/api/questions?questionnaire_id=${id}`);
      setQuestions(res.data);
    } catch (err) {
      console.error('Error cargando preguntas del cuestionario:', err.message);
    }
  };

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
      if (editingId) {
        await axios.put(`${API_URL}/api/questions/${editingId}`, data);
        Swal.fire('Pregunta actualizada', '', 'success');
      } else {
        await axios.post(`${API_URL}/api/questions`, data);
        Swal.fire('Pregunta creada', '', 'success');
      }
      resetForm();
      
      if (questionnaireIdFromUrl) {
        fetchQuestionsByQuestionnaire(questionnaireIdFromUrl);
      } else {
        fetchQuestions();
      }
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
          fetchQuestionsByQuestionnaire(questionnaireIdFromUrl);
        } else {
          fetchQuestions();
        }
      } catch (error) {
        console.error('Error al eliminar:', error);
        Swal.fire('Error', 'No se pudo eliminar la pregunta', 'error');
      }
    }
  };

  if (loading && questionnaireIdFromUrl) {
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
              <label className="form-label">Texto de la pregunta</label>
              <textarea
                className="form-control"
                name="question_text"
                value={formData.question_text}
                onChange={handleChange}
                required
                rows={3}
              />
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
                  <label className="form-label">Opción {i}</label>
                  <input
                    type="text"
                    className="form-control"
                    name={`option${i}`}
                    value={formData[`option${i}`]}
                    onChange={handleChange}
                    required
                  />
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
                    <th>ID</th>
                    <th>Texto</th>
                    <th>Opciones</th>
                    <th>Respuesta</th>
                    {!questionnaireIdFromUrl && <th>Cuestionario</th>}
                    <th>Imagen</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id}>
                      <td>{q.id}</td>
                      <td>{q.question_text}</td>
                      <td>
                        <ol className="mb-0 ps-3">
                          <li>{q.option1}</li>
                          <li>{q.option2}</li>
                          <li>{q.option3}</li>
                          <li>{q.option4}</li>
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
    </div>
  );
};

export default CreateQuestionPage;
