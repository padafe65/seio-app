import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Users, UserCheck, BookOpen, BarChart3 } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const StatCard = ({ title, value, icon, color }) => (
  <div className={`bg-white p-4 rounded-lg shadow-sm border-l-4 ${color}`}>
    <div className="flex items-center">
      <div className="p-3 rounded-full bg-gray-100 mr-4">{icon}</div>
      <div>
        <div className="text-gray-500 text-sm">{title}</div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
      </div>
    </div>
  </div>
);

const SuperAdminDashboard = () => {
  const { user, authToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTeachers: 0,
    totalStudents: 0,
  });

  useEffect(() => {
    const fetchAdminData = async () => {
      if (user && user.role === 'super_administrador') {
        try {
          // This endpoint needs to be created in the backend
          const response = await axios.get(`${API_URL}/api/admin/stats`, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          setStats(response.data);
        } catch (error) {
          console.error('Error al cargar estadísticas del administrador:', error);
          // Set dummy data on error for now
          setStats({ totalUsers: 'N/A', totalTeachers: 'N/A', totalStudents: 'N/A' });
        }
      }
      setLoading(false);
    };

    fetchAdminData();
  }, [user, authToken]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Panel de Super Administrador</h1>
        <p className="text-sm text-gray-500 mt-1">Bienvenido, {user.name}. Gestión total del sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Usuarios Totales" value={stats.totalUsers} icon={<Users size={24} className="text-blue-500" />} color="border-blue-500" />
        <StatCard title="Docentes Registrados" value={stats.totalTeachers} icon={<UserCheck size={24} className="text-green-500" />} color="border-green-500" />
        <StatCard title="Estudiantes Inscritos" value={stats.totalStudents} icon={<BookOpen size={24} className="text-yellow-500" />} color="border-yellow-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h5 className="font-bold mb-3">Gestión de Usuarios</h5>
          <div className="flex flex-col space-y-2">
            <Link to="/estudiantes" className="btn btn-outline-primary">Gestionar Estudiantes</Link>
            <Link to="/admin/users" className="btn btn-outline-secondary">Gestionar Todos los Usuarios</Link>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h5 className="font-bold mb-3">Contenido Académico</h5>
           <div className="flex flex-col space-y-2">
            <Link to="/cuestionarios" className="btn btn-outline-success">Gestionar Cuestionarios</Link>
            <Link to="/materias-categorias" className="btn btn-outline-warning">Gestionar Materias y Categorías</Link>
            <Link to="/indicadores" className="btn btn-outline-danger">Gestionar Indicadores</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
