// components/layout/Layout.js
import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, Users, FileText, BarChart2, 
  PlusCircle, CheckSquare, Award, Settings 
} from 'lucide-react';

const Layout = () => {
  const { user } = useAuth();
  
  return (
    <div className="d-flex">
      <div className="sidebar bg-dark text-white" style={{ width: '250px', height: '100vh', position: 'fixed', left: 0, top: '56px', overflowY: 'auto' }}>
        <div className="p-3">
          <h5 className="mb-3">
            {user?.role === 'docente' ? 'Panel de Control' : 'Panel de Estudiante'}
          </h5>
          
          {user?.role === 'docente' ? (
            <ul className="nav flex-column">
              <li className="nav-item mb-2">
                <Link to="/dashboard" className="nav-link text-white d-flex align-items-center">
                  <Home size={18} className="me-2" /> Dashboard
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/estudiantes" className="nav-link text-white d-flex align-items-center">
                  <Users size={18} className="me-2" /> Estudiantes
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/mis-estudiantes" className="nav-link text-white d-flex align-items-center">
                  <Users size={18} className="me-2" /> Mis Estudiantes
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/cuestionarios" className="nav-link text-white d-flex align-items-center">
                  <FileText size={18} className="me-2" /> Cuestionarios
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/indicadores" className="nav-link text-white d-flex align-items-center">
                  <CheckSquare size={18} className="me-2" /> Indicadores
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/resultados" className="nav-link text-white d-flex align-items-center">
                  <BarChart2 size={18} className="me-2" /> Resultados
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/crear-pregunta" className="nav-link bg-primary text-white d-flex align-items-center">
                  <PlusCircle size={18} className="me-2" /> Crear Pregunta
                </Link>
              </li>
            </ul>
          ) : (
            <ul className="nav flex-column">
              <li className="nav-item mb-2">
                <Link to="/student/dashboard" className="nav-link text-white d-flex align-items-center">
                  <Home size={18} className="me-2" /> Dashboard
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/take-quiz" className="nav-link text-white d-flex align-items-center">
                  <FileText size={18} className="me-2" /> Evaluaciones
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/results" className="nav-link text-white d-flex align-items-center">
                  <Award size={18} className="me-2" /> Resultados
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/indicators" className="nav-link text-white d-flex align-items-center">
                  <CheckSquare size={18} className="me-2" /> Indicadores
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/improvement" className="nav-link text-white d-flex align-items-center">
                  <BarChart2 size={18} className="me-2" /> Plan de Mejora
                </Link>
              </li>
            </ul>
          )}
        </div>
      </div>
      
      <div style={{ marginLeft: '250px', width: 'calc(100% - 250px)', padding: '20px', marginTop: '56px' }}>
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
