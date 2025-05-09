// pages/questionnaires/QuestionnaireForm.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const QuestionnaireForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;
  
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    grade: '',
    phase: '',
    course_id: ''
  });
  
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [teacherSubject, setTeacherSubject] = useState('');
  
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 1. Obtener los cursos
        const coursesResponse = await axios.get(`${API_URL}/api/courses`);
        setCourses(coursesResponse.data);
        
        // 2. Obtener la materia del docente (con manejo de errores)
        let subject = 'Matematicas'; // Valor por defecto
        try {
          const teacherResponse = await axios.get(`${API_URL}/api/teachers/subject/${user.id}`);
          subject = teacherResponse.data.subject || 'Matematicas';
          setTeacherSubject(subject); // Añade esta línea

        } catch (err) {
          console.warn('No se pudo obtener la materia del docente, usando valor por defecto:', err);
          setTeacherSubject('Matematicas');
        }
        
        // 3. Obtener las categorías según la materia (con manejo de errores)
        try {
          const categoriesResponse = await axios.get(`${API_URL}/api/subject-categories/${subject}`);
          setCategories(categoriesResponse.data);
        } catch (err) {
          console.warn('No se pudieron obtener las categorías, usando valores predeterminados:', err);
          // Usar categorías predeterminadas si falla la carga
          setCategories([
            { id: 1, category: 'Matematicas_Geometria' },
            { id: 2, category: 'Matematicas_Algebra' },
            { id: 3, category: 'Matematicas_Aritmetica' },
            { id: 4, category: 'Matematicas_Estadistica' },
            { id: 5, category: 'Matematicas_Trigonometria' },
            { id: 6, category: 'Matematicas_Calculo' }
          ]);
        }
        
        // 4. Si estamos editando, cargar los datos del cuestionario
        if (isEditing) {
          try {
            const questionnaireResponse = await axios.get(`${API_URL}/api/questionnaires/${id}`);
            const questionnaireData = questionnaireResponse.data.questionnaire;
            
            setFormData({
              title: questionnaireData.title || '',
              category: questionnaireData.category || '',
              grade: questionnaireData.grade || '',
              phase: questionnaireData.phase || '',
              course_id: questionnaireData.course_id || ''
            });
          } catch (err) {
            console.error('Error al cargar cuestionario:', err);
            setError('No se pudo cargar la información del cuestionario. Por favor, intenta de nuevo.');
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        setError('No se pudieron cargar los datos necesarios. Por favor, intenta de nuevo.');
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, [id, isEditing, user.id]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      // Obtener el ID del profesor
      const teacherResponse = await axios.get(`${API_URL}/api/teachers/by-user/${user.id}`);
      const teacherId = teacherResponse.data.id;
      
      if (isEditing) {
        // Actualizar cuestionario existente
        await axios.put(`${API_URL}/api/questionnaires/${id}`, formData);
        alert('Cuestionario actualizado correctamente');
        navigate('/cuestionarios');
      } else {
        // Crear nuevo cuestionario
        const response = await axios.post(`${API_URL}/api/questionnaires`, {
          ...formData,
          created_by: teacherId // Usar el ID del profesor, no el ID del usuario
        });
        
        alert('Cuestionario creado correctamente');
        navigate(`/cuestionarios/${response.data.id}/preguntas`);
      }
    } catch (error) {
      console.error('Error al procesar cuestionario:', error);
      setError(`Error al ${isEditing ? 'actualizar' : 'crear'} el cuestionario: ${error.response?.data?.message || error.message}`);
      setSubmitting(false);
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
    <div>
      <h4 className="mb-4">
        {isEditing ? 'Editar Cuestionario' : 'Nuevo Cuestionario'}
      </h4>
      
      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      )}
      
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="title" className="form-label">Título del Cuestionario</label>
                <input
                  type="text"
                  className="form-control"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder={`Ej: Evaluación de ${teacherSubject} grado 7 fase 1`}
                  required
                />
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="category" className="form-label">Categoría</label>
                <select
                  className="form-select"
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccionar Categoría</option>
                  {categories.map((category, index) => (
                    <option key={category.id || index} value={category.category}>
                      {category.category.replace('_', ' - ')}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="col-md-4 mb-3">
                <label htmlFor="grade" className="form-label">Grado</label>
                <select
                  className="form-select"
                  id="grade"
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccionar Grado</option>
                  <option value="7">7°</option>
                  <option value="8">8°</option>
                  <option value="9">9°</option>
                  <option value="10">10°</option>
                  <option value="11">11°</option>
                </select>
              </div>
              
              <div className="col-md-4 mb-3">
                <label htmlFor="phase" className="form-label">Fase</label>
                <select
                  className="form-select"
                  id="phase"
                  name="phase"
                  value={formData.phase}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccionar Fase</option>
                  <option value="1">Fase 1</option>
                  <option value="2">Fase 2</option>
                  <option value="3">Fase 3</option>
                  <option value="4">Fase 4</option>
                </select>
              </div>
              
              <div className="col-md-4 mb-3">
                <label htmlFor="course_id" className="form-label">Curso</label>
                <select
                  className="form-select"
                  id="course_id"
                  name="course_id"
                  value={formData.course_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccionar Curso</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate('/cuestionarios')}
                disabled={submitting}
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Guardando...
                  </>
                ) : (
                  isEditing ? 'Actualizar Cuestionario' : 'Crear Cuestionario'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireForm;
