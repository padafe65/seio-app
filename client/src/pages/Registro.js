import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const notiMySwal = withReactContent(Swal);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Registro = () => {
  const [user, setUser] = useState({ nombre: '', telefono:'', email: '', password: '', rol: 'usuario' });
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Se actualiza el estado con el nuevo valor del campo
    const updatedUser = { ...user, [name]: value };

    // Verifica si el nombre y la contraseña coinciden con las credenciales del admin
    if (updatedUser.nombre === 'Padafe65' && updatedUser.password === 'Pdve4461') {
      updatedUser.rol = 'admin';
    } else {
      updatedUser.rol = 'usuario';
    }

    setUser(updatedUser);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/auth/register`, user);
      notiMySwal.fire({
        icon: 'success',
        title: 'Registro exitoso',
        text: 'Usuario registrado con éxito',
        confirmButtonColor: '#198754' // color btn-success
      }).then(() => {
        navigate('/');
      });
  
    } catch (error) {
      if (!error.response) {
        // ❌ Error de red o servidor caído
        Swal.fire({
          icon: 'error',
          title: 'Error de conexión',
          text: 'No se pudo conectar con el servidor. Inténtalo más tarde.'
        });
      } else {
        const mensaje = error.response.data.message;
  
        // Puedes hacer aún más específico si quieres:
        if (mensaje.includes('nombre') && mensaje.includes('correo')) {
          Swal.fire({
            icon: 'warning',
            title: 'Duplicado',
            text: 'El nombre de usuario y el correo ya están en uso.'
          });
        } else if (mensaje.includes('nombre')) {
          Swal.fire({
            icon: 'warning',
            title: 'Nombre en uso',
            text: 'El nombre de usuario ya está registrado.'
          });
        } else if (mensaje.includes('correo')) {
          Swal.fire({
            icon: 'warning',
            title: 'Correo en uso',
            text: 'El correo electrónico ya está registrado.'
          });
        } else {
          // Otro tipo de error
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: mensaje || 'Ocurrió un error inesperado.'
          });
        }
      }
    }
      //catch (error) {
      //console.error('Error en el registro:', error);
   // }
  };

  return (
    <div className="container mt-5">
      <h2>Registro de Usuario</h2>
      <form onSubmit={handleSubmit}>
        <input 
          type="text" 
          name="nombre" 
          placeholder="Nombre" 
          onChange={handleChange} 
          className="form-control mb-2" 
          required 
        />
        <input 
          type="text" 
          name="telefono" 
          placeholder="telefono fijo o celular" 
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

        {/* Se muestra el rol seleccionado automáticamente */}  
        <div className="mb-3">
          <label className="form-label">Rol asignado:</label>
          <input 
            type="text" 
            value={user.rol} 
            className="form-control" 
            readOnly 
          />
        </div>

        <button type="submit" className="btn btn-success">Registrar</button>
      </form>
    </div>
  );
};

export default Registro;
