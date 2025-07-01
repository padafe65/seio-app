import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const StudentForm = ({ isViewMode = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]); // Nuevo estado para profesores
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    contact_email: '',
    contact_phone: '',
    age: '',
    grade: '',
    course_id: '',
    teacher_id: '' // Nuevo campo para el profesor
  });

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/courses`);
        setCourses(response.data);
      } catch (error) {
        console.error('Error al cargar cursos:', error);
      }
    };

    const fetchTeachers = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/teachers/list`);
        setTeachers(response.data);
      } catch (error) {
        console.error('Error al cargar profesores:', error);
      }
    };

    const fetchStudentData = async () => {
      if (id) {
        try {
          const response = await axios.get(`${API_URL}/api/students/${id}`);
          const student = response.data;
          
          // También obtener el profesor asignado si existe
          const teacherResponse = await axios.get(`${API_URL}/api/teacher/student-teacher/${id}`);
          const teacherId = teacherResponse.data.teacher_id || '';
          
          setFormData({
            name: student.name || '',
            phone: student.phone || '',
            email: student.email || '',
            contact_email: student.contact_email || '',
            contact_phone: student.contact_phone || '',
            age: student.age || '',
            grade: student.grade || '',
            course_id: student.course_id || '',
            teacher_id: teacherId
          });
        } catch (error) {
          console.error('Error al cargar datos del estudiante:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información del estudiante'
          });
        }
      }
    };

    Promise.all([fetchCourses(), fetchTeachers(), id ? fetchStudentData() : Promise.resolve()])
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      console.log("Enviando datos:", formData);

      if (!id) {
        // CREAR: Enviar todos los datos a la ruta de creación de estudiantes.
        // El backend se encargará de crear el usuario y el estudiante en una sola transacción.
        const response = await axios.post(`${API_URL}/api/students`, formData);
        console.log("Respuesta de creación:", response.data);

        Swal.fire({
          icon: 'success',
          title: 'Creado',
          text: 'Estudiante creado correctamente'
        });

        navigate('/estudiantes');
      } else {
        // ACTUALIZAR: La lógica de actualización ya es correcta.
        const response = await axios.put(`${API_URL}/api/students/${id}`, formData);
        console.log("Respuesta de actualización:", response.data);

        Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: 'Estudiante actualizado correctamente'
        });

        navigate('/estudiantes');
      }
    } catch (error) {
      console.error('Error completo:', error);

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Hubo un problema al guardar los datos'
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
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">
            {isViewMode 
              ? 'Detalles del Estudiante' 
              : id 
                ? 'Editar Estudiante' 
                : 'Registrar Nuevo Estudiante'}
          </h5>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="name" className="form-label">Nombre completo</label>
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
              
              <div className="col-md-6 mb-3">
                <label htmlFor="contact_email" className="form-label">Correo electrónico contacto</label>
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
            </div>
            
            <div className="row">

              <div className="col-md-6 mb-3">
                              <label htmlFor="phone" className="form-label">Teléfono estudiante</label>
                              <input
                                type="text"
                                className="form-control"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                disabled={isViewMode}
                              />
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="contact_phone" className="form-label">Teléfono de contacto</label>
                <input
                  type="text"
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
                <label htmlFor="email" className="form-label">Correo electrónico estudiante</label>
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
            </div>
            
            <div className="row">
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
                  <option value="">Seleccionar grado</option>
                  <option value="7">7°</option>
                  <option value="8">8°</option>
                  <option value="9">9°</option>
                  <option value="10">10°</option>
                  <option value="11">11°</option>
                </select>
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="course_id" className="form-label">Curso</label>
                <select
                  className="form-select"
                  id="course_id"
                  name="course_id"
                  value={formData.course_id}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
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
            
            {/* Nuevo selector de profesor */}
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="teacher_id" className="form-label">Profesor</label>
                <select
                  className="form-select"
                  id="teacher_id"
                  name="teacher_id"
                  value={formData.teacher_id}
                  onChange={handleChange}
                  required
                  disabled={isViewMode}
                >
                  <option value="">Seleccionar profesor</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.subject}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {!isViewMode && (
              <div className="d-flex justify-content-end mt-4">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary me-2"
                  onClick={() => navigate('/estudiantes')}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {id ? 'Actualizar' : 'Registrar'}
                </button>
              </div>
            )}
            
            {isViewMode && (
              <div className="d-flex justify-content-end mt-4">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary me-2"
                  onClick={() => navigate('/estudiantes')}
                >
                  Volver
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => navigate(`/estudiantes/editar/${id}`)}
                >
                  Editar
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentForm;
