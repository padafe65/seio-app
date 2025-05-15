import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Pencil, Users } from "lucide-react";
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const { authToken, logout, user, isAuthReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("🔄 Cambios en authToken:", authToken);
  }, [authToken]);

  const handleLogout = () => {
    logout();
    
    // Prevenir navegación hacia atrás después de logout
    window.history.pushState(null, '', '/');
    window.onpopstate = function() {
      window.history.pushState(null, '', '/');
    };
    
    navigate('/');
  };

  // Función para determinar la ruta del dashboard según el rol
  const getDashboardRoute = () => {
    if (!user) return '/';
    return user.role === 'estudiante' ? '/student/dashboard' : '/dashboard';
  };

  if (!isAuthReady) {
    return null; // No mostrar nada mientras se inicializa la autenticación
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <Link className="navbar-brand" to={authToken ? getDashboardRoute() : "/"}>
          SEIO - Sistema Evaluativo Integral Online
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {authToken && user ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to={getDashboardRoute()}>Inicio</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/admin">Administración</Link>
                </li>
                {user?.role === 'docente' && (
                  <>
                    <li className="nav-item">
                      <Link className="btn btn-primary d-flex align-items-center ms-2" to="/crear-pregunta">
                        <Pencil size={16} className="me-1" />
                        Crear Pregunta
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link className="btn btn-info d-flex align-items-center ms-2" to="/mis-estudiantes">
                        <Users size={16} className="me-1" />
                        Mis Estudiantes
                      </Link>
                    </li>
                  </>
                )}
                <li className="nav-item">
                  <button className="btn btn-danger ms-3" onClick={handleLogout}>Cerrar sesión</button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/">Iniciar Sesión</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/registro">Registrarse</Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
