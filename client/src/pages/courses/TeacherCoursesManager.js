// pages/courses/TeacherCoursesManager.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Trash2, PlusCircle, Edit3, Calendar, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || '';

const TeacherCoursesManager = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [teacherId, setTeacherId] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [editSelectedCourse, setEditSelectedCourse] = useState('');
  
  useEffect(() => {
    const fetchTeacherId = async () => {
      try {
        if (user) {
          const response = await axios.get(`${API_URL}/api/teacher-courses/teacher-id/${user.id}`);
          setTeacherId(response.data.teacherId);
          fetchAssignedCourses(response.data.teacherId);
        }
      } catch (error) {
        console.error('Error al obtener ID del profesor:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo obtener la información del profesor'
        });
      }
    };
    
    const fetchCourses = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/courses`);
        setCourses(response.data);
      } catch (error) {
        console.error('Error al obtener cursos:', error);
      }
    };
    
    fetchTeacherId();
    fetchCourses();
  }, [user]);
  
  const fetchAssignedCourses = async (id) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/teacher-courses/teacher/${id}`);
      setAssignedCourses(response.data);
    } catch (error) {
      console.error('Error al obtener cursos asignados:', error);
      setAssignedCourses([]);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Sin fecha';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const handleAssignCourse = async () => {
    if (!selectedCourse) {
      Swal.fire({
        icon: 'warning',
        title: 'Selecciona un curso',
        text: 'Debes seleccionar un curso para asignarlo'
      });
      return;
    }
    
    try {
      await axios.post(`${API_URL}/api/teacher-courses`, {
        teacher_id: teacherId,
        course_id: parseInt(selectedCourse)
      });
      
      Swal.fire({
        icon: 'success',
        title: 'Curso asignado',
        text: 'El curso ha sido asignado correctamente'
      });
      
      fetchAssignedCourses(teacherId);
      setSelectedCourse('');
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error al asignar curso'
      });
    }
  };
  
  const handleEditCourse = (course) => {
    setEditingCourse(course);
    setEditSelectedCourse(course.course_id);
  };
  
  const handleUpdateCourse = async () => {
    if (!editSelectedCourse) {
      Swal.fire({
        icon: 'warning',
        title: 'Selecciona un curso',
        text: 'Debes seleccionar un curso'
      });
      return;
    }
    
    try {
      await axios.put(`${API_URL}/api/teacher-courses/${editingCourse.id}`, {
        course_id: parseInt(editSelectedCourse)
      });
      
      Swal.fire({
        icon: 'success',
        title: 'Curso actualizado',
        text: 'El curso ha sido actualizado correctamente'
      });
      
      fetchAssignedCourses(teacherId);
      setEditingCourse(null);
      setEditSelectedCourse('');
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error al actualizar curso'
      });
    }
  };
  
  const handleCancelEdit = () => {
    setEditingCourse(null);
    setEditSelectedCourse('');
  };
  
  const handleRemoveCourse = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Estás seguro?',
      text: 'Esta acción no se puede deshacer',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await axios.delete(`${API_URL}/api/teacher-courses/${id}`);
        
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'La asignación ha sido eliminada'
        });
        
        fetchAssignedCourses(teacherId);
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al eliminar la asignación'
        });
      }
    }
  };
  
  const handleFixDates = async () => {
    try {
      await axios.patch(`${API_URL}/api/teacher-courses/fix-dates`);
      
      Swal.fire({
        icon: 'success',
        title: 'Fechas actualizadas',
        text: 'Las fechas NULL han sido actualizadas'
      });
      
      fetchAssignedCourses(teacherId);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al actualizar fechas'
      });
    }
  };
  
  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Gestión de Cursos Asignados</h2>
        <button 
          className="btn btn-outline-secondary btn-sm"
          onClick={handleFixDates}
          title="Actualizar fechas NULL"
        >
          <RefreshCw size={16} className="me-1" />
          Actualizar Fechas
        </button>
      </div>
      
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">Asignar Nuevo Curso</h5>
        </div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-8">
              <label htmlFor="courseSelect" className="form-label">Seleccionar Curso</label>
              <select 
                id="courseSelect" 
                className="form-select"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
              >
                <option value="">Seleccionar curso...</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name} - Grado {course.grade}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <button 
                className="btn btn-primary w-100"
                onClick={handleAssignCourse}
              >
                <PlusCircle size={18} className="me-2" />
                Asignar Curso
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-header bg-info text-white">
          <h5 className="mb-0">Mis Cursos Asignados</h5>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-3">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : assignedCourses.length === 0 ? (
            <div className="alert alert-info">
              No tienes cursos asignados actualmente.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th>Grado</th>
                    <th>Fecha Asignación</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedCourses.map(course => (
                    <tr key={course.id}>
                      <td>
                        {editingCourse?.id === course.id ? (
                          <select 
                            className="form-select form-select-sm"
                            value={editSelectedCourse}
                            onChange={(e) => setEditSelectedCourse(e.target.value)}
                          >
                            <option value="">Seleccionar curso...</option>
                            {courses.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} - Grado {c.grade}
                              </option>
                            ))}
                          </select>
                        ) : (
                          course.course_name
                        )}
                      </td>
                      <td>
                        <span className="badge bg-primary">
                          Grado {course.grade}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <Calendar size={16} className="me-1 text-muted" />
                          {formatDate(course.assigned_date)}
                        </div>
                      </td>
                      <td className="text-end">
                        {editingCourse?.id === course.id ? (
                          <div className="btn-group" role="group">
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={handleUpdateCourse}
                            >
                              Guardar
                            </button>
                            <button 
                              className="btn btn-sm btn-secondary"
                              onClick={handleCancelEdit}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="btn-group" role="group">
                            <button 
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleEditCourse(course)}
                              title="Editar"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemoveCourse(course.id)}
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
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

export default TeacherCoursesManager;
