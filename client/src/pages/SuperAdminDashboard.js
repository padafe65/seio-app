import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Users, FileText, Award, Settings, BarChart2, 
  CheckSquare, PlusCircle, BookOpen, UserPlus,
  Shield, Database, Activity
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

const SuperAdminDashboard = () => {
  const { user, authToken, isAuthReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalAdmins: 0,
    totalQuestionnaires: 0,
    totalQuestions: 0,
    totalResults: 0,
    totalImprovementPlans: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthReady || !authToken) {
        setLoading(false);
        return;
      }

      if (user && (user.role === 'super_administrador' || user.role === 'administrador')) {
        try {
          // Obtener estadísticas generales
          const [usersResponse, questionnairesResponse, studentsResponse] = await Promise.allSettled([
            axiosClient.get('/admin/users'),
            axiosClient.get('/questionnaires'),
            axiosClient.get('/students')
          ]);
          
          let totalUsers = 0;
          let totalStudents = 0;
          let totalTeachers = 0;
          let totalAdmins = 0;
          let totalQuestionnaires = 0;
          let totalStudentsCount = 0;

          // Procesar respuesta de usuarios
          if (usersResponse.status === 'fulfilled') {
            const users = usersResponse.value.data?.data || usersResponse.value.data || [];
            totalUsers = Array.isArray(users) ? users.length : 0;
            if (Array.isArray(users)) {
              totalStudents = users.filter(u => u.role === 'estudiante').length;
              totalTeachers = users.filter(u => u.role === 'docente').length;
              totalAdmins = users.filter(u => u.role === 'administrador' || u.role === 'super_administrador').length;
            }
          }

          // Procesar respuesta de cuestionarios
          if (questionnairesResponse.status === 'fulfilled') {
            const questionnaires = questionnairesResponse.value.data || [];
            totalQuestionnaires = Array.isArray(questionnaires) ? questionnaires.length : 0;
          }

          // Procesar respuesta de estudiantes
          if (studentsResponse.status === 'fulfilled') {
            const students = studentsResponse.value.data || [];
            totalStudentsCount = Array.isArray(students) ? students.length : 0;
          }

          setStats({
            totalUsers,
            totalStudents: totalStudentsCount || totalStudents,
            totalTeachers,
            totalAdmins,
            totalQuestionnaires,
            totalQuestions: 0,
            totalResults: 0,
            totalImprovementPlans: 0
          });
        } catch (error) {
          console.error('Error al cargar estadísticas:', error);
          // Si hay un error general, mantener valores por defecto
          setStats({
            totalUsers: 0,
            totalStudents: 0,
            totalTeachers: 0,
            totalAdmins: 0,
            totalQuestionnaires: 0,
            totalQuestions: 0,
            totalResults: 0,
            totalImprovementPlans: 0
          });
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [user, authToken, isAuthReady]);

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
      {/* Bienvenida */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">
          {user?.role === 'administrador' ? 'Panel de Administrador' : '👑 Panel de Super Administrador'}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Bienvenido, {user?.name}. Gestiona todos los aspectos del sistema.
        </p>
      </div>

      <div className="card border-primary mb-2">
        <div className="card-body py-2 px-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span className="fw-medium">Calificaciones por fase</span>
          <Link to="/calificaciones-fase" className="btn btn-primary btn-sm">Ver tabla y filtros</Link>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="row g-4">
        <div className="col-md-3 col-sm-6">
          <div className="card bg-primary text-white h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-white-50 small">Total Usuarios</div>
                  <div className="h3 mb-0">{stats.totalUsers}</div>
                </div>
                <Users size={40} className="opacity-75" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-sm-6">
          <div className="card bg-success text-white h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-white-50 small">Estudiantes</div>
                  <div className="h3 mb-0">{stats.totalStudents}</div>
                </div>
                <Users size={40} className="opacity-75" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-sm-6">
          <div className="card bg-info text-white h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-white-50 small">Docentes</div>
                  <div className="h3 mb-0">{stats.totalTeachers}</div>
                </div>
                <Shield size={40} className="opacity-75" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-sm-6">
          <div className="card bg-warning text-white h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-white-50 small">Cuestionarios</div>
                  <div className="h3 mb-0">{stats.totalQuestionnaires}</div>
                </div>
                <FileText size={40} className="opacity-75" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Gestión de Usuarios */}
      <div className="card">
        <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <Users size={20} className="me-2" />
            Gestión de Usuarios
          </h5>
          <Link to="/admin/users" className="btn btn-light btn-sm">
            <UserPlus size={16} className="me-1" />
            Gestionar Usuarios
          </Link>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <Link to="/admin/users" className="text-decoration-none">
                <div className="card border-primary h-100">
                  <div className="card-body text-center">
                    <Users size={48} className="text-primary mb-3" />
                    <h6 className="card-title">Ver Todos los Usuarios</h6>
                    <p className="card-text text-muted small">Administrar usuarios del sistema</p>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-md-4">
              <Link to="/admin/users/new" className="text-decoration-none">
                <div className="card border-success h-100">
                  <div className="card-body text-center">
                    <UserPlus size={48} className="text-success mb-3" />
                    <h6 className="card-title">Crear Nuevo Usuario</h6>
                    <p className="card-text text-muted small">Registrar un nuevo usuario</p>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-md-4">
              <Link to="/estudiantes" className="text-decoration-none">
                <div className="card border-info h-100">
                  <div className="card-body text-center">
                    <Users size={48} className="text-info mb-3" />
                    <h6 className="card-title">Gestionar Estudiantes</h6>
                    <p className="card-text text-muted small">Ver y administrar estudiantes</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Contenido Académico */}
      <div className="card">
        <div className="card-header bg-dark text-white">
          <h5 className="mb-0">
            <BookOpen size={20} className="me-2" />
            Contenido Académico
          </h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <Link to="/cuestionarios" className="text-decoration-none">
                <div className="card border-primary h-100">
                  <div className="card-body text-center">
                    <FileText size={48} className="text-primary mb-3" />
                    <h6 className="card-title">Cuestionarios</h6>
                    <p className="card-text text-muted small">Ver todos los cuestionarios</p>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-md-3">
              <Link to="/crear-pregunta" className="text-decoration-none">
                <div className="card border-success h-100">
                  <div className="card-body text-center">
                    <PlusCircle size={48} className="text-success mb-3" />
                    <h6 className="card-title">Crear Pregunta</h6>
                    <p className="card-text text-muted small">Agregar nueva pregunta</p>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-md-3">
              <Link to="/indicadores" className="text-decoration-none">
                <div className="card border-warning h-100">
                  <div className="card-body text-center">
                    <CheckSquare size={48} className="text-warning mb-3" />
                    <h6 className="card-title">Indicadores</h6>
                    <p className="card-text text-muted small">Gestionar indicadores</p>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-md-3">
              <Link to="/resultados" className="text-decoration-none">
                <div className="card border-info h-100">
                  <div className="card-body text-center">
                    <BarChart2 size={48} className="text-info mb-3" />
                    <h6 className="card-title">Resultados</h6>
                    <p className="card-text text-muted small">Ver todos los resultados</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Planes y Evaluaciones */}
      <div className="card">
        <div className="card-header bg-dark text-white">
          <h5 className="mb-0">
            <Award size={20} className="me-2" />
            Planes y Evaluaciones
          </h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <Link to="/planes-mejoramiento" className="text-decoration-none">
                <div className="card border-primary h-100">
                  <div className="card-body text-center">
                    <Award size={48} className="text-primary mb-3" />
                    <h6 className="card-title">Planes de Mejoramiento</h6>
                    <p className="card-text text-muted small">Ver todos los planes</p>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-md-4">
              <Link to="/planes-automaticos" className="text-decoration-none">
                <div className="card border-success h-100">
                  <div className="card-body text-center">
                    <Settings size={48} className="text-success mb-3" />
                    <h6 className="card-title">Sistema Automático</h6>
                    <p className="card-text text-muted small">Gestionar planes automáticos</p>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-md-4">
              <Link to="/evaluacion-fase" className="text-decoration-none">
                <div className="card border-warning h-100">
                  <div className="card-body text-center">
                    <CheckSquare size={48} className="text-warning mb-3" />
                    <h6 className="card-title">Evaluación de Fase</h6>
                    <p className="card-text text-muted small">Evaluar fases académicas</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones Rápidas */}
      <div className="card">
        <div className="card-header bg-dark text-white">
          <h5 className="mb-0">
            <Activity size={20} className="me-2" />
            Acciones Rápidas
          </h5>
        </div>
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2">
            <Link to="/admin/users" className="btn btn-primary">
              <Users size={18} className="me-2" />
              Gestionar Usuarios
            </Link>
            <Link to="/cuestionarios/nuevo" className="btn btn-success">
              <PlusCircle size={18} className="me-2" />
              Nuevo Cuestionario
            </Link>
            <Link to="/estudiantes/nuevo" className="btn btn-info">
              <UserPlus size={18} className="me-2" />
              Nuevo Estudiante
            </Link>
            <Link to="/materias-categorias" className="btn btn-warning">
              <Database size={18} className="me-2" />
              Materias y Categorías
            </Link>
            <Link to="/indicadores/nuevo" className="btn btn-secondary">
              <CheckSquare size={18} className="me-2" />
              Nuevo Indicador
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

