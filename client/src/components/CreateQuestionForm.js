  // frontend/src/components/CreateQuestionForm.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const CreateQuestionForm = ({ onQuestionCreated }) => {
  const [formData, setFormData] = useState({
    questionnaire_id: '',
    question_text: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correct_answer: '',
    category: '',
    image: null,
  });

  const [preview, setPreview] = useState(null);
  const [questionnaires, setQuestionnaires] = useState([]);

  useEffect(() => {
    fetchQuestionnaires();
  }, []);

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
      setPreview(URL.createObjectURL(file));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    for (let key in formData) {
      data.append(key, formData[key]);
    }

    try {
      await axios.post('http://localhost:5000/api/questions', data);
      Swal.fire('Pregunta creada', '', 'success');
      setFormData({
        questionnaire_id: '',
        question_text: '',
        option1: '',
        option2: '',
        option3: '',
        option4: '',
        correct_answer: '',
        category: '',
        image: null,
      });
      setPreview(null);
      onQuestionCreated(); // para actualizar la lista en CreateQuestionPage
    } catch (error) {
      console.error(error);
      Swal.fire('Error al crear la pregunta', '', 'error');
    }
  };

  return (
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
              {q.title} ({q.grade} - {q.phase})
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

      <div className="mb-3">
        <label className="form-label">Imagen (opcional)</label>
        <input
          type="file"
          className="form-control"
          name="image"
          accept="image/*"
          onChange={handleChange}
        />
        {preview && (
          <img
            src={preview}
            alt="Preview"
            className="img-fluid border rounded mt-2"
            style={{ maxHeight: '200px' }}
          />
        )}
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
            <option key={i} value={`option${i}`}>
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
        Guardar Pregunta
      </button>
    </form>
  );
};

export default CreateQuestionForm;
  