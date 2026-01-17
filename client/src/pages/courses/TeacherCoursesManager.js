// pages/courses/TeacherCoursesManager.js
import React, { useState, useEffect } from 'react';
import axios from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { Trash2, PlusCircle, Edit3, Calendar, RefreshCw, Award, Building2, User } from 'lucide-react';
import Swal from 'sweetalert2';

const TeacherCoursesManager = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedRole, setSelectedRole] = useState('co-docente');
  const [teacherId, setTeacherId] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [editingCourse, setEditingCourse] = useState(null);
  const [editSelectedCourse, setEditSelectedCourse] = useState('');
  const [editSelectedTeacher, setEditSelectedTeacher] = useState('');
  const [editSelectedRole, setEditSelectedRole] = useState('');
  
  const isSuperAdminOrAdmin = user?.role === 'super_administrador' || user?.role === 'administrador';
  
  useEffect(() => {
    const fetchTeacherId = async () => {
      try {
        if (user && !isSuperAdminOrAdmin) {
          // Si es docente, obtener su teacher_id
          const response = await axios.get(`/teacher-courses/teacher-id/${user.id}`);
          setTeacherId(response.data.teacherId);
          setSelectedTeacher(response.data.teacherId.toString());
          fetchAssignedCourses(response.data.teacherId);
        } else if (isSuperAdminOrAdmin && selectedTeacher) {
          // Si es super admin/admin y hay un docente seleccionado
          fetchAssignedCourses(parseInt(selectedTeacher));
        } else if (isSuperAdminOrAdmin && teachers.length > 0 && !selectedTeacher) {
          // Si es super admin/admin y hay docentes pero no se ha seleccionado ninguno
          // No cargar cursos hasta que se seleccione un docente
          setLoading(false);
        }
      } catch (error) {
        console.error('Error al obtener ID del profesor:', error);
        if (!isSuperAdminOrAdmin) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo obtener la información del profesor'
          });
        }
      }
    };
    
    const fetchCourses = async () => {
      try {
        const response = await axios.get('/courses');
        setCourses(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error al obtener cursos:', error);
      }
    };
    
    const fetchTeachers = async () => {
      if (isSuperAdminOrAdmin) {
        try {
          const response = await axios.get('/teachers/list/all');
          setTeachers(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
          console.error('Error al obtener docentes:', error);
        }
      }
    };
    
    fetchCourses();
    fetchTeachers();
    fetchTeacherId();
  }, [user, selectedTeacher, isSuperAdminOrAdmin]);
  
  const fetchAssignedCourses = async (id) => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`/teacher-courses/teacher/${id}`);
      setAssignedCourses(Array.isArray(response.data) ? response.data : []);
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
  
  const getRoleLabel = (role) => {
    if (!role) return 'Co-docente';
    const labels = {
      'principal': 'Principal / Director de Grupo',
      'tutor': 'Tutor',
      'co-docente': 'Co-docente',
      'reemplazo': 'Reemplazo'
    };
    return labels[role] || role;
  };
  
  const getRoleBadgeColor = (role) => {
    if (!role) return 'secondary';
    const colors = {
      'principal': 'primary',
      'tutor': 'info',
      'co-docente': 'secondary',
      'reemplazo': 'warning'
    };
    return colors[role] || 'secondary';
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
    
    const targetTeacherId = isSuperAdminOrAdmin ? parseInt(selectedTeacher) : teacherId;
    
    if (!targetTeacherId) {
      Swal.fire({
        icon: 'warning',
        title: 'Selecciona un docente',
        text: 'Debes seleccionar un docente para asignar el curso'
      });
      return;
    }
    
    try {
      const payload = {
        teacher_id: targetTeacherId,
        course_id: parseInt(selectedCourse)
      };
      
      // Agregar role si es super admin y se seleccionó
      if (isSuperAdminOrAdmin && selectedRole) {
        payload.role = selectedRole;
      }
      
      await axios.post('/teacher-courses', payload);
      
      Swal.fire({
        icon: 'success',
        title: 'Curso asignado',
        text: `El curso ha sido asignado ${isSuperAdminOrAdmin ? 'al docente seleccionado' : ''} correctamente`
      });
      
      fetchAssignedCourses(targetTeacherId);
      setSelectedCourse('');
      if (isSuperAdminOrAdmin) {
        setSelectedRole('co-docente');
      }
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
    setEditSelectedCourse(course.course_id.toString());
    setEditSelectedTeacher(course.teacher_id.toString());
    setEditSelectedRole(course.role || 'co-docente');
  };
  
  const handleUpdateCourse = async () => {
    if (!editSelectedCourse || !editSelectedTeacher) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Debes seleccionar un curso y un docente'
      });
      return;
    }
    
    try {
      const payload = {
        course_id: parseInt(editSelectedCourse),
        teacher_id: parseInt(editSelectedTeacher)
      };
      
      // Agregar role si existe y se seleccionó
      if (editSelectedRole) {
        payload.role = editSelectedRole;
      }
      
      await axios.put(`/teacher-courses/${editingCourse.id}`, payload);
      
      Swal.fire({
        icon: 'success',
        title: 'Curso actualizado',
        text: 'El curso ha sido actualizado correctamente'
      });
      
      fetchAssignedCourses(parseInt(editSelectedTeacher));
      setEditingCourse(null);
      setEditSelectedCourse('');
      setEditSelectedTeacher('');
      setEditSelectedRole('');
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
    setEditSelectedTeacher('');
    setEditSelectedRole('');
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
        await axios.delete(`/teacher-courses/${id}`);
        
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'La asignación ha sido eliminada'
        });
        
        const targetTeacherId = isSuperAdminOrAdmin ? parseInt(selectedTeacher) : teacherId;
        if (targetTeacherId) {
          fetchAssignedCourses(targetTeacherId);
        }
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
      await axios.patch('/teacher-courses/fix-dates');
      
      Swal.fire({
        icon: 'success',
        title: 'Fechas actualizadas',
        text: 'Las fechas NULL han sido actualizadas'
      });
      
      const targetTeacherId = isSuperAdminOrAdmin ? parseInt(selectedTeacher) : teacherId;
      if (targetTeacherId) {
        fetchAssignedCourses(targetTeacherId);
      }
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
        <h2 className="mb-0">
          {isSuperAdminOrAdmin ? 'Gestión de Cursos Asignados a Docentes' : 'Gestión de Mis Cursos Asignados'}
        </h2>
        <button 
          className="btn btn-outline-secondary btn-sm"
          onClick={handleFixDates}
          title="Actualizar fechas NULL"
        >
          <RefreshCw size={16} className="me-1" />
          Actualizar Fechas
        </button>
      </div>
      
      {/* Selector de docente para Super Admin/Admin */}
      {isSuperAdminOrAdmin && (
        <div className="card mb-4">
          <div className="card-header bg-secondary text-white">
            <h5 className="mb-0">
              <User size={18} className="me-2" />
              Seleccionar Docente
            </h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <label htmlFor="teacherSelect" className="form-label">Docente</label>
                <select 
                  id="teacherSelect" 
                  className="form-select"
                  value={selectedTeacher}
                  onChange={(e) => {
                    setSelectedTeacher(e.target.value);
                    if (e.target.value) {
                      fetchAssignedCourses(parseInt(e.target.value));
                    } else {
                      setAssignedCourses([]);
                    }
                  }}
                >
                  <option value="">Seleccionar docente...</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.subject || 'Sin materia'}
                    </option>
                  ))}
                </select>
                <small className="text-muted">
                  Selecciona un docente para ver y gestionar sus cursos asignados
                </small>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">
            <PlusCircle size={18} className="me-2" />
            Asignar Nuevo Curso
          </h5>
        </div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            {isSuperAdminOrAdmin && (
              <div className="col-md-4">
                <label htmlFor="teacherSelectAssign" className="form-label">Docente</label>
                <select 
                  id="teacherSelectAssign" 
                  className="form-select"
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                >
                  <option value="">Seleccionar docente...</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.subject || 'Sin materia'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={isSuperAdminOrAdmin ? "col-md-5" : "col-md-8"}>
              <label htmlFor="courseSelect" className="form-label">Curso</label>
              <select 
                id="courseSelect" 
                className="form-select"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
              >
                <option value="">Seleccionar curso...</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name} - Grado {course.grade} {course.institution ? `(${course.institution})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {isSuperAdminOrAdmin && (
              <div className="col-md-2">
                <label htmlFor="roleSelect" className="form-label">Rol</label>
                <select 
                  id="roleSelect" 
                  className="form-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="co-docente">Co-docente</option>
                  <option value="principal">Principal</option>
                  <option value="tutor">Tutor</option>
                  <option value="reemplazo">Reemplazo</option>
                </select>
              </div>
            )}
            <div className={isSuperAdminOrAdmin ? "col-md-1" : "col-md-4"}>
              <button 
                className="btn btn-primary w-100"
                onClick={handleAssignCourse}
                disabled={!selectedCourse || (isSuperAdminOrAdmin && !selectedTeacher)}
              >
                <PlusCircle size={18} className="me-2" />
                Asignar
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-header bg-info text-white">
          <h5 className="mb-0">
            {isSuperAdminOrAdmin ? 'Cursos Asignados al Docente Seleccionado' : 'Mis Cursos Asignados'}
          </h5>
        </div>
        <div className="card-body">
          {isSuperAdminOrAdmin && !selectedTeacher ? (
            <div className="alert alert-info">
              <User size={18} className="me-2" />
              Selecciona un docente para ver sus cursos asignados
            </div>
          ) : loading ? (
            <div className="text-center py-3">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : assignedCourses.length === 0 ? (
            <div className="alert alert-info">
              {isSuperAdminOrAdmin ? 'El docente seleccionado no tiene cursos asignados actualmente.' : 'No tienes cursos asignados actualmente.'}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th>Grado</th>
                    {isSuperAdminOrAdmin && <th>Institución</th>}
                    {isSuperAdminOrAdmin && <th>Rol</th>}
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
                      {isSuperAdminOrAdmin && (
                        <td>
                          {course.institution ? (
                            <span className="d-flex align-items-center">
                              <Building2 size={16} className="me-1 text-muted" />
                              {course.institution}
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      )}
                      {isSuperAdminOrAdmin && (
                        <td>
                          {editingCourse?.id === course.id ? (
                            <select 
                              className="form-select form-select-sm"
                              value={editSelectedRole}
                              onChange={(e) => setEditSelectedRole(e.target.value)}
                            >
                              <option value="co-docente">Co-docente</option>
                              <option value="principal">Principal</option>
                              <option value="tutor">Tutor</option>
                              <option value="reemplazo">Reemplazo</option>
                            </select>
                          ) : (
                            <span className={`badge bg-${getRoleBadgeColor(course.role)}`}>
                              {course.role === 'principal' && <Award size={14} className="me-1" />}
                              {getRoleLabel(course.role)}
                            </span>
                          )}
                        </td>
                      )}
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
