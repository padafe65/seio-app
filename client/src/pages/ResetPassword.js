import React, { useState } from 'react';
import axios from 'axios';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/auth/reestablecer-password', {
        email,
        nuevaPassword
      });
      setMensaje(res.data.message);
    } catch (error) {
      setMensaje(error.response?.data?.error || 'Error al cambiar contraseña');
    }
  };

  return (
    <div className="container mt-5">
      <h3>Reestablecer Contraseña</h3>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Correo registrado" className="form-control mb-2" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Nueva contraseña" className="form-control mb-2" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} required />
        <button className="btn btn-warning">Reestablecer</button>
      </form>
      {mensaje && <div className="mt-3 alert alert-info">{mensaje}</div>}
    </div>
  );
};

export default ResetPassword;
