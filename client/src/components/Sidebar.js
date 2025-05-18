import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, Users, FileText, BarChart2, 
  PlusCircle, CheckSquare, Award, Settings, LogOut, BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext'; // Corregido: ruta relativa correcta

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Este código se ejecutará cada vez que cambie la ruta
    console.log('Ruta actual:', location.pathname);
  }, [location.pathname]);
  
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`) 
      ? 'active bg-primary text-white' 
      : '';
  };
  
  return (
    <div className="sidebar bg-dark text-white" style={{ width: '250px', height: '100vh', position: 'fixed', left: 0, top: 0, overflowY: 'auto' }}>
      <div className="p-3 border-bottom">
        <h5 className="m-0">SEIO</h5>
        <p className="small mb-0">Sistema Evaluativo Integral Online</p>
      </div>
      
      <div className="nav flex-column nav-pills p-3">
        <Link to="/dashboard" className={`nav-link text-white mb-2 ${isActive('/dashboard')}`}>
          <Home size={18} className="me-2" /> Dashboard
        </Link>
        
        {user && user.role === 'docente' && (
          <>
            <Link to="/estudiantes" className={`nav-link text-white mb-2 ${isActive('/estudiantes')}`}>
              <Users size={18} className="me-2" /> Estudiantes
            </Link>
            <Link to="/mis-estudiantes" className={`nav-link text-white mb-2 ${isActive('/mis-estudiantes')}`}>
              <Users size={18} className="me-2" /> Mis estudiantes
            </Link>
            <Link to="/cuestionarios" className={`nav-link text-white mb-2 ${isActive('/cuestionarios')}`}>
              <FileText size={18} className="me-2" /> Cuestionarios
            </Link>
            <Link to="/indicadores" className={`nav-link text-white mb-2 ${isActive('/indicadores')}`}>
              <CheckSquare size={18} className="me-2" /> Indicadores
            </Link>
            <Link to="/resultados" className={`nav-link text-white mb-2 ${isActive('/resultados')}`}>
              <BarChart2 size={18} className="me-2" /> Resultados
            </Link>
            <Link to="/crear-pregunta" className={`nav-link bg-primary text-white mb-2 ${isActive('/crear-pregunta')}`}>
              <PlusCircle size={18} className="me-2" /> Crear Pregunta
            </Link>
            <Link to="/evaluacion-fase" className={`nav-link text-white mb-2 ${isActive('/evaluacion-fase')}`}>
              <CheckSquare size={18} className="me-2" /> Evaluación de Fase
            </Link>
            <Link to="/mis-cursos" className={`nav-link text-white mb-2 ${isActive('/mis-cursos')}`}>
              <BookOpen size={18} className="me-2" /> Mis Cursos
            </Link>



          </>
        )}
        
        {user && user.role === 'estudiante' && (
          <>
            <Link to="/student/dashboard" className={`nav-link text-white mb-2 ${isActive('/student/dashboard')}`}>
              <Home size={18} className="me-2" /> Mi Dashboard
            </Link>
            <Link to="/student/take-quiz" className={`nav-link text-white mb-2 ${isActive('/student/take-quiz')}`}>
              <FileText size={18} className="me-2" /> Evaluaciones
            </Link>
            <Link to="/student/results" className={`nav-link text-white mb-2 ${isActive('/student/results')}`}>
              <Award size={18} className="me-2" /> Mis Resultados
            </Link>
            <Link to="/student/indicators" className={`nav-link text-white mb-2 ${isActive('/student/indicators')}`}>
              <CheckSquare size={18} className="me-2" /> Indicadores
            </Link>
          </>
        )}
      </div>
      
      <div className="mt-auto p-3 border-top">
        <Link to="/configuracion" className={`nav-link text-white mb-2 ${isActive('/configuracion')}`}>
          <Settings size={18} className="me-2" /> Configuración
        </Link>
        <button onClick={logout} className="nav-link text-danger border-0 bg-transparent w-100 text-start">
          <LogOut size={18} className="me-2" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
