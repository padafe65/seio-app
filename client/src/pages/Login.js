  // frontend-rifa/src/pages/Login.js
  //import React, { useState } from 'react';
  import { useAuth } from '../context/AuthContext';
  import { useNavigate } from 'react-router-dom';
  import Draggable from 'react-draggable';
  import React, { useState, useRef } from 'react';
  

  const Login = () => {
    const [credentials, setCredentials] = useState({ email: '', password: '' });
    const { login } = useAuth();
    const navigate = useNavigate();    

    // Refs para Draggable (para evitar el uso de findDOMNode)
  const draggableRef = useRef(null);

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
      if (success) navigate('/rifa');
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
      <Draggable nodeRef={draggableRef}>
        <div
          ref={draggableRef}
          style={{
            width: '950px',
            padding: '10px',
            backgroundColor: '#17a2b8',
            color: 'white',
            borderRadius: '10px',
            position: 'absolute',
            top: '300px',
            right: '130px',
            cursor: 'move',
            zIndex: 1000,
          }}
        >
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

          <p>
            💡<i><strong style={{ color: 'beige' }}>Bienvenido y gracias por participar en la rifa pro_quimioterapia Erwin.</strong></i> 
            Para entrar a nuestra página y participar en la rifa de $500000 COP (Quinientos mil pesos colombianos), la cual funciona de la manera siguiente:
            participas con el número de cuatro cifras generado por el botón "Generar Número" y esta es la cantidad que debes pagar, por ejemplo, si se genera el número 
            "0214" cancelas $214 COP y si deseas participar con más números, da clic en el botón nuevamente, si te sale "1026", cancelas en total la suma de los dos 
            números: $1240 COP. <br /><br />
            <strong>Tenga en cuenta:</strong> <br />
            1. Debes registrar tu usuario y proporcionar los datos solicitados.<br />
            2. Iniciar sesión con tu correo y la clave que seleccionaste.<br />
            3. Todo número/s de la rifa debe estar cancelado para el pago del premio y se debe subir el comprobante de pago al número <strong>3142999274</strong> a 
            nombre de <strong>Vilma</strong>.<br />
            4. Las oportunidades para ganar son proporcionales a los números generados.
          </p>
        </div>
      </Draggable>
    </div>
  );
};


  export default Login;
