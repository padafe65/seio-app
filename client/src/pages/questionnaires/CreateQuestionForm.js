// src/pages/questionnaires/CreateQuestionnaireForm.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const CreateQuestionnaireForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    grade: '',
    phase: '',
    course_id: ''
  });
  
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Obtener cursos
        const coursesResponse = await axios.get(`${API_URL}/api/courses`);
        setCourses(coursesResponse.data);
        
        // Obtener categorías
        try {
          const userId = localStorage.getItem('user_id');
          if (userId) {
            // Obtener la materia del docente
            const teacherResponse = await axios.get(`${API_URL}/api/teacher/subject/${userId}`);
            if (teacherResponse.data && teacherResponse.data.subject) {
              const subject = teacherResponse.data.subject;
              
              // Obtener categorías para esta materia
              const categoriesResponse = await axios.get(`${API_URL}/api/categories/${encodeURIComponent(subject)}`);
              setCategories(categoriesResponse.data);
            } else {
              // Si no se puede obtener la materia específica, cargar todas las categorías
              const allCategoriesResponse = await axios.get(`${API_URL}/api/all-categories`);
              setCategories(allCategoriesResponse.data);
            }
          } else {
            // Si no hay ID de usuario, cargar todas las categorías
            const allCategoriesResponse = await axios.get(`${API_URL}/api/all-categories`);
            setCategories(allCategoriesResponse.data);
          }
        } catch (err) {
          console.error("Error al cargar categorías:", err);
          // Intentar cargar todas las categorías como respaldo
          try {
            const allCategoriesResponse = await axios.get(`${API_URL}/api/all-categories`);
            setCategories(allCategoriesResponse.data);
          } catch (backupErr) {
            console.error("Error al cargar todas las categorías:", backupErr);
            setCategories([]);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Obtener el ID del usuario
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo identificar al usuario. Por favor, inicia sesión nuevamente.'
        });
        return;
      }
      
      // Crear el cuestionario
      const response = await axios.post(`${API_URL}/api/questionnaires`, {
        ...formData,
        created_by: userId
      });
      
      const questionnaireId = response.data.id;
      
      Swal.fire({
        icon: 'success',
        title: 'Cuestionario creado',
        text: '¿Deseas añadir preguntas ahora?',
        showCancelButton: true,
        confirmButtonText: 'Sí, añadir preguntas',
        cancelButtonText: 'No, más tarde'
      }).then((result) => {
        if (result.isConfirmed) {
          // Redirigir a la página de añadir preguntas
          navigate(`/cuestionarios/${questionnaireId}/preguntas`);
        } else {
          // Redirigir a la lista de cuestionarios
          navigate('/cuestionarios');
        }
      });
    } catch (error) {
      console.error('Error al crear cuestionario:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al crear el cuestionario. Por favor, intenta nuevamente.'
      });
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
  
  return (
    <div className="container my-4">
      <div className="card">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">Crear Nuevo Cuestionario</h5>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="title" className="form-label">Título del Cuestionario</label>
              <input
                type="text"
                className="form-control"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="category" className="form-label">Categoría</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="form-select"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((cat, index) => {
                    const categoryName = cat.category || '';
                    const displayName = categoryName.includes('_') 
                      ? categoryName.split('_')[1] 
                      : categoryName;
                    
                    return (
                      <option key={index} value={categoryName}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="course_id" className="form-label">Curso</label>
                <select
                  id="course_id"
                  name="course_id"
                  value={formData.course_id}
                  onChange={handleChange}
                  className="form-select"
                  required
                >
                  <option value="">Seleccionar curso</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="grade" className="form-label">Grado</label>
                <select
                  id="grade"
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
                  className="form-select"
                  required
                >
                  <option value="">Seleccionar grado</option>
                  <option value="7">7°</option>
                  <option value="8">8°</option>
                  <option value="9">9°</option>
                  <option value="10">10°</option>
                  <option value="11">11°</option>
                </select>
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="phase" className="form-label">Fase</label>
                <select
                  id="phase"
                  name="phase"
                  value={formData.phase}
                  onChange={handleChange}
                  className="form-select"
                  required
                >
                  <option value="">Seleccionar fase</option>
                  <option value="1">Fase 1</option>
                  <option value="2">Fase 2</option>
                  <option value="3">Fase 3</option>
                  <option value="4">Fase 4</option>
                </select>
              </div>
            </div>
            
            <div className="d-flex justify-content-between mt-4">
              <button 
                type="button" 
                className="btn btn-outline-secondary"
                onClick={() => navigate('/cuestionarios')}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
              >
                Crear Cuestionario
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateQuestionnaireForm;
