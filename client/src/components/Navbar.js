// frontend-rifa/src/components/Navbar.js
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { authToken, logout } = useAuth();

  useEffect(() => {
    console.log("🔄 Cambios en authToken:", authToken);
  }, [authToken]);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <Link className="navbar-brand" to="/">Rifa</Link>

        {/* 🔽 Este es el botón para dispositivos móviles con mejoras */}
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

        {/* 🔽 Menú que se colapsa en dispositivos móviles */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto"> {/* ms-auto alinea a la derecha */}
            {authToken ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/rifa">Jugar</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/admin">Administración</Link>
                </li>
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
