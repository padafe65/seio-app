import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import PerformanceSummary from '../components/dashboard/PerformanceSummary';
import GradeProgress from '../components/dashboard/GradeProgress';
import EventsList from '../components/dashboard/EventsList';
import ActivityTable from '../components/dashboard/ActivityTable';
import QuickActions from '../components/dashboard/QuickActions';
import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Simular carga de datos
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  // Simulación de datos de ejemplo:
  const subjects = [
    { subject: 'Matemáticas', percentage: 85 },
    { subject: 'Ciencias', percentage: 90 },
    { subject: 'Historia', percentage: 78 },
  ];

  const grades = [
    { grade: '1°', progress: 70 },
    { grade: '2°', progress: 85 },
    { grade: '3°', progress: 60 },
  ];

  const events = [
    { id: 1, date: { day: 30, month: 'ABR' }, title: 'Examen final', details: 'Examen de matemáticas en salón 3B' },
    { id: 2, date: { day: 5, month: 'MAY' }, title: 'Entrega de proyectos', details: 'Fecha límite para proyectos de ciencias' },
  ];

  const activities = [
    { id: 1, type: 'questionnaire', title: 'Nuevo cuestionario', subtitle: 'Matemáticas 3°', user: 'Juan Pérez', userRole: 'Estudiante', date: '27/04/2025', status: 'completed' },
    { id: 2, type: 'grade', title: 'Calificación actualizada', subtitle: 'Ciencias 2°', user: 'Ana López', userRole: 'Estudiante', date: '26/04/2025', status: 'updated' },
  ];

  const stats = [
    { label: 'Materias Completadas', value: 5 },
    { label: 'Actividades Pendientes', value: 2 },
    { label: 'Fases Completadas', value: 3 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Bienvenida */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {user.role === 'estudiante' ? `Hola, ${user.name}` : `Hola, Profesor(a) ${user.name}`}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {user.role === 'estudiante' ? 'Aquí puedes ver tu progreso académico.' : 'Aquí puedes gestionar y revisar el progreso de tus alumnos.'}
        </p>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-gray-500 text-sm">{stat.label}</div>
            <div className="text-2xl font-bold text-gray-800">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Acciones Rápidas (solo para docentes) */}
      {user.role === 'docente' && (
        <QuickActions />
      )}

      {/* Botón para crear preguntas (solo docentes) */}
      {user.role === 'docente' && (
        <div className="d-flex justify-content-end mb-4">
          <Link to="/crear-pregunta" className="btn btn-primary d-flex align-items-center gap-2">
            <PlusCircle size={20} />
            Crear Nueva Pregunta
          </Link>
        </div>
      )}

      {/* Secciones principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {user.role === 'estudiante' && (
          <>
            <PerformanceSummary subjects={subjects} />
            <GradeProgress grades={grades} />
            <EventsList events={events} />
          </>
        )}

        {user.role === 'docente' && (
          <>
            <GradeProgress grades={grades} />
            <ActivityTable activities={activities} />
            <EventsList events={events} />
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
