import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Edit, Trash2, Plus, X } from 'lucide-react';

const MySwal = withReactContent(Swal);

const SubjectCategoryForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [allCategories, setAllCategories] = useState([]); // Todas las materias y categorías
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
  
  // Estados para editar
  const [editingCategory, setEditingCategory] = useState(null);
  const [editSubject, setEditSubject] = useState('');
  const [editCategory, setEditCategory] = useState('');
  
  // Cargar todas las materias y categorías
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // Cargar todas las materias y categorías
        const allResponse = await axios.get('/subject-categories-all');
        setAllCategories(Array.isArray(allResponse.data) ? allResponse.data : []);
        
        // Cargar materias únicas
        const subjectsResponse = await axios.get('/subjects');
        setSubjects(Array.isArray(subjectsResponse.data) ? subjectsResponse.data : []);
        
        setLoading(false);
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError('Error al cargar los datos necesarios');
        setLoading(false);
      }
    };
    
    fetchAllData();
  }, []);
  
  // Cargar categorías cuando cambia la materia seleccionada
  useEffect(() => {
    const fetchCategories = async () => {
      if (!selectedSubject) {
        setCategories([]);
        return;
      }
      
      try {
        const response = await axios.get(`/subject-categories/${selectedSubject}`);
        setCategories(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Error al cargar categorías:', err);
        setError('Error al cargar las categorías');
      }
    };
    
    fetchCategories();
  }, [selectedSubject, allCategories]);
  
  // Función para refrescar datos
  const refreshData = async () => {
    try {
      const allResponse = await axios.get('/subject-categories-all');
      setAllCategories(Array.isArray(allResponse.data) ? allResponse.data : []);
      
      const subjectsResponse = await axios.get('/subjects');
      setSubjects(Array.isArray(subjectsResponse.data) ? subjectsResponse.data : []);
    } catch (err) {
      console.error('Error al refrescar datos:', err);
    }
  };
  
  // Manejar cambio de materia seleccionada
  const handleSubjectChange = (e) => {
    setSelectedSubject(e.target.value);
    setEditingCategory(null);
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
      await axios.post('/subjects', { subject: newSubject });
      await refreshData();
      setSelectedSubject(newSubject);
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
        text: err.response?.data?.message || 'No se pudo crear la materia'
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
      const fullCategoryName = `${selectedSubject}_${newCategory}`;
      await axios.post('/subject-categories', {
        subject: selectedSubject,
        category: fullCategoryName
      });
      await refreshData();
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
        text: err.response?.data?.message || 'No se pudo crear la categoría'
      });
    }
  };
  
  // Iniciar edición de categoría
  const handleEditCategory = (category) => {
    setEditingCategory(category.id);
    setEditSubject(category.subject);
    const categoryName = category.category.split('_').slice(1).join('_');
    setEditCategory(categoryName);
  };
  
  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditSubject('');
    setEditCategory('');
  };
  
  // Guardar edición de categoría
  const handleUpdateCategory = async (id) => {
    if (!editSubject.trim() || !editCategory.trim()) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor complete todos los campos'
      });
      return;
    }
    
    try {
      const fullCategoryName = `${editSubject}_${editCategory}`;
      await axios.put(`/subject-categories/${id}`, {
        subject: editSubject,
        category: fullCategoryName
      });
      await refreshData();
      handleCancelEdit();
      
      MySwal.fire({
        icon: 'success',
        title: 'Categoría actualizada',
        text: 'La categoría ha sido actualizada exitosamente'
      });
    } catch (err) {
      console.error('Error al actualizar categoría:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'No se pudo actualizar la categoría'
      });
    }
  };
  
  // Eliminar categoría
  const handleDeleteCategory = async (id, categoryName) => {
    const result = await MySwal.fire({
      icon: 'warning',
      title: '¿Eliminar categoría?',
      html: `¿Estás seguro de que deseas eliminar la categoría <b>${categoryName}</b>?<br/><br/>Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await axios.delete(`/subject-categories/${id}`);
        await refreshData();
        
        MySwal.fire({
          icon: 'success',
          title: 'Categoría eliminada',
          text: 'La categoría ha sido eliminada exitosamente'
        });
      } catch (err) {
        console.error('Error al eliminar categoría:', err);
        MySwal.fire({
          icon: 'error',
          title: 'Error',
          text: err.response?.data?.message || 'No se pudo eliminar la categoría'
        });
      }
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
          {/* Sección de creación rápida */}
          <div className="row mb-4">
            <div className="col-md-6">
              <h6 className="mb-3">Materias</h6>
              
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
                  {showSubjectForm ? <X size={18} /> : <Plus size={18} />}
                </button>
              </div>
              
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
                    <button type="submit" className="btn btn-success">
                      Guardar
                    </button>
                  </div>
                </form>
              )}
            </div>
            
            <div className="col-md-6">
              <h6 className="mb-3">Categorías</h6>
              
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span>Categorías de {selectedSubject || 'la materia seleccionada'}</span>
                <button 
                  type="button" 
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setShowCategoryForm(!showCategoryForm)}
                  disabled={!selectedSubject}
                >
                  {showCategoryForm ? <X size={18} /> : <Plus size={18} />}
                </button>
              </div>
              
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
                    <button type="submit" className="btn btn-success">
                      Guardar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
          
          {/* Tabla completa de todas las materias y categorías */}
          <div className="mt-4">
            <h6 className="mb-3">Todas las Materias y Categorías</h6>
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead className="table-dark">
                  <tr>
                    <th>ID</th>
                    <th>Materia</th>
                    <th>Categoría</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {allCategories.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-3">
                        No hay materias o categorías registradas
                      </td>
                    </tr>
                  ) : (
                    allCategories.map((item) => {
                      const isEditing = editingCategory === item.id;
                      const categoryName = item.category.split('_').slice(1).join('_') || item.category;
                      
                      return (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>
                            {isEditing ? (
                              <select
                                className="form-select form-select-sm"
                                value={editSubject}
                                onChange={(e) => setEditSubject(e.target.value)}
                              >
                                {subjects.map((s, idx) => (
                                  <option key={idx} value={s}>{s}</option>
                                ))}
                              </select>
                            ) : (
                              item.subject
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                placeholder="Nombre de categoría"
                              />
                            ) : (
                              categoryName
                            )}
                          </td>
                          <td className="text-end">
                            {isEditing ? (
                              <div className="btn-group btn-group-sm">
                                <button
                                  className="btn btn-success"
                                  onClick={() => handleUpdateCategory(item.id)}
                                  title="Guardar"
                                >
                                  <Plus size={16} />
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  onClick={handleCancelEdit}
                                  title="Cancelar"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="btn-group btn-group-sm">
                                <button
                                  className="btn btn-warning"
                                  onClick={() => handleEditCategory(item)}
                                  title="Editar"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  className="btn btn-danger"
                                  onClick={() => handleDeleteCategory(item.id, categoryName)}
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubjectCategoryForm;
