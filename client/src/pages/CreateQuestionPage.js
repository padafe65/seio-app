import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import 'bootstrap/dist/css/bootstrap.min.css';

const CreateQuestionPage = () => {
  const initialFormState = {
    questionnaire_id: '',
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

  useEffect(() => {
    fetchQuestions();
    fetchQuestionnaires();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/questions');
      setQuestions(res.data);
    } catch (err) {
      console.error('Error cargando preguntas:', err.message);
    }
  };

  const fetchQuestionnaires = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/questionnaires');
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
      data.append('image_url', preview.replace('http://localhost:5000', ''));
    }

    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/questions/${editingId}`, data);
        Swal.fire('Pregunta actualizada', '', 'success');
      } else {
        await axios.post('http://localhost:5000/api/questions', data);
        Swal.fire('Pregunta creada', '', 'success');
      }
      resetForm();
      fetchQuestions();
    } catch (error) {
      console.error(error);
      Swal.fire('Error al guardar la pregunta', '', 'error');
    }
  };

  const resetForm = () => {
    setFormData(initialFormState);
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
    setPreview(question.image_url ? `http://localhost:5000${question.image_url}` : null);
  };

  const handleDelete = async (id) => {
    await axios.delete(`http://localhost:5000/api/questions/${id}`);
    fetchQuestions();
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">{editingId ? 'Editar Pregunta' : 'Crear Nueva Pregunta'}</h2>

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
                {q.title} - {q.category} (Grado {q.grade}, Fase {q.phase})
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

        {[1, 2, 3, 4].map((i) => (
          <div className="mb-3" key={i}>
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

        <div className="mb-3">
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

        <div className="mb-3">
          <label className="form-label">Categoría</label>
          <input
            type="text"
            className="form-control"
            name="category"
            value={formData.category}
            onChange={handleChange}
          />
        </div>

        <button type="submit" className="btn btn-primary">
          {editingId ? 'Actualizar Pregunta' : 'Guardar Pregunta'}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} className="btn btn-secondary ms-2">
            Cancelar
          </button>
        )}
      </form>

      <hr className="my-5" />

      <h3>Preguntas Existentes</h3>
      <table className="table table-bordered mt-3">
        <thead className="table-light">
          <tr>
            <th>ID</th>
            <th>Texto</th>
            <th>Opción 1</th>
            <th>Opción 2</th>
            <th>Opción 3</th>
            <th>Opción 4</th>
            <th>Respuesta Correcta</th>
            <th>Cuestionario ID</th>
            <th>Categoría</th>
            <th>Imagen</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id}>
              <td>{q.id}</td>
              <td>{q.question_text}</td>
              <td>{q.option1}</td>
              <td>{q.option2}</td>
              <td>{q.option3}</td>
              <td>{q.option4}</td>
              <td>{q.correct_answer}</td>
              <td>{q.questionnaire_id}</td>
              <td>{q.category}</td>
              <td>
                {q.image_url ? (
                  <img
                    src={`http://localhost:5000${q.image_url}`}
                    alt="Pregunta"
                    style={{ width: '100px' }}
                  />
                ) : (
                  'Sin imagen'
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
  );
};

export default CreateQuestionPage;
