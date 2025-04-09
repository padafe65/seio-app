import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

    const notiMySwal = withReactContent(Swal);

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
      await axios.post('http://localhost:5000/api/auth/register', user);
      notiMySwal.fire({
        icon: 'success',
        title: 'Registro exitoso',
        text: 'Usuario registrado con éxito',
        confirmButtonColor: '#198754' // color btn-success
      }).then(() => {
        navigate('/');
      });
  
    } catch (error) {
      notiMySwal.fire({
        icon: 'error',
        title: 'Error en el registro',
        text: error.response?.data?.message || 'No se pudo registrar el usuario',
        confirmButtonColor: '#dc3545' // color btn-danger
      });
      //alert('Usuario registrado con éxito');
      //navigate('/');
    } //catch (error) {
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
