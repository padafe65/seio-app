import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const notiMySwal = withReactContent(Swal);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Registro = () => {
  const [user, setUser] = useState({ name: '', phone: '', email: '', password: '', role: '' });
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, user);
      
      const userId = response.data.user.id;
      localStorage.setItem('user_id', userId);  // ✅ CORREGIDO: ahora guarda 'user_id' con guión bajo

      notiMySwal.fire({
        icon: 'success',
        title: 'Atención',
        html: `<i><strong> ${user.name} </strong>, su registro fue exitoso. Ya está habilitado en la plataforma SEIO.</i>`,
        imageUrl: "img/ingreso.gif",
        imageWidth: 100,
        imageHeight: 100,
        confirmButtonColor: '#3085d6'
      }).then(() => {
        if (user.role === 'estudiante') {
          navigate('/CompleteStudent');
        } else if (user.role === 'docente') {
          navigate('/CompleteTeacher');
        } else {
          navigate('/');
        }
      });

    } catch (error) {
      console.error(error);

      const mensaje = error.response?.data?.message || 'Ocurrió un error inesperado.';
      notiMySwal.fire({
        icon: 'error',
        title: 'Error',
        html: `<i><strong> ${user.name} </strong>, ${mensaje}</i>`,
        imageUrl: "img/error.gif",
        imageWidth: 100,
        imageHeight: 100,
        confirmButtonColor: '#3085d6'
      });
    }
  };

  return (
    <div className="container mt-5">
      <h2>Registro de Usuario</h2>
      <form onSubmit={handleSubmit}>
        <input 
          type="text" 
          name="name" 
          placeholder="Nombre completo" 
          onChange={handleChange} 
          className="form-control mb-2" 
          required 
        />

        <input 
          type="text" 
          name="phone" 
          placeholder="Teléfono fijo o celular" 
          onChange={handleChange} 
          className="form-control mb-2" 
          required 
        />

        <input 
          type="email" 
          name="email" 
          placeholder="Correo Electrónico" 
          onChange={handleChange} 
          className="form-control mb-2" 
          required 
        />

        <input 
          type="password" 
          name="password" 
          placeholder="Contraseña" 
          onChange={handleChange} 
          className="form-control mb-2" 
          required 
        />

        <select 
          name="role" 
          onChange={handleChange} 
          className="form-control mb-3" 
          required
        >
          <option value="">Seleccione su Rol</option>
          <option value="estudiante">Estudiante</option>
          <option value="docente">Docente</option>
        </select>

        <button type="submit" className="btn btn-success w-100">Registrar</button>
      </form>
    </div>
  );
};

export default Registro;
