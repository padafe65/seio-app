import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Pencil, Users, Mail, User } from "lucide-react";
import axiosClient from '../api/axiosClient';
import UserAvatar from './UserAvatar';
import WhatsAppSupport from './WhatsAppSupport';

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
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [authToken, user]);

  const handleLogout = () => {
    logout();
    const originalOnPopState = window.onpopstate;
    window.onpopstate = null;

    window.history.replaceState(null, '', '/');
    navigate('/', { replace: true });

    setTimeout(() => {
      if (window.onpopstate === null) {
        window.onpopstate = originalOnPopState;
      }
    }, 100);
  };

  const getDashboardRoute = () => {
    if (!user) return '/';
    return user.role === 'estudiante' ? '/student/dashboard' : '/dashboard';
  };

  if (!isAuthReady) return null;

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
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className={`collapse navbar-collapse ${isMenuOpen ? 'show' : ''}`}>
          <ul className="navbar-nav ms-auto">
            {authToken && user ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to={getDashboardRoute()} onClick={closeMenu}>
                    Inicio
                  </Link>
                </li>

                <li className="nav-item">
                  <Link className="nav-link" to="/admin" onClick={closeMenu}>
                    Administración
                  </Link>
                </li>

                {['docente', 'administrador', 'super_administrador'].includes(user?.role) && (
                  <li className="nav-item">
                    <NavLink className="nav-link" to="/indicators" onClick={closeMenu}>
                      Indicadores
                    </NavLink>
                  </li>
                )}

                {/* 🔥 WhatsApp Soporte */}
                <WhatsAppSupport />

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

                <li className="nav-item dropdown">
                  <a 
                    className="nav-link dropdown-toggle d-flex align-items-center" 
                    href="#" 
                    role="button" 
                    data-bs-toggle="dropdown"
                  >
                    <UserAvatar user={user} size="sm" authToken={authToken} />
                    <span className="ms-2 text-white small d-none d-lg-inline">
                      {user?.name?.split(' ')[0]}
                    </span>
                  </a>

                  <ul className="dropdown-menu dropdown-menu-end">
                    <li>
                      <Link to="/profile" className="dropdown-item" onClick={closeMenu}>
                        <User size={16} className="me-2" />
                        Mi Perfil
                      </Link>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button className="dropdown-item text-danger" onClick={() => { closeMenu(); handleLogout(); }}>
                        Cerrar sesión
                      </button>
                    </li>
                  </ul>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/" onClick={closeMenu}>
                    Iniciar Sesión
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/registro" onClick={closeMenu}>
                    Registrarse
                  </Link>
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