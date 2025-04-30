import React from 'react';
import { useAuth } from '../../hooks/use-auth.js';
import { FileText, ChartLine, Target } from 'lucide-react';

const ActivityTable = ({ activities }) => {
  const { user } = useAuth();

  const getIcon = (type) => {
    switch (type) {
      case 'questionnaire':
        return (
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-primary">
            <FileText size={16} />
          </div>
        );
      case 'grade':
        return (
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-500">
            <ChartLine size={16} />
          </div>
        );
      case 'indicator':
        return (
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-500">
            <Target size={16} />
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-success bg-opacity-10 text-success">
            Completado
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-warning bg-opacity-10 text-warning">
            Pendiente
          </span>
        );
      case 'updated':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-success bg-opacity-10 text-success">
            Actualizado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-800">Actividad Reciente</h2>
          <button className="text-primary hover:text-primary-dark font-medium text-sm">Ver Todo</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actividad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {activities.map((activity) => (
              <tr key={activity.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getIcon(activity.type)}
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{activity.title}</div>
                      <div className="text-sm text-gray-500">{activity.subtitle}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{activity.user}</div>
                  <div className="text-sm text-gray-500">{activity.userRole}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {activity.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(activity.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityTable;
