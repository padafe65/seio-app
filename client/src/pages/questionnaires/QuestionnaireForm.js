// src/components/QuestionnaireForm.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { FileText } from 'lucide-react';

const MySwal = withReactContent(Swal);
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const QuestionnaireForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isEditing = !!id;
  
  // Obtener la categoría de los query params si existe
  const queryParams = new URLSearchParams(location.search);
  const categoryFromUrl = queryParams.get('category');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    grade: '',
    phase: '',
    course_id: '',
    created_by: user?.id
  });
  
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [subjectName, setSubjectName] = useState('');
  
  // Estado para nueva categoría
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  
  // Estado para el modal de nuevo cuestionario
  const [showModal, setShowModal] = useState(false);
  const [newQuestionnaireData, setNewQuestionnaireData] = useState({
    title: '',
    description: '',
    category: '',
    grade: '',
    phase: '',
    course_id: '',
    created_by: user?.id
  });
  
  // Estado para nueva categoría en el modal
  const [isCreatingModalCategory, setIsCreatingModalCategory] = useState(false);
  const [newModalCategory, setNewModalCategory] = useState('');
  
  // Efecto para depuración
  useEffect(() => {
    if (isEditing) {
      console.log('Estado actual del formulario:', formData);
    }
  }, [formData, isEditing]);
  
  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Cargar cursos
        const coursesResponse = await axios.get(`${API_URL}/api/courses`);
        setCourses(coursesResponse.data);
        
        // Cargar materia del docente
        if (user?.id) {
          const subjectResponse = await axios.get(`${API_URL}/api/teacher/subject/${user.id}`);
          const subject = subjectResponse.data.subject || 'Matematicas';
          setSubjectName(subject);
          
          // Cargar categorías basadas en la materia
          const categoriesResponse = await axios.get(`${API_URL}/api/subject-categories/${subject}`);
          setCategories(categoriesResponse.data);
        }
        
        // Si estamos editando, cargar datos del cuestionario
        if (isEditing) {
          const questionnaireResponse = await axios.get(`${API_URL}/api/questionnaires/${id}`);
          
          // Verificar que la respuesta tenga la estructura esperada
          if (questionnaireResponse.data && questionnaireResponse.data.questionnaire) {
            const questionnaireData = questionnaireResponse.data.questionnaire;
            
            console.log('Datos del cuestionario recibidos:', questionnaireResponse.data);
            
            // Actualizar el estado del formulario con los datos del cuestionario
            setFormData({
              title: questionnaireData.title || '',
              description: questionnaireData.description || '',
              category: questionnaireData.category || '',
              grade: String(questionnaireData.grade) || '',
              phase: String(questionnaireData.phase) || '',
              course_id: String(questionnaireData.course_id) || '',
              created_by: user?.id
            });
            
            console.log('FormData actualizado:', {
              title: questionnaireData.title || '',
              description: questionnaireData.description || '',
              category: questionnaireData.category || '',
              grade: String(questionnaireData.grade) || '',
              phase: String(questionnaireData.phase) || '',
              course_id: String(questionnaireData.course_id) || '',
            });
          }
        }
        
        // Si hay una categoría en la URL, seleccionarla automáticamente
        if (categoryFromUrl) {
          setFormData(prev => ({
            ...prev,
            category: categoryFromUrl
          }));
          
          // También actualizar en el modal si está abierto
          setNewQuestionnaireData(prev => ({
            ...prev,
            category: categoryFromUrl
          }));
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError('Error al cargar los datos necesarios');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, isEditing, user, categoryFromUrl]);
  
  // Manejar cambios en el formulario principal
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Manejar cambios en el formulario del modal
  const handleModalChange = (e) => {
    const { name, value } = e.target;
    setNewQuestionnaireData(prev => ({
      ...prev,
      [name]: value,
      created_by: user?.id
    }));
  };
  
  // Manejar creación de nueva categoría
  const handleCreateCategory = async () => {
    if (!newCategory.trim()) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor ingrese un nombre para la categoría'
      });
      return;
    }
    
    try {
      const fullCategoryName = `${subjectName}_${newCategory.trim()}`;
      
      // Crear la nueva categoría
      await axios.post(`${API_URL}/api/subject-categories`, {
        subject: subjectName,
        category: fullCategoryName
      });
      
      // Actualizar la lista de categorías
      const updatedCategories = [...categories, { category: fullCategoryName }];
      setCategories(updatedCategories);
      
      // Seleccionar la nueva categoría
      setFormData(prev => ({
        ...prev,
        category: fullCategoryName
      }));
      
      // Limpiar y cerrar el formulario
      setNewCategory('');
      setIsCreatingCategory(false);
      
      MySwal.fire({
        icon: 'success',
        title: 'Categoría creada',
        text: 'La categoría ha sido creada exitosamente'
      });
    } catch (error) {
      console.error('Error al crear categoría:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo crear la categoría'
      });
    }
  };
  
  // Manejar creación de nueva categoría en el modal
  const handleCreateModalCategory = async () => {
    if (!newModalCategory.trim()) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor ingrese un nombre para la categoría'
      });
      return;
    }
    
    try {
      const fullCategoryName = `${subjectName}_${newModalCategory.trim()}`;
      
      // Crear la nueva categoría
      await axios.post(`${API_URL}/api/subject-categories`, {
        subject: subjectName,
        category: fullCategoryName
      });
      
      // Actualizar la lista de categorías
      const updatedCategories = [...categories, { category: fullCategoryName }];
      setCategories(updatedCategories);
      
      // Seleccionar la nueva categoría
      setNewQuestionnaireData(prev => ({
        ...prev,
        category: fullCategoryName
      }));
      
      // Limpiar y cerrar el formulario
      setNewModalCategory('');
      setIsCreatingModalCategory(false);
      
      MySwal.fire({
        icon: 'success',
        title: 'Categoría creada',
        text: 'La categoría ha sido creada exitosamente'
      });
    } catch (error) {
      console.error('Error al crear categoría:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo crear la categoría'
      });
    }
  };
  
  // Manejar envío del formulario principal
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/api/questionnaires/${id}`, formData);
        MySwal.fire({
          icon: 'success',
          title: 'Cuestionario actualizado',
          text: 'El cuestionario ha sido actualizado correctamente'
        });
      } else {
        await axios.post(`${API_URL}/api/questionnaires`, formData);
        MySwal.fire({
          icon: 'success',
          title: 'Cuestionario creado',
          text: 'El cuestionario ha sido creado correctamente'
        });
      }
      
      // Redirigir a la lista de cuestionarios
      navigate('/cuestionarios');
    } catch (err) {
      console.error('Error al guardar cuestionario:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al guardar el cuestionario'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Crear nuevo cuestionario desde el modal
  const handleCreateQuestionnaire = async () => {
    setLoading(true);
    
    try {
      // Validar datos
      if (!newQuestionnaireData.title || !newQuestionnaireData.category || 
          !newQuestionnaireData.grade || !newQuestionnaireData.phase || 
          !newQuestionnaireData.course_id) {
        MySwal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Por favor completa todos los campos obligatorios'
        });
        setLoading(false);
        return;
      }
      
      // Crear cuestionario
      const response = await axios.post(`${API_URL}/api/questionnaires`, newQuestionnaireData);
      const newQuestionnaire = response.data;
      
      // Mostrar mensaje de éxito
      await MySwal.fire({
        icon: 'success',
        title: 'Cuestionario creado',
        text: 'El cuestionario ha sido creado correctamente'
      });
      
      // Cerrar modal
      setShowModal(false);
      
      // Redirigir a la página de crear preguntas con el ID del nuevo cuestionario
      navigate(`/crear-pregunta?questionnaire=${newQuestionnaire.id}`);
    } catch (err) {
      console.error('Error al crear cuestionario:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al crear el cuestionario'
      });
    } finally {
      setLoading(false);
    }
  };
  
  if (loading && !showModal) {
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
          <h5 className="mb-0">{isEditing ? 'Editar Cuestionario' : 'Nuevo Cuestionario'}</h5>
          <div>
            <button
              type="button"
              className="btn btn-light btn-sm me-2"
              onClick={() => setShowModal(true)}
            >
              Crear y Añadir Preguntas
            </button>
            <button
              type="button"
              className="btn btn-light btn-sm"
              onClick={() => navigate('/cuestionarios')}
            >
              Volver
            </button>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="title" className="form-label">Título</label>
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
            
            <div className="mb-3">
              <label htmlFor="description" className="form-label">Descripción (opcional)</label>
              <textarea
                className="form-control"
                id="description"
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                rows="3"
              ></textarea>
            </div>
            
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="category" className="form-label">Categoría</label>
                {!isCreatingCategory ? (
                  <div>
                    <div className="input-group mb-2">
                      <select
                        className="form-select"
                        id="category"
                        name="category"
                        value={String(formData.category) || ''}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Seleccionar categoría</option>
                        {categories.map((cat, index) => (
                          <option key={index} value={cat.category}>
                            {cat.category.split('_')[1] || cat.category}
                          </option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        className="btn btn-outline-secondary"
                        onClick={() => setIsCreatingCategory(true)}
                      >
                        <i className="bi bi-plus"></i> Nueva
                      </button>
                    </div>
                    <div className="d-flex align-items-center">
                      <small className="text-muted me-2">¿No encuentras la categoría que necesitas?</small>
                      <Link 
                        to="/materias-categorias?redirect=cuestionarios/nuevo" 
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                      >
                        <FileText size={14} className="me-1" /> Gestionar Materias y Categorías
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nombre de la nueva categoría"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="btn btn-success"
                      onClick={handleCreateCategory}
                    >
                      Guardar
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setIsCreatingCategory(false);
                        setNewCategory('');
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="grade" className="form-label">Grado</label>
                <select
                  className="form-select"
                  id="grade"
                  name="grade"
                  value={String(formData.grade) || ''}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccionar grado</option>
                  <option value="5">5°</option>
                  <option value="6">6°</option>
                  <option value="7">7°</option>
                  <option value="8">8°</option>
                  <option value="9">9°</option>
                  <option value="10">10°</option>
                  <option value="11">11°</option>
                </select>
              </div>
            </div>
            
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="phase" className="form-label">Fase</label>
                <select
                  className="form-select"
                  id="phase"
                  name="phase"
                  value={String(formData.phase) || ''}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccionar fase</option>
                  <option value="1">Fase 1</option>
                  <option value="2">Fase 2</option>
                  <option value="3">Fase 3</option>
                  <option value="4">Fase 4</option>
                </select>
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="course_id" className="form-label">Curso</label>
                <select
                  className="form-select"
                  id="course_id"
                  name="course_id"
                  value={String(formData.course_id) || ''}
                  onChange={handleChange}
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
            
            <div className="d-flex justify-content-between mt-4">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/cuestionarios')}
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Modal para crear cuestionario y añadir preguntas */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Crear Cuestionario y Añadir Preguntas</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label htmlFor="modal-title" className="form-label">Título</label>
            <input
              type="text"
              className="form-control"
              id="modal-title"
              name="title"
              value={newQuestionnaireData.title}
              onChange={handleModalChange}
              required
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="modal-description" className="form-label">Descripción (opcional)</label>
            <textarea
              className="form-control"
              id="modal-description"
              name="description"
              value={newQuestionnaireData.description || ''}
              onChange={handleModalChange}
              rows="2"
            ></textarea>
          </div>
          
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="modal-category" className="form-label">Categoría</label>
              {!isCreatingModalCategory ? (
                <div>
                  <div className="input-group mb-2">
                    <select
                      className="form-select"
                      id="modal-category"
                      name="category"
                      value={newQuestionnaireData.category || ''}
                      onChange={handleModalChange}
                      required
                    >
                      <option value="">Seleccionar categoría</option>
                      {categories.map((cat, index) => (
                        <option key={index} value={cat.category}>
                          {cat.category.split('_')[1] || cat.category}
                        </option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={() => setIsCreatingModalCategory(true)}
                    >
                      <i className="bi bi-plus"></i> Nueva
                    </button>
                  </div>
                  <div className="d-flex align-items-center">
                    <small className="text-muted me-2">¿No encuentras la categoría que necesitas?</small>
                    <Link 
                      to="/materias-categorias?redirect=cuestionarios/nuevo" 
                      className="btn btn-outline-primary btn-sm d-flex align-items-center"
                      onClick={() => setShowModal(false)}
                    >
                      <FileText size={14} className="me-1" /> Gestionar Materias y Categorías
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nombre de la nueva categoría"
                    value={newModalCategory}
                    onChange={(e) => setNewModalCategory(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn btn-success"
                    onClick={handleCreateModalCategory}
                  >
                    Guardar
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setIsCreatingModalCategory(false);
                      setNewModalCategory('');
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            
            <div className="col-md-6 mb-3">
              <label htmlFor="modal-grade" className="form-label">Grado</label>
              <select
                className="form-select"
                id="modal-grade"
                name="grade"
                value={newQuestionnaireData.grade || ''}
                onChange={handleModalChange}
                required
              >
                <option value="">Seleccionar grado</option>
                <option value="5">5°</option>
                <option value="6">6°</option>
                <option value="7">7°</option>
                <option value="8">8°</option>
                <option value="9">9°</option>
                <option value="10">10°</option>
                <option value="11">11°</option>
              </select>
            </div>
          </div>
          
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="modal-phase" className="form-label">Fase</label>
              <select
                className="form-select"
                id="modal-phase"
                name="phase"
                value={newQuestionnaireData.phase || ''}
                onChange={handleModalChange}
                required
              >
                <option value="">Seleccionar fase</option>
                <option value="1">Fase 1</option>
                <option value="2">Fase 2</option>
                <option value="3">Fase 3</option>
                <option value="4">Fase 4</option>
              </select>
            </div>
            
            <div className="col-md-6 mb-3">
              <label htmlFor="modal-course_id" className="form-label">Curso</label>
              <select
                className="form-select"
                id="modal-course_id"
                name="course_id"
                value={newQuestionnaireData.course_id || ''}
                onChange={handleModalChange}
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
          
          <div className="alert alert-info">
            <i className="bi bi-info-circle-fill me-2"></i>
            Al crear el cuestionario, serás redirigido a la página para añadir preguntas.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreateQuestionnaire}
            disabled={loading}
          >
            {loading ? 'Creando...' : 'Crear y Continuar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default QuestionnaireForm;
