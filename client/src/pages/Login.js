// client/src/pages/Login.js
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import React, { useState, useRef } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const notiMySwal = withReactContent(Swal);

const Login = () => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const { login, user } = useAuth();
  const navigate = useNavigate();    
  console.log("Usuario autenticado:", user);

  // Dentro del componente Login
  const handleForgotPassword = () => {
    navigate('/reset-password');
  };

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(credentials);
    if (success) {
      notiMySwal.fire({
        icon: 'success',
        title: 'Inicio de sesion exitoso',
        html: <i>El usuario con email:<strong> {credentials.email} </strong>fue validado con exito</i>,
        imageUrl: "img/bienvenido.gif",
        imageWidth: 100,
        imageHeight: 100,
        confirmButtonColor: '#198754' // color btn-success
        
      }).then(() => {
        const role = success?.role?.toLowerCase();
        if (role === 'docente') {
          navigate('/dashboard');
        } else if (role === 'estudiante') {
          navigate('/student/dashboard');
        } else {
          navigate('/login');
        }
        
      });
    } else {
      notiMySwal.fire({
        icon: 'error',
        title: 'Atención',
         html: `<i><strong>${credentials.email} </strong>, Error de email o password   no se pude ingresar a su usuario, intente de nuevo</i>`,
        imageUrl: "img/errorlogin.gif",
        imageWidth: 100,
        imageHeight: 100,
        confirmButtonColor: '#3085d6',
      });    
      
    }
  };
  
  return (
    <div className="container mt-5">
      <h2>Iniciar Sesión</h2>

      {/* Texto flotante */}
      <div className="float-end mb-3 text-muted" style={{ cursor: 'pointer' }} onClick={handleForgotPassword}>
        ¿Olvidaste tu contraseña?
      </div>

      {/* Clearfix para que el contenedor abarque correctamente el flotante */}
      <div className="clearfix"></div>

      <form onSubmit={handleSubmit}>
        <input type="email" name="email" placeholder="Correo electrónico" onChange={handleChange} className="form-control mb-2" required />
        <input type="password" name="password" placeholder="Contraseña" onChange={handleChange} className="form-control mb-2" required />
        <button type="submit" className="btn btn-primary">Ingresar</button>
      </form>
      
      {/* Draggable con imagen y texto */}
      
      {/* Imagen en la parte superior */}
      <img
        src="/img/jesus.jpg" //Asegúrate de que esta imagen esté en public/img
        alt="Imagen de Jesus mi salvador"
        style={{
          width: '10%',
          height: 'auto',
          borderRadius: '8px',
          marginBottom: '10px',
        }}
      />
      <div className="overflow-y-auto p-4 rounded-xl mt-3" style={{ maxHeight: '70vh', backgroundColor: '#17a2b8', WebkitOverflowScrolling: 'touch', touchAction: 'manipulation', color:'whitesmoke'}}>
        
        <ul>
          <li>
            <i><strong style={{ color: 'beige' }}>Bienvenido al Sistema Educativo SEIO (Este elemento de texto informativo es desplazable).</strong></i> 
          </li>
        </ul>
        💡
        Para acceder a la plataforma educativa SEIO, debes estar registrado en el sistema e iniciar sesión con tu correo electrónico y contraseña. <br />
        <li><strong>Instrucciones:</strong> </li><br />
        <ul>
          <ol>
            <li><strong>Debes registrar tu usuario y proporcionar los datos solicitados.</strong> </li>
            <li><strong>Iniciar sesión con tu correo y la clave que seleccionaste.</strong> </li>
            <li><strong>Completa tu perfil según tu rol (estudiante, docente, administrador).</strong> </li>
            <li><strong>Explora las funcionalidades disponibles según tu perfil de usuario.</strong> </li>
            <li><strong>Si eres estudiante, podrás acceder a cuestionarios, recursos educativos y planes de mejora.</strong> </li>
            <li><strong>Si eres docente, podrás gestionar cursos, estudiantes, cuestionarios e indicadores.</strong> </li>
            <li><strong>Si tienes problemas, contacta al administrador del sistema.</strong> </li>                    
          </ol>
        </ul>
      </div>
    </div>
  );
};

export default Login;
