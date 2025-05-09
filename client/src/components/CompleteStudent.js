import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const notiMySwal = withReactContent(Swal);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const CompletarEstudiante = () => {
  const navigate = useNavigate();
  // Buscar primero en temp_user_id (registro por docente) y luego en user_id (registro normal)
  const userId = localStorage.getItem('temp_user_id') || localStorage.getItem('user_id') || '';

  const [student, setStudent] = useState({
    contact_phone: '',
    contact_email: '',
    age: '',
    grade: '',
    course_id: '',
    user_id: userId
  });
  

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar la lista de cursos al montar el componente
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/courses`);
        setCourses(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar los cursos:', error);
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStudent({ ...student, [name]: value });
  };

  // En CompleteStudent.js, modificar el handleSubmit:
// En CompleteStudent.js
const handleSubmit = async (e) => {
  // ... código existente ...

  try {
    await axios.post(`${API_URL}/api/students`, student);

    // Mensaje de éxito
    await notiMySwal.fire({
      icon: 'success',
      title: 'Registro completo',
      html: `<i><strong>¡Bien hecho!</strong><br>Tu registro como estudiante ha sido completado con éxito.</i>`,
      imageUrl: "img/estudiante.gif",
      imageWidth: 100,
      imageHeight: 100,
      confirmButtonText: 'Continuar',
      confirmButtonColor: '#3085d6'
    });

    // Limpiar localStorage
    localStorage.removeItem('user_id');
    localStorage.removeItem('temp_user_id');
    
    // Verificar si fue registro por docente
    const isTeacherRegistration = localStorage.getItem('is_teacher_registration') === 'true';
    localStorage.removeItem('is_teacher_registration');
    
    // Redirigir según el caso
    if (isTeacherRegistration) {
      navigate('/estudiantes'); // Volver a la lista de estudiantes
    } else {
      navigate('/'); // Ir al login
    }

  } catch (error) {
    // ... manejo de errores ...
  }
};



  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando cursos disponibles...</p>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="card">
        <div className="card-header bg-primary text-white">
          <h2 className="mb-0">Completar Datos de Estudiante</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="contact_phone" className="form-label">Teléfono de contacto</label>
              <input
                type="text"
                id="contact_phone"
                name="contact_phone"
                placeholder="Ej: 3168564142"
                onChange={handleChange}
                className="form-control"
                required
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="contact_email" className="form-label">Correo de contacto</label>
              <input
                type="email"
                id="contact_email"
                name="contact_email"
                placeholder="correo@ejemplo.com"
                onChange={handleChange}
                className="form-control"
                required
              />
            </div>
            
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="age" className="form-label">Edad</label>
                <input
                  type="number"
                  id="age"
                  name="age"
                  placeholder="Ej: 14"
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>
              
              <div className="col-md-6">
                <label htmlFor="grade" className="form-label">Grado</label>
                <select
                  id="grade"
                  name="grade"
                  onChange={handleChange}
                  className="form-select"
                  required
                >
                  <option value="">Selecciona un grado</option>
                  <option value="7">7°</option>
                  <option value="8">8°</option>
                  <option value="9">9°</option>
                  <option value="10">10°</option>
                  <option value="11">11°</option>
                </select>
              </div>
            </div>
            
            <div className="mb-3">
              <label htmlFor="course_id" className="form-label">Curso</label>
              <select
                id="course_id"
                name="course_id"
                onChange={handleChange}
                className="form-select"
                required
              >
                <option value="">Selecciona un curso</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-success">
                Guardar y Completar Registro
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/')}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompletarEstudiante;
