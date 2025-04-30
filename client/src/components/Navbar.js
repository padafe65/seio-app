import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Pencil } from "lucide-react";


const Navbar = () => {
  const { authToken, logout, user } = useAuth();

  useEffect(() => {
    console.log("🔄 Cambios en authToken:", authToken);
  }, [authToken]);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <Link className="navbar-brand" to="/">SEIO - Sistema Evaluativo Integral Online</Link>

        {/* 🔽 Botón hamburguesa para móviles */}
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

        {/* 🔽 Menú colapsable */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {authToken ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/rifa">Jugar</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/admin">Administración</Link>
                </li>
                {user?.role === 'docente' && (
                 <li className="nav-item">
                 <Link className="btn btn-primary d-flex align-items-center ms-2" to="/crear-pregunta">
                   <Pencil size={16} className="me-1" />
                   Crear Pregunta
                 </Link>
               </li>
                )}
                <li className="nav-item">
                  <button className="btn btn-danger ms-3" onClick={logout}>Cerrar sesión</button>
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

