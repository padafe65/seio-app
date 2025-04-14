import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const notiMySwal = withReactContent(Swal);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Registro = () => {
  const [user, setUser] = useState({ nombre: '', telefono:'', email: '', password: ''});
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Se actualiza el estado con el nuevo valor del campo
    const updatedUser = { ...user, [name]: value };
    
    setUser(updatedUser);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/auth/register`, user);
      
      notiMySwal.fire({
        icon: 'success',
        title: 'Atención',
        html: `<i><strong> ${user.nombre} </strong>,  Su Registro fue exitoso, ya esta habilitado en la plataforma para partcicipar en la rifa.</i>`,
        imageUrl: "img/ingreso.gif",
        imageWidth: 100,
        imageHeight: 100,
        //text: 'Usuario registrado con éxito',
        confirmButtonColor: '#3085d6',
      }); 
            
  
    } catch (error) {
      if (!error.response) {
        // ❌ Error de red o servidor caído
        notiMySwal.fire({
          icon: 'error',
          title: 'Error de conexión',                    
          html: `<i><strong> ${user.nombre} </strong>,   No se pudo conectar con el servidor. Inténtalo más tarde.</i>`,
          imageUrl: "img/error.gif",
          imageWidth: 100,
          imageHeight: 100,
          //text: 'Usuario registrado con éxito',
          confirmButtonColor: '#3085d6'
        });
      } else {
        const mensaje = error.response.data.message;
  
        // Puedes hacer aún más específico si quieres:
        if (mensaje.includes('nombre') && mensaje.includes('correo')) {
          notiMySwal.fire({
            icon: 'warning',
            title: 'Duplicado',
            text: 'El nombre de usuario y el correo ya están en uso.',
            html: `<i><strong> ${user.nombre} </strong>,   El nombre de usuario y el correo ya están en uso.</i>`,
            imageUrl: "img/duplicado.gif",
            imageWidth: 100,
            imageHeight: 100,
            //text: 'Usuario registrado con éxito',
            confirmButtonColor: '#3085d6'
          });
        } else if (mensaje.includes('nombre')) {          
          notiMySwal.fire({
            icon: 'warning',
            title: 'Nombre en uso',
            text: 'El nombre de usuario y el correo ya están en uso.',
            html: `<i><strong> ${user.nombre} </strong>, El nombre de usuario ya está registrado.</i>`,
            imageUrl: "img/duplicado.gif",
            imageWidth: 100,
            imageHeight: 100,
            //text: 'Usuario registrado con éxito',
            confirmButtonColor: '#3085d6'
          });
        } else if (mensaje.includes('correo')) {          
          notiMySwal.fire({
            icon: 'warning',
            title: 'Correo en uso',
            text: 'El nombre de usuario y el correo ya están en uso.',
            html: `<i><strong> ${user.nombre}: </strong>, ${user.email} este correo electrónico ya está registrado.</i>`,
            imageUrl: "img/duplicado.gif",
            imageWidth: 100,
            imageHeight: 100,
            //text: 'Usuario registrado con éxito',
            confirmButtonColor: '#3085d6'
          });
        } else {
          // Otro tipo de error          
          notiMySwal.fire({
            icon: 'error',
            title: 'Error de conexión',                    
            html: `<i><strong> ${user.nombre} </strong>,  ${mensaje} || 'Ocurrió un error inesperado.'</i>`,
            imageUrl: "img/error.gif",
            imageWidth: 100,
            imageHeight: 100,
            //text: 'Usuario registrado con éxito',
            confirmButtonColor: '#3085d6'
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
