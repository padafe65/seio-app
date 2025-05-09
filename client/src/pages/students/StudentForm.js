// pages/students/StudentForm.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const StudentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = !!id;
  const isViewMode = location.state?.viewMode || false;
  const isTeacherRegistration = localStorage.getItem('is_teacher_registration') === 'true';
  
  const [formData, setFormData] = useState({
    // Datos de la tabla users
    name: '',
    email: '',
    phone: '',
    role: 'estudiante',
    // Datos de la tabla students
    contact_email: '',
    contact_phone: '',
    age: '',
    grade: '',
    course_id: '',
    // Campo adicional para mostrar el nombre del curso
    course_name: ''
  });
  
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/courses`);
        setCourses(response.data);
      } catch (error) {
        console.error('Error al cargar cursos:', error);
        setError('No se pudieron cargar los cursos. Por favor, intenta de nuevo.');
      }
    };
    
    fetchCourses();
    
    if (isEditing) {
      const fetchStudent = async () => {
        try {
          const response = await axios.get(`${API_URL}/api/students/${id}`);
          const studentData = response.data;
          
          setFormData({
            // Datos de la tabla users
            name: studentData.name || '',
            email: studentData.email || '',
            phone: studentData.phone || '',
            role: studentData.role || 'estudiante',
            // Datos de la tabla students
            contact_email: studentData.contact_email || '',
            contact_phone: studentData.contact_phone || '',
            age: studentData.age || '',
            grade: studentData.grade || '',
            course_id: studentData.course_id || '',
            // Campo adicional
            course_name: studentData.course_name || ''
          });
          
          setLoading(false);
        } catch (error) {
          console.error('Error al cargar estudiante:', error);
          setError('No se pudo cargar la información del estudiante. Por favor, intenta de nuevo.');
          setLoading(false);
        }
      };
      
      fetchStudent();
    } else {
      setLoading(false);
    }
  }, [id, isEditing, API_URL]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      if (isEditing) {
        // Actualizar estudiante existente
        await axios.put(`${API_URL}/api/students/${id}`, {
          // Datos para actualizar en la tabla users
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          // Datos para actualizar en la tabla students
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone,
          age: formData.age,
          grade: formData.grade,
          course_id: formData.course_id
        });
        
        alert('Estudiante actualizado correctamente');
        navigate('/estudiantes');
      } else {
        // Crear nuevo estudiante (registro por docente)
        const userResponse = await axios.post(`${API_URL}/api/auth/register`, {
          name: formData.name,
          phone: formData.contact_phone,
          email: formData.contact_email,
          password: "password123", // Contraseña temporal que el estudiante deberá cambiar
          role: "estudiante"
        });
        
        // Guardar datos adicionales del estudiante
        await axios.post(`${API_URL}/api/students`, {
          user_id: userResponse.data.user.id,
          contact_phone: formData.contact_phone,
          contact_email: formData.contact_email,
          age: formData.age,
          grade: formData.grade,
          course_id: formData.course_id
        });
        
        alert('Estudiante registrado correctamente');
        navigate('/estudiantes');
      }
    } catch (error) {
      console.error('Error al procesar estudiante:', error);
      setError(`Error al ${isEditing ? 'actualizar' : 'crear'} el estudiante: ${error.response?.data?.message || error.message}`);
      setSubmitting(false);
    }
  };
  
  const handleEditMode = () => {
    // Cambiar de modo visualización a modo edición
    navigate(`/estudiantes/${id}/editar`);
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
        {isViewMode ? 'Detalles del Estudiante' : isEditing ? 'Editar Estudiante' : 'Nuevo Estudiante'}
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
              {/* Datos básicos del estudiante */}
              <div className="col-md-6 mb-3">
                <label htmlFor="name" className="form-label">Nombre Completo</label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                />
              </div>
              
              {/* Mostrar email de usuario solo en modo edición o visualización */}
              {(isEditing || isViewMode) && (
                <div className="col-md-6 mb-3">
                  <label htmlFor="email" className="form-label">Correo de Usuario</label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isViewMode}
                  />
                </div>
              )}
              
              <div className="col-md-6 mb-3">
                <label htmlFor="contact_email" className="form-label">Correo de Contacto</label>
                <input
                  type="email"
                  className="form-control"
                  id="contact_email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                />
              </div>
              
              {/* Mostrar teléfono de usuario solo en modo edición o visualización */}
              {(isEditing || isViewMode) && (
                <div className="col-md-6 mb-3">
                  <label htmlFor="phone" className="form-label">Teléfono de Usuario</label>
                  <input
                    type="tel"
                    className="form-control"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={isViewMode}
                  />
                </div>
              )}
              
              <div className="col-md-6 mb-3">
                <label htmlFor="contact_phone" className="form-label">Teléfono de Contacto</label>
                <input
                  type="tel"
                  className="form-control"
                  id="contact_phone"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                />
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="age" className="form-label">Edad</label>
                <input
                  type="number"
                  className="form-control"
                  id="age"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                />
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="grade" className="form-label">Grado</label>
                <select
                  className="form-select"
                  id="grade"
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                >
                  <option value="">Seleccionar Grado</option>
                  <option value="7">7°</option>
                  <option value="8">8°</option>
                  <option value="9">9°</option>
                  <option value="10">10°</option>
                  <option value="11">11°</option>
                </select>
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="course_id" className="form-label">Curso</label>
                {isViewMode ? (
                  <input
                    type="text"
                    className="form-control"
                    value={formData.course_name}
                    disabled
                  />
                ) : (
                  <select
                    className="form-select"
                    id="course_id"
                    name="course_id"
                    value={formData.course_id}
                    onChange={handleChange}
                    required
                    disabled={isViewMode}
                  >
                    <option value="">Seleccionar Curso</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              {/* Campos adicionales para estudiantes registrados por docentes */}
              {!isEditing && !isViewMode && (
                <div className="col-12 mb-3">
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    Este estudiante será registrado con una contraseña temporal que deberá cambiar en su primer inicio de sesión.
                  </div>
                </div>
              )}
            </div>
            
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate('/estudiantes')}
                disabled={submitting}
              >
                {isViewMode ? 'Volver' : 'Cancelar'}
              </button>
              
              {isViewMode ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleEditMode}
                >
                  Editar Estudiante
                </button>
              ) : (
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
                    isEditing ? 'Actualizar Estudiante' : 'Guardar Estudiante'
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentForm;
