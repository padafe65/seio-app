import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const notiMySwal = withReactContent(Swal);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const CompletarEstudiante = () => {
  const navigate = useNavigate();
  const userId = localStorage.getItem('user_id') || '';

  const [student, setStudent] = useState({
    contact_phone: '',
    contact_email: '',
    age: '',
    grade: '',
    user_id: userId
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStudent({ ...student, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!student.user_id) {
      alert('Error: No se encontró el ID de usuario. Vuelve a iniciar sesión.');
      return;
    }

    try {
      await axios.post(`${API_URL}/api/students`, student);

      // ✅ Mensaje de éxito y redirección al login
      await notiMySwal.fire({
        icon: 'success',
        title: 'Registro completo',
        html: `<i><strong>¡Bien hecho!</strong><br>Tu registro como estudiante ha sido completado con éxito. Ahora puedes iniciar sesión.</i>`,
        imageUrl: "img/estudiante.gif",
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
      alert('Ocurrió un error al guardar los datos. Intenta nuevamente.');
    }
  };

  return (
    <div className="container mt-5">
      <h2>Completar Datos de Estudiante</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="contact_phone"
          placeholder="Teléfono de contacto"
          onChange={handleChange}
          className="form-control mb-2"
          required
        />
        <input
          type="email"
          name="contact_email"
          placeholder="Correo de contacto"
          onChange={handleChange}
          className="form-control mb-2"
          required
        />
        <input
          type="number"
          name="age"
          placeholder="Edad"
          onChange={handleChange}
          className="form-control mb-2"
          required
        />
        <input
          type="text"
          name="grade"
          placeholder="Grado"
          onChange={handleChange}
          className="form-control mb-2"
          required
        />
        <button type="submit" className="btn btn-success">Guardar</button>
      </form>
    </div>
  );
};

export default CompletarEstudiante;
