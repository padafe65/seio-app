import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const SubjectCategoryForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para el formulario de nueva materia
  const [newSubject, setNewSubject] = useState('');
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  
  // Estados para el formulario de nueva categoría
  const [newCategory, setNewCategory] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  
  // Cargar materias y categorías iniciales
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Cargar materias
        const subjectsResponse = await axios.get(`${API_URL}/api/subjects`);
        setSubjects(subjectsResponse.data);
        
        // Si el docente ya tiene una materia asignada, cargarla por defecto
        if (user?.id) {
          const teacherResponse = await axios.get(`${API_URL}/api/teacher/subject/${user.id}`);
          if (teacherResponse.data.subject) {
            setSelectedSubject(teacherResponse.data.subject);
            
            // Cargar categorías de esa materia
            const categoriesResponse = await axios.get(
              `${API_URL}/api/subject-categories/${teacherResponse.data.subject}`
            );
            setCategories(categoriesResponse.data);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError('Error al cargar los datos necesarios');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);
  
  // Cargar categorías cuando cambia la materia seleccionada
  useEffect(() => {
    const fetchCategories = async () => {
      if (!selectedSubject) return;
      
      try {
        const response = await axios.get(`${API_URL}/api/subject-categories/${selectedSubject}`);
        setCategories(response.data);
      } catch (err) {
        console.error('Error al cargar categorías:', err);
        setError('Error al cargar las categorías');
      }
    };
    
    fetchCategories();
  }, [selectedSubject]);
  
  // Manejar cambio de materia seleccionada
  const handleSubjectChange = (e) => {
    setSelectedSubject(e.target.value);
  };
  
  // Crear nueva materia
  const handleCreateSubject = async (e) => {
    e.preventDefault();
    
    if (!newSubject.trim()) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor ingrese un nombre para la materia'
      });
      return;
    }
    
    try {
      // Crear nueva materia en la base de datos
      // Nota: Necesitarás implementar esta ruta en el servidor
      await axios.post(`${API_URL}/api/subjects`, { subject: newSubject });
      
      // Actualizar lista de materias
      const response = await axios.get(`${API_URL}/api/subjects`);
      setSubjects(response.data);
      
      // Seleccionar la nueva materia
      setSelectedSubject(newSubject);
      
      // Limpiar y cerrar el formulario
      setNewSubject('');
      setShowSubjectForm(false);
      
      MySwal.fire({
        icon: 'success',
        title: 'Materia creada',
        text: 'La materia ha sido creada exitosamente'
      });
    } catch (err) {
      console.error('Error al crear materia:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo crear la materia'
      });
    }
  };
  
  // Crear nueva categoría
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    
    if (!selectedSubject) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor seleccione una materia'
      });
      return;
    }
    
    if (!newCategory.trim()) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor ingrese un nombre para la categoría'
      });
      return;
    }
    
    try {
      // Crear nueva categoría en la base de datos
      const fullCategoryName = `${selectedSubject}_${newCategory}`;
      await axios.post(`${API_URL}/api/subject-categories`, {
        subject: selectedSubject,
        category: fullCategoryName
      });
      
      // Actualizar lista de categorías
      const response = await axios.get(`${API_URL}/api/subject-categories/${selectedSubject}`);
      setCategories(response.data);
      
      // Limpiar y cerrar el formulario
      setNewCategory('');
      setShowCategoryForm(false);
      
      MySwal.fire({
        icon: 'success',
        title: 'Categoría creada',
        text: 'La categoría ha sido creada exitosamente'
      });
    } catch (err) {
      console.error('Error al crear categoría:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo crear la categoría'
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
          <h5 className="mb-0">Gestión de Materias y Categorías</h5>
          <button
            type="button"
            className="btn btn-light btn-sm"
            onClick={() => navigate('/dashboard')}
          >
            Volver
          </button>
        </div>
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-6">
              <h6 className="mb-3">Materias</h6>
              
              {/* Selector de materias */}
              <div className="d-flex mb-2">
                <select
                  className="form-select"
                  value={selectedSubject}
                  onChange={handleSubjectChange}
                >
                  <option value="">Seleccionar materia</option>
                  {subjects.map((subject, index) => (
                    <option key={index} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
                <button 
                  type="button" 
                  className="btn btn-outline-primary ms-2"
                  onClick={() => setShowSubjectForm(!showSubjectForm)}
                >
                  {showSubjectForm ? 'Cancelar' : 'Nueva'}
                </button>
              </div>
              
              {/* Formulario para nueva materia */}
              {showSubjectForm && (
                <form onSubmit={handleCreateSubject} className="mt-3">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nombre de la nueva materia"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                    />
                    <button 
                      type="submit" 
                      className="btn btn-success"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              )}
            </div>
            
            <div className="col-md-6">
              <h6 className="mb-3">Categorías</h6>
              
              {/* Lista de categorías */}
              <div className="mb-2">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Categorías de {selectedSubject || 'la materia seleccionada'}</span>
                  <button 
                    type="button" 
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setShowCategoryForm(!showCategoryForm)}
                    disabled={!selectedSubject}
                  >
                    {showCategoryForm ? 'Cancelar' : 'Nueva Categoría'}
                  </button>
                </div>
                
                {selectedSubject ? (
                  categories.length > 0 ? (
                    <ul className="list-group">
                      {categories.map((cat, index) => (
                        <li key={index} className="list-group-item">
                          {cat.category.split('_')[1] || cat.category}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="alert alert-info">
                      No hay categorías para esta materia
                    </div>
                  )
                ) : (
                  <div className="alert alert-warning">
                    Seleccione una materia para ver sus categorías
                  </div>
                )}
              </div>
              
              {/* Formulario para nueva categoría */}
              {showCategoryForm && selectedSubject && (
                <form onSubmit={handleCreateCategory} className="mt-3">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nombre de la nueva categoría"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <button 
                      type="submit" 
                      className="btn btn-success"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubjectCategoryForm;
