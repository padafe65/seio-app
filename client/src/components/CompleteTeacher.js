import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
//import api from '../config/axios'; // ✨ AGREGADO: usar la instancia configurada de axios

const notiMySwal = withReactContent(Swal);


const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const CompletarDocente = () => {
  const userId = localStorage.getItem('user_id') || '';
  const navigate = useNavigate();
  const [instituciones, setInstituciones] = useState([]); // 👈 AGREGA ESTA LÍNEA
  const [teacher, setTeacher] = useState({
    subject: '',
    institution: '',
    user_id: userId
  });
  const [subjects, setSubjects] = useState([]); // Lista de materias disponibles
  const [categories, setCategories] = useState([]); // Categorías/subcategorías de la materia seleccionada
  const [loading, setLoading] = useState(true);

  // Cargar materias disponibles al montar el componente
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await axiosClient.get(`${API_URL}/api/subject-categories-list/subjects`);
        const subjectsList = response.data || [];
        // Extraer materias únicas
        const uniqueSubjects = [...new Set(subjectsList.map(s => s.subject))];
        setSubjects(uniqueSubjects);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar materias:', error);
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  // Cargar categorías automáticamente cuando se selecciona una materia
  useEffect(() => {
    const fetchCategories = async () => {
      if (!teacher.subject) {
        setCategories([]);
        return;
      }

      try {
        const response = await axiosClient.get(`${API_URL}/api/subject-categories/${encodeURIComponent(teacher.subject)}`);
        const categoriesList = response.data || [];
        setCategories(categoriesList);
        console.log(`📚 Categorías cargadas para ${teacher.subject}:`, categoriesList);
      } catch (error) {
        console.error('Error al cargar categorías:', error);
        setCategories([]);
      }
    };

    fetchCategories();
  }, [teacher.subject]);

  useEffect(() => {
  const loadInstitutions = async () => {
try {
      // Al usar axiosClient, automáticamente se envía el token y se usa la baseURL /api
      const response = await axiosClient.get('/admin/institutions/list');
      
      if (response.data && response.data.success) {
        setInstituciones(response.data.data);
      }
    } catch (error) {
      console.error("Error cargando instituciones:", error);
      // El interceptor de axiosClient ya manejará el redireccionamiento si el token expira
    }
  };
  loadInstitutions();
}, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTeacher({ ...teacher, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // ✅ Validar que user_id exista
    if (!teacher.user_id) {
      alert('Error: No se encontró el ID de usuario. Vuelve a iniciar sesión.');
      return;
    }
    try {
      // ✨ USAR api (que tiene baseURL y token configurado) en lugar de axios directo
      // api ya tiene baseURL: 'http://localhost:5000/api', así que solo usar '/teachers'
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      };
// ✅ Usa axiosClient que ya tienes importado arriba
      await axiosClient.post('/teachers', teacher);
      
      // Verificar si fue creado por admin
      const createdByAdmin = localStorage.getItem('created_by_admin') === 'true';
      
      // Limpiar localStorage
      localStorage.removeItem('user_id');
      localStorage.removeItem('created_by_admin');
      
      await notiMySwal.fire({
        icon: 'success',
        title: 'Registro completo',
        html: `<i><strong>¡Bien hecho!</strong><br>El registro del docente ha sido completado con éxito.</i>`,
        imageUrl: "img/profesor.gif",
        imageWidth: 100,
        imageHeight: 100,
        confirmButtonText: createdByAdmin ? 'Volver a usuarios' : 'Ir al login',
        confirmButtonColor: '#3085d6'
      });

      // ✅ Redirigir según el origen
      if (createdByAdmin) {
        navigate('/admin/users');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error al completar los datos:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando materias disponibles...</p>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="card">
        <div className="card-header bg-primary text-white">
          <h2 className="mb-0">Completar Datos de Docente</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="subject" className="form-label">
                Materia <span className="text-danger">*</span>
              </label>
              <select
                id="subject"
                name="subject"
                value={teacher.subject}
                onChange={handleChange}
                className="form-select"
                required
              >
                <option value="">Selecciona tu materia</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
              <small className="form-text text-muted">
                Selecciona la materia principal que vas a enseñar
              </small>
            </div>

            {/* Mostrar categorías disponibles cuando se selecciona una materia */}
            {teacher.subject && categories.length > 0 && (
              <div className="mb-3">
                <label className="form-label">Categorías/Subcategorías disponibles:</label>
                <div className="alert alert-info">
                  <strong>Tu materia "{teacher.subject}" incluye las siguientes categorías:</strong>
                  <ul className="mb-0 mt-2">
                    {categories.map((cat) => (
                      <li key={cat.id || cat.category}>
                        {cat.category}
                      </li>
                    ))}
                  </ul>
                  <small className="text-muted mt-2 d-block">
                    ⓘ Podrás crear contenido usando estas categorías. Solo los administradores pueden crear nuevas categorías.
                  </small>
                </div>
              </div>
            )}

            {teacher.subject && categories.length === 0 && (
              <div className="mb-3">
                <div className="alert alert-warning">
                  <strong>No hay categorías disponibles aún para "{teacher.subject}"</strong>
                  <p className="mb-0">
                    Un administrador deberá crear las categorías para tu materia. 
                    Mientras tanto, puedes completar tu registro.
                  </p>
                </div>
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="institution" className="form-label">
                Institución <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="institution"
                name="institution"
                value={teacher.institution}
                onChange={handleChange}
                className="form-control"
                required
                list="institutions-db-list" // ✨ Esto conecta con el ID de abajo
              />

              <datalist id="institutions-db-list">
                {instituciones.map((inst, index) => (
                  <option key={index} value={inst} />
                ))}
              </datalist>
              <small className="form-text text-muted">
                Institución educativa donde trabajas
              </small>
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

export default CompletarDocente;
