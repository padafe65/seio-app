import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import api from '../config/axios'; // ✨ AGREGADO: usar la instancia configurada de axios

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
      // ✨ USAR api (que tiene baseURL y token configurado) en lugar de axios directo
      // api ya tiene baseURL: 'http://localhost:5000/api', así que solo usar '/teachers'
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      };
      await api.post('/teachers', teacher, config);
      
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
