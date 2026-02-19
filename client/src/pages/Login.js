// client/src/pages/Login.js
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Facebook, MessageCircle } from 'lucide-react';

const notiMySwal = withReactContent(Swal);

const Login = () => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const { login, user } = useAuth();
  const navigate = useNavigate();
  
  const materias = [
    { 
      nombre: 'Matemáticas', 
      img: '/img/matematicas.jpg',
      subcategorias: ['Eje Numérico', 'Variacional', 'Aleatorio', 'Geométrico']
    },
    { 
      nombre: 'Física', 
      img: '/img/fisica.jpg',
      subcategorias: ['Mecánica', 'Termodinámica', 'Electromagnética', 'Óptica']
    },
    { 
      nombre: 'Inglés', 
      img: '/img/ingles.jpg',
      subcategorias: ['Grammar', 'Listening', 'Speaking', 'Writing']
    },
    { 
      nombre: 'Español', 
      img: '/img/espanol.jpg',
      subcategorias: ['Literatura', 'Gramática', 'Ortografía', 'Comprensión']
    },
    { 
      nombre: 'Biología', 
      img: '/img/biologia.jpg',
      subcategorias: ['Celular', 'Molecular', 'Ecología', 'Genética']
    },
    { 
      nombre: 'Ciencias Sociales', 
      img: '/img/sociales.jpg',
      subcategorias: ['Geografía', 'Economía', 'Política', 'Cultura']
    },
    { 
      nombre: 'Historia', 
      img: '/img/historia.jpg',
      subcategorias: ['Antigua', 'Medieval', 'Moderna', 'Contemporánea']
    },
    { 
      nombre: 'Matemáticas', 
      img: '/img/matematicas2.jpg',
      subcategorias: ['Eje Numérico', 'Variacional', 'Aleatorio', 'Geométrico']
    },
    { 
      nombre: 'Física', 
      img: '/img/fisica3.jpg',
      subcategorias: ['Mecánica', 'Termodinámica', 'Electromagnética', 'Óptica']
    },
    { 
      nombre: 'Inglés', 
      img: '/img/ingles1.jpg',
      subcategorias: ['Grammar', 'Listening', 'Speaking', 'Writing']
    },
    { 
      nombre: 'Español', 
      img: '/img/espanol1.jpg',
      subcategorias: ['Literatura', 'Gramática', 'Ortografía', 'Comprensión']
    },
    { 
      nombre: 'Biología', 
      img: '/img/biologia1.jpg',
      subcategorias: ['Celular', 'Molecular', 'Ecología', 'Genética']
    },
    { 
      nombre: 'Ciencias Sociales', 
      img: '/img/sociales1.jpg',
      subcategorias: ['Geografía', 'Economía', 'Política', 'Cultura']
    },
    { 
      nombre: 'Historia', 
      img: '/img/historia1.jpg',
      subcategorias: ['Antigua', 'Medieval', 'Moderna', 'Contemporánea']
    },
    { 
      nombre: 'Matemáticas', 
      img: '/img/matematicas3.jpg',
      subcategorias: ['Eje Numérico', 'Variacional', 'Aleatorio', 'Geométrico']
    },
    { 
      nombre: 'Física', 
      img: '/img/fisica4.jpg',
      subcategorias: ['Mecánica', 'Termodinámica', 'Electromagnética', 'Óptica']
    },
    { 
      nombre: 'Inglés', 
      img: '/img/ingles2.jpg',
      subcategorias: ['Grammar', 'Listening', 'Speaking', 'Writing']
    },
    { 
      nombre: 'Español', 
      img: '/img/espanol2.jpg',
      subcategorias: ['Literatura', 'Gramática', 'Ortografía', 'Comprensión']
    },
    { 
      nombre: 'Biología', 
      img: '/img/biologia2.jpg',
      subcategorias: ['Celular', 'Molecular', 'Ecología', 'Genética']
    },
    { 
      nombre: 'Ciencias Sociales', 
      img: '/img/sociales2.jpg',
      subcategorias: ['Geografía', 'Economía', 'Política', 'Cultura']
    },
    { 
      nombre: 'Historia', 
      img: '/img/historia2.jpg',
      subcategorias: ['Antigua', 'Medieval', 'Moderna', 'Contemporánea']
    },
    { 
      nombre: 'Matemáticas', 
      img: '/img/matematicas4.jpg',
      subcategorias: ['Eje Numérico', 'Variacional', 'Aleatorio', 'Geométrico']
    },
    { 
      nombre: 'Física', 
      img: '/img/fisica5.jpg',
      subcategorias: ['Mecánica', 'Termodinámica', 'Electromagnética', 'Óptica']
    },
    { 
      nombre: 'Inglés', 
      img: '/img/ingles3.jpg',
      subcategorias: ['Grammar', 'Listening', 'Speaking', 'Writing']
    },
    { 
      nombre: 'Español', 
      img: '/img/espanol3.jpg',
      subcategorias: ['Literatura', 'Gramática', 'Ortografía', 'Comprensión']
    },
    { 
      nombre: 'Biología', 
      img: '/img/biologia3.jpg',
      subcategorias: ['Celular', 'Molecular', 'Ecología', 'Genética']
    },
    { 
      nombre: 'Ciencias Sociales', 
      img: '/img/sociales3.jpg',
      subcategorias: ['Geografía', 'Economía', 'Política', 'Cultura']
    },
    { 
      nombre: 'Historia', 
      img: '/img/historia3.jpg',
      subcategorias: ['Antigua', 'Medieval', 'Moderna', 'Contemporánea']
    }
  ];

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
      <div className="row">
        <div className="col-md-6">
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

          <div className="mt-4 d-flex gap-3">
            <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-primary">
              <Facebook size={30} />
            </a>
            <a href="https://wa.me/tunumerotelefonico" target="_blank" rel="noopener noreferrer" className="text-success">
              <MessageCircle size={30} />
            </a>
          </div>
        </div>

        <div className="col-md-6">
          <div id="carouselMaterias" className="carousel slide" data-bs-ride="carousel">
            <div className="carousel-inner rounded shadow">
              {materias.map((materia, index) => (
                <div key={index} className={`carousel-item ${index === 0 ? 'active' : ''}`}>
                  <img 
                    src={materia.img} 
                    className="d-block w-100" 
                    alt={materia.nombre} 
                    style={{ 
                      height: '450px', 
                      objectFit: 'cover',
                      objectPosition: 'center',
                      imageRendering: 'crisp-edges'
                    }}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/1200x450?text=' + materia.nombre }} 
                  />
                  <div className="carousel-caption bg-dark bg-opacity-75 rounded p-3" style={{ bottom: '0' }}>
                    <h5 className="mb-2" style={{ fontSize: '1rem' }}>{materia.nombre}</h5>
                    <div style={{ fontSize: '0.75rem', lineHeight: '1.4', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {materia.subcategorias.map((sub, i) => (
                        <span key={i}>
                          <span className="badge bg-info text-dark">{sub}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="carousel-control-prev" type="button" data-bs-target="#carouselMaterias" data-bs-slide="prev">
              <span className="carousel-control-prev-icon" aria-hidden="true"></span>
            </button>
            <button className="carousel-control-next" type="button" data-bs-target="#carouselMaterias" data-bs-slide="next">
              <span className="carousel-control-next-icon" aria-hidden="true"></span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Video de presentación SEIO (mismo tamaño y posición que la imagen anterior) */}
      <div
        className="d-inline-block mb-2"
        style={{
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <video
          src="/videos/videologo.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          title="Presentación SEIO"
        />
      </div>
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
