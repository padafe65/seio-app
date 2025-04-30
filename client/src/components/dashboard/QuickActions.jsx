// components/dashboard/QuickActions.jsx

import React from 'react';
import { useAuth } from '../../hooks/use-auth';
import { PlusCircle, Edit, UserPlus, Download } from 'lucide-react';
import { useLocation } from 'wouter';

const QuickActions = () => {
  const { user } = useAuth();
  const [_, navigate] = useLocation();

  const actions = {
    teacher: [
      {
        icon: <PlusCircle className="text-primary text-xl mb-1" />,
        label: 'Nuevo Cuestionario',
        route: '/questionnaires',
        bg: 'bg-primary',
      },
      {
        icon: <Edit className="text-secondary text-xl mb-1" />,
        label: 'Calificar',
        route: '/grades',
        bg: 'bg-secondary',
      },
      {
        icon: <UserPlus className="text-accent text-xl mb-1" />,
        label: 'Añadir Estudiante',
        route: '/students',
        bg: 'bg-accent',
      },
      {
        icon: <Download className="text-success text-xl mb-1" />,
        label: 'Exportar Reportes',
        route: null,
        bg: 'bg-success',
      },
    ],
    student: [
      {
        icon: <PlusCircle className="text-primary text-xl mb-1" />,
        label: 'Ver Cuestionarios',
        route: '/questionnaires',
        bg: 'bg-primary',
      },
      {
        icon: <Edit className="text-secondary text-xl mb-1" />,
        label: 'Mis Calificaciones',
        route: '/grades',
        bg: 'bg-secondary',
      },
      {
        icon: <UserPlus className="text-accent text-xl mb-1" />,
        label: 'Mis Indicadores',
        route: '/indicators',
        bg: 'bg-accent',
      },
      {
        icon: <Download className="text-success text-xl mb-1" />,
        label: 'Descargar Reportes',
        route: null,
        bg: 'bg-success',
      },
    ],
  };

  const userActions = actions[user?.role] || [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-medium text-gray-800">Acciones Rápidas</h2>
      </div>

      <div className="p-5 grid grid-cols-2 gap-3">
        {userActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => action.route && navigate(action.route)}
            className={`flex flex-col items-center justify-center p-3 ${action.bg} bg-opacity-5 rounded-lg hover:bg-opacity-10 transition duration-150`}
          >
            {action.icon}
            <span className="text-xs font-medium text-gray-700">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
