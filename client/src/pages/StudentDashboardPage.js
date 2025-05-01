import React from 'react';
import { useNavigate } from 'react-router-dom';

const StudentDashboardPage = () => {
  const navigate = useNavigate();

  return (
    <div className="d-flex">
      {/* Sidebar */}
      <div className="bg-dark text-white p-3 vh-100" style={{ width: '250px' }}>
        <h4>Estudiante</h4>
        <ul className="nav flex-column">
          <li className="nav-item">
            <button className="btn btn-link text-white" onClick={() => navigate('/student/take-quiz')}>
              Presentar Evaluación
            </button>
          </li>
          <li className="nav-item">
            <button className="btn btn-link text-white" onClick={() => navigate('/student/results')}>
              Consultar Resultados
            </button>
          </li>
          <li className="nav-item">
            <button className="btn btn-link text-white" onClick={() => navigate('/student/indicators')}>
              Indicadores
            </button>
          </li>
          <li className="nav-item">
            <button className="btn btn-link text-white" onClick={() => navigate('/student/improvement')}>
              Plan de Mejoramiento
            </button>
          </li>
        </ul>
      </div>

      {/* Main content */}
      <div className="p-4 w-100">
        <h2>Bienvenido al panel del estudiante</h2>
        <p>Selecciona una opción del menú para comenzar.</p>
      </div>
    </div>
  );
};

export default StudentDashboardPage;
