// pages/courses/CourseForm.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';
import { Plus, Trash2, User, Award } from 'lucide-react';

const CourseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;
  
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    grade: '',
    institution: '',
    teacher_id: ''
  });
  
  const [teachers, setTeachers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [assignedTeachers, setAssignedTeachers] = useState([]); // Lista de docentes asignados
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newTeacherRole, setNewTeacherRole] = useState('co-docente');
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!user || user.role !== 'super_administrador') {
      navigate('/dashboard');
      return;
    }
    
    fetchTeachers();
    fetchInstitutions();
    
    if (isEditing) {
      fetchCourse();
      fetchAssignedTeachers();
    } else {
      setLoading(false);
    }
  }, [id, user, navigate]);
  
  const fetchCourse = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/courses');
      const allCourses = Array.isArray(response.data) ? response.data : [];
      const course = allCourses.find(c => c.id === parseInt(id));
      
      if (!course) {
        Swal.fire({
          icon: 'error',
          title: 'Curso no encontrado',
          text: 'El curso que intentas editar no existe'
        });
        navigate('/cursos');
        return;
      }
      
      setFormData({
        name: course.name || '',
        grade: course.grade?.toString() || '',
        institution: course.institution || '',
        teacher_id: course.teacher_id ? course.teacher_id.toString() : ''
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error al cargar curso:', err);
      setError('No se pudo cargar el curso');
      setLoading(false);
    }
  };
  
  const fetchAssignedTeachers = async () => {
    if (!id) return;
    
    try {
      const response = await axios.get(`/courses/${id}/teachers`);
      setAssignedTeachers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error al cargar docentes asignados:', err);
      // Si el endpoint no existe aún, no mostrar error
      if (err.response?.status !== 404) {
        setAssignedTeachers([]);
      }
    }
  };
  
  const fetchTeachers = async () => {
    try {
      const response = await axios.get('/teachers/list/all');
      setTeachers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error al cargar docentes:', err);
    }
  };
  
  const fetchInstitutions = async () => {
    try {
      const response = await axios.get('/admin/users');
      const users = response.data.data || response.data || [];
      const uniqueInstitutions = [...new Set(users.map(u => u.institution).filter(Boolean))];
      setInstitutions(uniqueInstitutions.sort());
    } catch (err) {
      console.error('Error al cargar instituciones:', err);
    }
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleAddTeacher = async () => {
    if (!newTeacherId) {
      Swal.fire({
        icon: 'warning',
        title: 'Selecciona un docente',
        text: 'Debes seleccionar un docente para agregarlo'
      });
      return;
    }
    
    try {
      await axios.post(`/courses/${id}/teachers`, {
        teacher_id: parseInt(newTeacherId),
        role: newTeacherRole
      });
      
      await fetchAssignedTeachers();
      setNewTeacherId('');
      setNewTeacherRole('co-docente');
      setShowAddTeacher(false);
      
      Swal.fire({
        icon: 'success',
        title: 'Docente agregado',
        text: 'El docente ha sido agregado al curso exitosamente'
      });
    } catch (err) {
      console.error('Error al agregar docente:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'No se pudo agregar el docente'
      });
    }
  };
  
  const handleRemoveTeacher = async (teacherId, teacherName) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar docente?',
      html: `¿Estás seguro de que deseas eliminar a <b>${teacherName}</b> de este curso?`,
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await axios.delete(`/courses/${id}/teachers/${teacherId}`);
        await fetchAssignedTeachers();
        
        Swal.fire({
          icon: 'success',
          title: 'Docente eliminado',
          text: 'El docente ha sido eliminado del curso exitosamente'
        });
      } catch (err) {
        console.error('Error al eliminar docente:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.response?.data?.message || 'No se pudo eliminar el docente'
        });
      }
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.grade) {
      Swal.fire({
        icon: 'error',
        title: 'Campos obligatorios',
        text: 'El nombre y el grado son obligatorios'
      });
      return;
    }
    
    try {
      const courseData = {
        name: formData.name.trim(),
        grade: parseInt(formData.grade),
        institution: formData.institution || null,
        teacher_id: formData.teacher_id ? parseInt(formData.teacher_id) : null
      };
      
      if (isEditing) {
        await axios.put(`/courses/${id}`, courseData);
        await fetchAssignedTeachers(); // Recargar docentes después de actualizar
        Swal.fire({
          icon: 'success',
          title: 'Curso actualizado',
          text: 'El curso ha sido actualizado exitosamente'
        });
      } else {
        const response = await axios.post('/courses', courseData);
        Swal.fire({
          icon: 'success',
          title: 'Curso creado',
          text: 'El curso ha sido creado exitosamente'
        });
        // Si se creó con docente principal, recargar docentes asignados
        if (response.data.data?.id) {
          navigate(`/cursos/${response.data.data.id}/editar`);
        } else {
          navigate('/cursos');
        }
      }
    } catch (err) {
      console.error('Error al guardar curso:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'No se pudo guardar el curso'
      });
    }
  };
  
  const getRoleLabel = (role) => {
    const labels = {
      'principal': 'Principal / Director de Grupo',
      'tutor': 'Tutor',
      'co-docente': 'Co-docente',
      'reemplazo': 'Reemplazo'
    };
    return labels[role] || role || 'Co-docente';
  };
  
  const getRoleBadgeColor = (role) => {
    const colors = {
      'principal': 'primary',
      'tutor': 'info',
      'co-docente': 'secondary',
      'reemplazo': 'warning'
    };
    return colors[role] || 'secondary';
  };
  
  // Filtrar docentes que ya están asignados
  const availableTeachers = teachers.filter(teacher => 
    !assignedTeachers.some(at => at.teacher_id === teacher.id)
  );
  
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
        {error}
      </div>
    );
  }
  
  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{isEditing ? 'Editar Curso' : 'Nuevo Curso'}</h5>
          <button
            type="button"
            className="btn btn-light btn-sm"
            onClick={() => navigate('/cursos')}
          >
            Volver
          </button>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="name" className="form-label">
                  Nombre del Curso <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Matemáticas 10°"
                />
              </div>
              
              <div className="col-md-6">
                <label htmlFor="grade" className="form-label">
                  Grado <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  id="grade"
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
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
            </div>
            
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="institution" className="form-label">
                  Institución
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="institution"
                  name="institution"
                  value={formData.institution}
                  onChange={handleChange}
                  list="institutions-list"
                  placeholder="Escribir o seleccionar institución"
                />
                <datalist id="institutions-list">
                  {institutions.map((inst, idx) => (
                    <option key={idx} value={inst} />
                  ))}
                </datalist>
              </div>
              
              <div className="col-md-6">
                <label htmlFor="teacher_id" className="form-label">
                  Docente Principal / Tutor / Director de Grupo
                </label>
                <select
                  className="form-select"
                  id="teacher_id"
                  name="teacher_id"
                  value={formData.teacher_id}
                  onChange={handleChange}
                >
                  <option value="">Seleccionar docente principal (opcional)</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.subject || 'Sin materia'}
                    </option>
                  ))}
                </select>
                <small className="form-text text-muted">
                  El docente principal será automáticamente asignado al curso con role 'principal'
                </small>
              </div>
            </div>
            
            {/* Sección de docentes adicionales (solo en edición) */}
            {isEditing && (
              <div className="mb-4 p-3 border rounded">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">
                    <User size={18} className="me-2" />
                    Docentes Asignados al Curso
                  </h6>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setShowAddTeacher(!showAddTeacher)}
                  >
                    {showAddTeacher ? <span>Cancelar</span> : <><Plus size={16} className="me-1" /> Agregar Docente</>}
                  </button>
                </div>
                
                {/* Lista de docentes asignados */}
                {assignedTeachers.length > 0 ? (
                  <div className="table-responsive mb-3">
                    <table className="table table-sm table-hover">
                      <thead>
                        <tr>
                          <th>Docente</th>
                          <th>Materia</th>
                          <th>Rol</th>
                          <th>Fecha Asignación</th>
                          <th className="text-end">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedTeachers.map((teacher) => (
                          <tr key={teacher.id}>
                            <td>{teacher.teacher_name}</td>
                            <td>{teacher.subject || '-'}</td>
                            <td>
                              <span className={`badge bg-${getRoleBadgeColor(teacher.role)}`}>
                                {teacher.role === 'principal' && <Award size={14} className="me-1" />}
                                {getRoleLabel(teacher.role)}
                              </span>
                            </td>
                            <td>
                              {teacher.assigned_date 
                                ? new Date(teacher.assigned_date).toLocaleDateString()
                                : '-'}
                            </td>
                            <td className="text-end">
                              {teacher.role === 'principal' ? (
                                <small className="text-muted">No se puede eliminar</small>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleRemoveTeacher(teacher.teacher_id, teacher.teacher_name)}
                                  title="Eliminar docente"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="alert alert-info mb-3">
                    No hay docentes asignados a este curso. Agrega docentes usando el botón "Agregar Docente".
                  </div>
                )}
                
                {/* Formulario para agregar docente adicional */}
                {showAddTeacher && (
                  <div className="p-3 bg-light rounded">
                    <h6 className="mb-3">Agregar Docente Adicional</h6>
                    <div className="row g-3">
                      <div className="col-md-5">
                        <label htmlFor="newTeacherId" className="form-label">Docente</label>
                        <select
                          className="form-select"
                          id="newTeacherId"
                          value={newTeacherId}
                          onChange={(e) => setNewTeacherId(e.target.value)}
                        >
                          <option value="">Seleccionar docente</option>
                          {availableTeachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.name} - {teacher.subject || 'Sin materia'}
                            </option>
                          ))}
                        </select>
                        {availableTeachers.length === 0 && (
                          <small className="text-muted">
                            Todos los docentes disponibles ya están asignados
                          </small>
                        )}
                      </div>
                      <div className="col-md-4">
                        <label htmlFor="newTeacherRole" className="form-label">Rol</label>
                        <select
                          className="form-select"
                          id="newTeacherRole"
                          value={newTeacherRole}
                          onChange={(e) => setNewTeacherRole(e.target.value)}
                        >
                          <option value="co-docente">Co-docente</option>
                          <option value="reemplazo">Reemplazo</option>
                          <option value="tutor">Tutor</option>
                        </select>
                      </div>
                      <div className="col-md-3 d-flex align-items-end">
                        <button
                          type="button"
                          className="btn btn-primary w-100"
                          onClick={handleAddTeacher}
                          disabled={!newTeacherId}
                        >
                          <Plus size={16} className="me-1" /> Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/cursos')}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                {isEditing ? 'Actualizar Curso' : 'Crear Curso'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CourseForm;
