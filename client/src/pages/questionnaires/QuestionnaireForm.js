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
    subject: '',
    category: '',
    grade: '',
    phase: '',
    course_id: '',
    created_by: user?.id
  });
  
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [subjectName, setSubjectName] = useState('');
  
  // Estado para nueva categoría
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  
  // Estado para nueva materia
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  
  // Estado para el modal de nuevo cuestionario
  const [showModal, setShowModal] = useState(false);
  const [newQuestionnaireData, setNewQuestionnaireData] = useState({
    title: '',
    description: '',
    subject: '',
    category: '',
    grade: '',
    phase: '',
    course_id: '',
    created_by: user?.id
  });
  
  // Estado para nueva categoría en el modal
  const [isCreatingModalCategory, setIsCreatingModalCategory] = useState(false);
  const [newModalCategory, setNewModalCategory] = useState('');
  
  // Estado para nueva materia en el modal
  const [isCreatingModalSubject, setIsCreatingModalSubject] = useState(false);
  const [customModalSubject, setCustomModalSubject] = useState('');
  
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
        
        // Cargar todas las materias disponibles
        const subjectsResponse = await axios.get(`${API_URL}/api/subject-categories-list/subjects`);
        let loadedSubjects = subjectsResponse.data;
        
        // Cargar materia del docente (para determinar la materia por defecto)
        let teacherSubject = 'Matematicas';
        if (user?.id) {
          const subjectResponse = await axios.get(`${API_URL}/api/teacher/subject/${user.id}`);
          teacherSubject = subjectResponse.data.subject || 'Matematicas';
          setSubjectName(teacherSubject);
          
          // Asegurar que la materia del docente esté en la lista de materias
          const subjectExists = loadedSubjects.some(s => s.subject === teacherSubject);
          if (!subjectExists) {
            loadedSubjects.push({ subject: teacherSubject });
          }
          
          // Pre-seleccionar la materia del docente en formData si no estamos editando
          if (!isEditing) {
            setFormData(prev => ({
              ...prev,
              subject: teacherSubject
            }));
            
            // Cargar categorías basadas en la materia del docente
            const categoriesResponse = await axios.get(`${API_URL}/api/subject-categories/${teacherSubject}`);
            setCategories(categoriesResponse.data);
          }
        }
        
        setSubjects(loadedSubjects);
        
        // Si estamos editando, cargar datos del cuestionario
        if (isEditing) {
          const questionnaireResponse = await axios.get(`${API_URL}/api/questionnaires/${id}`);
          
          // Verificar que la respuesta tenga la estructura esperada
          if (questionnaireResponse.data && questionnaireResponse.data.questionnaire) {
            const questionnaireData = questionnaireResponse.data.questionnaire;
            
            console.log('Datos del cuestionario recibidos:', questionnaireResponse.data);
            
            // MIGRACIÓN AUTOMÁTICA: Si el cuestionario NO tiene subject pero SÍ tiene category
            let extractedSubject = questionnaireData.subject;
            let extractedCategory = questionnaireData.category;
            
            if (!extractedSubject && questionnaireData.category) {
              // CASO 1: Formato antiguo "Matematicas_Geometria"
              if (questionnaireData.category.includes('_')) {
                const parts = questionnaireData.category.split('_');
                extractedSubject = parts[0];
                extractedCategory = parts.slice(1).join('_'); // Por si hay más de un underscore
                
                console.log('📦 Migración automática (formato antiguo):', {
                  category_antigua: questionnaireData.category,
                  subject_extraido: extractedSubject,
                  category_extraida: extractedCategory
                });
              } 
              // CASO 2: Ya tiene category migrada pero falta subject -> usar materia del docente
              else {
                extractedSubject = teacherSubject; // Usar la materia del docente como fallback
                extractedCategory = questionnaireData.category;
                
                console.log('📦 Migración automática (subject faltante):', {
                  category_existente: questionnaireData.category,
                  subject_asignado: extractedSubject
                });
              }
            }
            
            // Si el cuestionario tiene una materia que no está en la lista, agregarla
            if (extractedSubject) {
              const subjectExistsInList = loadedSubjects.some(s => s.subject === extractedSubject);
              if (!subjectExistsInList) {
                loadedSubjects.push({ subject: extractedSubject });
                setSubjects([...loadedSubjects]); // Actualizar el estado con la nueva materia
              }
            }
            
            // Actualizar el estado del formulario con los datos del cuestionario (con valores migrados si aplica)
            setFormData({
              title: questionnaireData.title || '',
              description: questionnaireData.description || '',
              subject: extractedSubject || '',
              category: extractedCategory || '',
              grade: String(questionnaireData.grade) || '',
              phase: String(questionnaireData.phase) || '',
              course_id: String(questionnaireData.course_id) || '',
              created_by: user?.id
            });
            
            // Si el cuestionario tiene materia, cargar sus categorías
            if (extractedSubject) {
              const categoriesResponse = await axios.get(`${API_URL}/api/subject-categories/${extractedSubject}`);
              const loadedCategories = categoriesResponse.data;
              
              // Verificar si la categoría actual del cuestionario está en la lista
              if (extractedCategory) {
                const categoryExists = loadedCategories.some(cat => cat.category === extractedCategory);
                
                // Si la categoría no existe en la lista, agregarla
                if (!categoryExists) {
                  loadedCategories.push({
                    id: 'temp-' + extractedCategory,
                    subject: extractedSubject,
                    category: extractedCategory
                  });
                }
              }
              
              setCategories(loadedCategories);
            }
            
            console.log('FormData actualizado:', {
              title: questionnaireData.title || '',
              description: questionnaireData.description || '',
              subject: extractedSubject || '',
              category: extractedCategory || '',
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
  
  // useEffect para cargar categorías cuando cambia la materia (solo si no estamos en el useEffect inicial)
  useEffect(() => {
    // Evitar cargar categorías si estamos en modo edición y aún no se ha cargado el cuestionario
    if (isEditing && !formData.title) {
      return; // Esperar a que se cargue el cuestionario primero
    }
    
    const loadCategories = async () => {
      if (formData.subject) {
        try {
          const categoriesResponse = await axios.get(`${API_URL}/api/subject-categories/${formData.subject}`);
          setCategories(categoriesResponse.data);
        } catch (error) {
          console.error('Error al cargar categorías:', error);
        }
      } else {
        setCategories([]);
      }
    };
    
    loadCategories();
  }, [formData.subject, isEditing, formData.title]);
  
  // Manejar cambios en el formulario principal
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia la materia, limpiar la categoría
    if (name === 'subject') {
      setFormData(prev => ({
        ...prev,
        subject: value,
        category: '' // Limpiar categoría al cambiar materia
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // useEffect para cargar categorías cuando cambia la materia en el modal
  useEffect(() => {
    const loadModalCategories = async () => {
      if (newQuestionnaireData.subject) {
        try {
          const categoriesResponse = await axios.get(`${API_URL}/api/subject-categories/${newQuestionnaireData.subject}`);
          setCategories(categoriesResponse.data);
        } catch (error) {
          console.error('Error al cargar categorías del modal:', error);
        }
      }
    };
    
    loadModalCategories();
  }, [newQuestionnaireData.subject]);
  
  // Manejar cambios en el formulario del modal
  const handleModalChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia la materia en el modal, limpiar la categoría
    if (name === 'subject') {
      setNewQuestionnaireData(prev => ({
        ...prev,
        subject: value,
        category: '', // Limpiar categoría al cambiar materia
        created_by: user?.id
      }));
    } else {
      setNewQuestionnaireData(prev => ({
        ...prev,
        [name]: value,
        created_by: user?.id
      }));
    }
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
              onClick={() => {
                // Pre-seleccionar la materia del docente cuando se abre el modal
                setNewQuestionnaireData(prev => ({
                  ...prev,
                  subject: subjectName || '',
                  category: '',
                  created_by: user?.id
                }));
                setShowModal(true);
              }}
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
                <label htmlFor="subject" className="form-label">Materia</label>
                {!isCreatingSubject ? (
                  <div>
                    <div className="input-group">
                      <select
                        className="form-select"
                        id="subject"
                        name="subject"
                        value={String(formData.subject) || ''}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Seleccionar materia</option>
                        {subjects.map((subj, index) => (
                          <option key={index} value={subj.subject}>
                            {subj.subject}
                          </option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        className="btn btn-outline-primary"
                        onClick={() => setIsCreatingSubject(true)}
                        title="Agregar nueva materia"
                      >
                        <strong>+</strong>
                      </button>
                    </div>
                    <small className="d-block mt-1 px-2 py-1 rounded" style={{backgroundColor: '#0d6efd', color: 'white', fontSize: '0.75rem'}}>
                      💡 ¿No encuentras la materia? Haz clic en + para agregar una nueva.
                    </small>
                  </div>
                ) : (
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nombre de la nueva materia (ej: Física)"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="btn btn-success"
                      onClick={() => {
                        if (customSubject.trim()) {
                          // Agregar la materia a la lista y seleccionarla
                          const newSubjects = [...subjects, { subject: customSubject.trim() }];
                          setSubjects(newSubjects);
                          setFormData(prev => ({
                            ...prev,
                            subject: customSubject.trim(),
                            category: '' // Limpiar categoría
                          }));
                          setCustomSubject('');
                          setIsCreatingSubject(false);
                        }
                      }}
                    >
                      Guardar
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setIsCreatingSubject(false);
                        setCustomSubject('');
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="category" className="form-label">Categoría</label>
                {!isCreatingCategory ? (
                  <div>
                    <div className="input-group">
                      {categories.length > 0 ? (
                        <select
                          className="form-select"
                          id="category"
                          name="category"
                          value={String(formData.category) || ''}
                          onChange={handleChange}
                          disabled={!formData.subject}
                        >
                          <option value="">Seleccionar categoría</option>
                          {categories.map((cat, index) => (
                            <option key={index} value={cat.category}>
                              {cat.category}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="form-control"
                          id="category"
                          name="category"
                          value={formData.category || ''}
                          onChange={handleChange}
                          placeholder="Escribe el nombre de la categoría"
                          disabled={!formData.subject}
                        />
                      )}
                      <button 
                        type="button" 
                        className="btn btn-outline-primary"
                        onClick={() => setIsCreatingCategory(true)}
                        disabled={!formData.subject}
                        title="Agregar nueva categoría"
                      >
                        <strong>+</strong>
                      </button>
                    </div>
                    <small className="d-block mt-1 px-2 py-1 rounded" style={{backgroundColor: !formData.subject ? '#6c757d' : '#0d6efd', color: 'white', fontSize: '0.75rem'}}>
                      {!formData.subject ? '⚠️ Primero selecciona una materia' : '💡 Clic en + para nueva categoría'}
                    </small>
                  </div>
                ) : (
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nueva categoría (ej: Geometría)"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="btn btn-success"
                      onClick={() => {
                        if (newCategory.trim()) {
                          // Agregar la categoría a la lista y seleccionarla
                          const newCat = { 
                            id: 'temp-' + Date.now(), 
                            subject: formData.subject, 
                            category: newCategory.trim() 
                          };
                          setCategories([...categories, newCat]);
                          setFormData(prev => ({
                            ...prev,
                            category: newCategory.trim()
                          }));
                          setNewCategory('');
                          setIsCreatingCategory(false);
                        }
                      }}
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
            </div>
            
            <div className="row">
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
              <label htmlFor="modal-subject" className="form-label">Materia</label>
              {!isCreatingModalSubject ? (
                <div>
                  <div className="input-group">
                    <select
                      className="form-select"
                      id="modal-subject"
                      name="subject"
                      value={newQuestionnaireData.subject || ''}
                      onChange={handleModalChange}
                      required
                    >
                      <option value="">Seleccionar materia</option>
                      {subjects.map((subj, index) => (
                        <option key={index} value={subj.subject}>
                          {subj.subject}
                        </option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      className="btn btn-outline-primary"
                      onClick={() => setIsCreatingModalSubject(true)}
                      title="Agregar nueva materia"
                    >
                      <strong>+</strong>
                    </button>
                  </div>
                  <small className="d-block mt-1 px-2 py-1 rounded" style={{backgroundColor: '#0d6efd', color: 'white', fontSize: '0.75rem'}}>
                    💡 Clic en + para nueva materia
                  </small>
                </div>
              ) : (
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nueva materia (ej: Física)"
                    value={customModalSubject}
                    onChange={(e) => setCustomModalSubject(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn btn-success"
                    onClick={() => {
                      if (customModalSubject.trim()) {
                        const newSubjects = [...subjects, { subject: customModalSubject.trim() }];
                        setSubjects(newSubjects);
                        setNewQuestionnaireData(prev => ({
                          ...prev,
                          subject: customModalSubject.trim(),
                          category: ''
                        }));
                        setCustomModalSubject('');
                        setIsCreatingModalSubject(false);
                      }
                    }}
                  >
                    OK
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setIsCreatingModalSubject(false);
                      setCustomModalSubject('');
                    }}
                  >
                    X
                  </button>
                </div>
              )}
            </div>
            
            <div className="col-md-6 mb-3">
              <label htmlFor="modal-category" className="form-label">Categoría</label>
              {!isCreatingModalCategory ? (
                <div>
                  <div className="input-group">
                    {categories.length > 0 ? (
                      <select
                        className="form-select"
                        id="modal-category"
                        name="category"
                        value={newQuestionnaireData.category || ''}
                        onChange={handleModalChange}
                        disabled={!newQuestionnaireData.subject}
                      >
                        <option value="">Seleccionar categoría</option>
                        {categories.map((cat, index) => (
                          <option key={index} value={cat.category}>
                            {cat.category}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-control"
                        id="modal-category"
                        name="category"
                        value={newQuestionnaireData.category || ''}
                        onChange={handleModalChange}
                        placeholder="Escribe el nombre de la categoría"
                        disabled={!newQuestionnaireData.subject}
                      />
                    )}
                    <button 
                      type="button" 
                      className="btn btn-outline-primary"
                      onClick={() => setIsCreatingModalCategory(true)}
                      disabled={!newQuestionnaireData.subject}
                      title="Agregar nueva categoría"
                    >
                      <strong>+</strong>
                    </button>
                  </div>
                  <small className="d-block mt-1 px-2 py-1 rounded" style={{backgroundColor: !newQuestionnaireData.subject ? '#6c757d' : '#0d6efd', color: 'white', fontSize: '0.75rem'}}>
                    {!newQuestionnaireData.subject ? '⚠️ Primero selecciona una materia' : '💡 Clic en + para nueva categoría'}
                  </small>
                </div>
              ) : (
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nueva categoría"
                    value={newModalCategory}
                    onChange={(e) => setNewModalCategory(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn btn-success"
                    onClick={() => {
                      if (newModalCategory.trim()) {
                        const newCat = { 
                          id: 'temp-' + Date.now(), 
                          subject: newQuestionnaireData.subject, 
                          category: newModalCategory.trim() 
                        };
                        setCategories([...categories, newCat]);
                        setNewQuestionnaireData(prev => ({
                          ...prev,
                          category: newModalCategory.trim()
                        }));
                        setNewModalCategory('');
                        setIsCreatingModalCategory(false);
                      }
                    }}
                  >
                    OK
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setIsCreatingModalCategory(false);
                      setNewModalCategory('');
                    }}
                  >
                    X
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="row">
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
