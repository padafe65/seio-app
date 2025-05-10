import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const StudentDashboardPage = () => {
  const { user } = useAuth();

  return (
    <div className="container mt-4">
      <h2>Bienvenido al panel del estudiante, {user?.name}</h2>
      <p>Selecciona una opción del menú lateral para comenzar.</p>
      
      <div className="row mt-4">
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Presentar Evaluación</h5>
              <p className="card-text">Accede a las evaluaciones disponibles para tu curso.</p>
              <Link to="/student/take-quiz" className="btn btn-primary">Ir a Evaluaciones</Link>
            </div>
          </div>
        </div>
        
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Consultar Resultados</h5>
              <p className="card-text">Revisa tus calificaciones y progreso académico.</p>
              <Link to="/student/results" className="btn btn-info">Ver Resultados</Link>
            </div>
          </div>
        </div>
        
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Indicadores</h5>
              <p className="card-text">Consulta tus indicadores de desempeño.</p>
              <Link to="/student/indicators" className="btn btn-success">Ver Indicadores</Link>
            </div>
          </div>
        </div>
        
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Plan de Mejoramiento</h5>
              <p className="card-text">Accede a tu plan personalizado de mejoramiento académico.</p>
              <Link to="/student/improvement" className="btn btn-warning">Ver Plan</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboardPage;
