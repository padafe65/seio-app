import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Pencil, Users, Mail } from "lucide-react";
import axiosClient from '../api/axiosClient';

const Navbar = () => {
  const { authToken, logout, user, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    console.log("🔄 Cambios en authToken:", authToken);
  }, [authToken]);
  
  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
  };
  
  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Obtener contador de mensajes no leídos
  useEffect(() => {
    if (authToken && user) {
      const fetchUnreadCount = async () => {
        try {
          const response = await axiosClient.get('/messages/unread-count');
          setUnreadCount(response.data.count || 0);
        } catch (error) {
          console.error('Error al obtener contador de mensajes:', error);
        }
      };
      
      fetchUnreadCount();
      // Actualizar cada 30 segundos
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [authToken, user]);

  const handleLogout = () => {
    logout();
    
    // Limpiar cualquier listener previo de onpopstate
    const originalOnPopState = window.onpopstate;
    window.onpopstate = null;
    
    // Navegar al login y limpiar historial
    window.history.replaceState(null, '', '/');
    navigate('/', { replace: true });
    
    // Restaurar comportamiento normal del navegador después de un breve delay
    setTimeout(() => {
      if (window.onpopstate === null) {
        window.onpopstate = originalOnPopState;
      }
    }, 100);
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
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark" style={{ position: 'sticky', top: 0, zIndex: 1050 }}>
      <div className="container">
        <Link className="navbar-brand" to={authToken ? getDashboardRoute() : "/"}>
          SEIO - Sistema Evaluativo Integral Online
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          onClick={toggleMenu}
          aria-controls="navbarNav"
          aria-expanded={isMenuOpen}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className={`collapse navbar-collapse ${isMenuOpen ? 'show' : ''}`} id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {authToken && user ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to={getDashboardRoute()} onClick={closeMenu}>Inicio</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/admin" onClick={closeMenu}>Administración</Link>
                </li>
                
                {/* ✅ Enlace a Indicadores solo para docente, administrador y super_administrador */}
                {['docente', 'administrador', 'super_administrador'].includes(user?.role) && (
                  <li className="nav-item">
                    <NavLink className="nav-link" to="/indicators" onClick={closeMenu}>Indicadores</NavLink>
                  </li>
                )}

                {/* Enlace a Mensajes para todos los usuarios autenticados */}
                {authToken && user && (
                  <li className="nav-item">
                    <Link 
                      className="nav-link position-relative" 
                      to={user.role === 'estudiante' ? '/student/messages' : '/messages'}
                      onClick={closeMenu}
                    >
                      <Mail size={18} className="me-1" />
                      Mensajes
                      {unreadCount > 0 && (
                        <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.7rem' }}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Link>
                  </li>
                )}

                {user?.role === 'docente' && (
                  <>
                    <li className="nav-item">
                      <Link className="btn btn-primary d-flex align-items-center ms-2" to="/crear-pregunta" onClick={closeMenu}>
                        <Pencil size={16} className="me-1" />
                        Crear Pregunta
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link className="btn btn-info d-flex align-items-center ms-2" to="/mis-estudiantes" onClick={closeMenu}>
                        <Users size={16} className="me-1" />
                        Mis Estudiantes
                      </Link>
                    </li>
                  </>
                )}
                <li className="nav-item">
                  <button className="btn btn-danger ms-3" onClick={() => { closeMenu(); handleLogout(); }}>Cerrar sesión</button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/" onClick={closeMenu}>Iniciar Sesión</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/registro" onClick={closeMenu}>Registrarse</Link>
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
