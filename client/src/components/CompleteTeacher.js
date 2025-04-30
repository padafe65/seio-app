import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const notiMySwal = withReactContent(Swal);


const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const CompletarDocente = () => {
  const userId = localStorage.getItem('user_id') || '';
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState({
    subject: '',
    institution: '',
    user_id: userId
  });

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
      await axios.post(`${API_URL}/api/teachers`, teacher);
      alert('Información de docente completada exitosamente.');
      await notiMySwal.fire({
        icon: 'success',
        title: 'Registro completo',
        html: `<i><strong>¡Bien hecho!</strong><br>Tu registro como docente ha sido completado con éxito. Ahora puedes iniciar sesión.</i>`,
        imageUrl: "img/profesor.gif",
        imageWidth: 100,
        imageHeight: 100,
        confirmButtonText: 'Ir al login',
        confirmButtonColor: '#3085d6'
      });

      // ✅ Limpiar el localStorage si es necesario
      localStorage.removeItem('user_id');

      // ✅ Redirigir al login
      navigate('/login');
    } catch (error) {
      console.error('Error al completar los datos:', error);
    }
  };

  return (
    <div className="container mt-5">
      <h2>Completar Datos de Docente</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="subject"
          placeholder="Asignatura"
          onChange={handleChange}
          className="form-control mb-2"
          required
        />
        <input
          type="text"
          name="institution"
          placeholder="Institución"
          onChange={handleChange}
          className="form-control mb-2"
          required
        />
        <button type="submit" className="btn btn-success">Guardar</button>
      </form>
    </div>
  );
};

export default CompletarDocente;
