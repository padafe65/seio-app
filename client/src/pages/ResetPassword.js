import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import Swal from 'sweetalert2';
  import withReactContent from 'sweetalert2-react-content';
  
      const notiMySwal = withReactContent(Swal);

// Usa la variable de entorno
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const navigate = useNavigate(); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/auth/reestablecer-password`, {
        email,
        nuevaPassword
      });
      if(res){
        notiMySwal.fire({
          icon: 'success',
          title: res.data.message,
          html: <i>El usuario con email:<strong> {email} </strong>fue validado y la contraseña actualizda</i>,
          //text: 'Usuario registrado con éxito',
          confirmButtonColor: '#198754' // color btn-success
        }).then(() => {
          navigate('/');
        });
        setMensaje(res.data.message);
      }
      

    }  catch (error) {
      console.error("❌ Error al reestablecer la contraseña:", error);
      const msg =
        error.response?.data?.message || // <-- verifica si tu backend manda `message`
        error.response?.data?.error ||   // <-- o si manda `error`
        'Ocurrió un error inesperado al intentar cambiar la contraseña.';
      setMensaje(msg);
    }
  };

  return (
    <div className="container mt-5">
      <h3>Reestablecer Contraseña</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Correo registrado"
          className="form-control mb-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Nueva contraseña"
          className="form-control mb-2"
          value={nuevaPassword}
          onChange={(e) => setNuevaPassword(e.target.value)}
          required
        />
        <button className="btn btn-warning">Reestablecer</button>
      </form>
      {mensaje && <div className="mt-3 alert alert-info">{mensaje}</div>}
    </div>
  );
};

export default ResetPassword;
