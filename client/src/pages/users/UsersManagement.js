import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { Edit, Trash2, UserPlus, Shield, User, Mail, Phone, UserCheck } from 'lucide-react';

const UsersManagement = () => {
  const { user, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incompleteUsers, setIncompleteUsers] = useState({ students: [], teachers: [] });
  const [filter, setFilter] = useState('all'); // all, estudiante, docente, administrador, super_administrador
  const [searchFilters, setSearchFilters] = useState({
    name: '',
    email: '',
    institution: ''  // ✨ AGREGADO: filtro por institución
  });

  useEffect(() => {
    if (!isAuthReady) return;
    
    if (user && user.role === 'super_administrador') {
      fetchUsers();
      fetchIncompleteUsers();
    } else {
      navigate('/');
    }
  }, [user, isAuthReady, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axiosClient.get('/admin/users');
      setUsers(response.data.data || response.data || []);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los usuarios',
        confirmButtonText: 'OK'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchIncompleteUsers = async () => {
    try {
      console.log('🔍 Cargando usuarios incompletos...');
      const [studentsResponse, teachersResponse] = await Promise.all([
        axiosClient.get('/users/incomplete/students'),
        axiosClient.get('/users/incomplete/teachers')
      ]);
      
      console.log('📊 Estudiantes incompletos:', studentsResponse.data);
      console.log('📊 Docentes incompletos:', teachersResponse.data);
      
      setIncompleteUsers({
        students: studentsResponse.data || [],
        teachers: teachersResponse.data || []
      });
      
      console.log('✅ Usuarios incompletos cargados correctamente');
    } catch (error) {
      console.error('❌ Error al cargar usuarios incompletos:', error);
      console.error('❌ Detalles del error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      // No mostrar error al usuario, solo loguear
      // Si el error es 404, significa que los endpoints no están disponibles
      // En ese caso, simplemente no mostrar los botones de completar registro
    }
  };

  // Verificar si un usuario tiene registro incompleto
  const hasIncompleteRegistration = (userItem) => {
    if (userItem.role === 'estudiante') {
      return incompleteUsers.students.some(u => u.id === userItem.id);
    }
    if (userItem.role === 'docente') {
      return incompleteUsers.teachers.some(u => u.id === userItem.id);
    }
    return false;
  };

  // Manejar completar registro
  const handleCompleteRegistration = (userItem) => {
    // Establecer las banderas necesarias en localStorage
    localStorage.setItem('user_id', userItem.id);
    localStorage.setItem('completing_user_id', userItem.id);
    localStorage.setItem('created_by_admin', 'true');
    
    // Redirigir según el rol
    if (userItem.role === 'estudiante') {
      navigate('/CompleteStudent');
    } else if (userItem.role === 'docente') {
      navigate('/CompleteTeacher');
    }
  };

  const handleDelete = async (userId, userName) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await axiosClient.delete(`/admin/users/${userId}`);
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'Usuario eliminado exitosamente',
          confirmButtonText: 'OK'
        });
        fetchUsers(); // Recargar lista
      } catch (error) {
        console.error('Error al eliminar usuario:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.message || 'No se pudo eliminar el usuario',
          confirmButtonText: 'OK'
        });
      }
    }
  };

  const handleStatusChange = async (userId, currentStatus) => {
    // Normalize currentStatus to number if it's a string
    // Handle 'pendiente' as inactive
    const currentStatusNum = typeof currentStatus === 'string' 
      ? (currentStatus.toLowerCase() === 'activo' || currentStatus === '1' ? 1 : 0)
      : (currentStatus === 1 ? 1 : 0);
    
    const newStatus = currentStatusNum === 1 ? 0 : 1;
    const statusText = newStatus === 1 ? 'activar' : 'desactivar';
    
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas ${statusText} este usuario?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Sí, ${statusText}`,
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await axiosClient.put(`/admin/users/${userId}`, { estado: newStatus });
        Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: `Usuario ${statusText === 'activar' ? 'activado' : 'desactivado'} exitosamente`,
          confirmButtonText: 'OK'
        });
        fetchUsers(); // Recargar lista
      } catch (error) {
        console.error('Error al actualizar estado:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.message || 'No se pudo actualizar el estado del usuario',
          confirmButtonText: 'OK'
        });
      }
    }
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      'super_administrador': { class: 'bg-danger', text: 'Super Admin', icon: <Shield size={14} /> },
      'administrador': { class: 'bg-warning', text: 'Admin', icon: <Shield size={14} /> },
      'docente': { class: 'bg-info', text: 'Docente', icon: <User size={14} /> },
      'estudiante': { class: 'bg-success', text: 'Estudiante', icon: <User size={14} /> }
    };

    const config = roleConfig[role] || { class: 'bg-secondary', text: role, icon: <User size={14} /> };
    
    return (
      <span className={`badge ${config.class} text-white d-flex align-items-center gap-1`} style={{ width: 'fit-content' }}>
        {config.icon}
        {config.text}
      </span>
    );
  };

  // Helper function to normalize estado value (handles both string and number)
  const isActive = (estado) => {
    if (estado === null || estado === undefined) {
      return true; // Default to active if not set
    }
    // Handle string values
    if (typeof estado === 'string') {
      const estadoLower = estado.toLowerCase();
      return estadoLower === 'activo' || estado === '1';
      // 'pendiente' and 'inactivo' are treated as inactive
    }
    // Handle number values
    return estado === 1 || estado === '1';
  };

  // Helper function to get estado as number for API calls
  const getEstadoAsNumber = (estado) => {
    if (estado === null || estado === undefined) {
      return 1; // Default to active
    }
    if (typeof estado === 'string') {
      const estadoLower = estado.toLowerCase();
      // 'pendiente' is treated as inactive (0)
      return (estadoLower === 'activo' || estado === '1') ? 1 : 0;
    }
    return estado === 1 ? 1 : 0;
  };

  const filteredUsers = users.filter(u => {
    // Filtro por rol
    const matchesRole = filter === 'all' || u.role === filter;
    
    // Filtros por nombre, email e institución
    const matchesName = !searchFilters.name || (u.name || '').toLowerCase().includes(searchFilters.name.toLowerCase());
    const matchesEmail = !searchFilters.email || (u.email || '').toLowerCase().includes(searchFilters.email.toLowerCase());
    const matchesInstitution = !searchFilters.institution || (u.institution || '').toLowerCase().includes(searchFilters.institution.toLowerCase());
    
    return matchesRole && matchesName && matchesEmail && matchesInstitution;
  });

  const handleSearchFilterChange = (field, value) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearSearchFilters = () => {
    setSearchFilters({ name: '', email: '', institution: '' });
  };

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
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Gestión de Usuarios</h2>
          <p className="text-muted mb-0">Administra todos los usuarios del sistema</p>
        </div>
        <Link to="/admin/users/new" className="btn btn-primary">
          <UserPlus size={20} className="me-2" />
          Nuevo Usuario
        </Link>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="card-body">
          {/* Filtros por rol */}
          <div className="mb-3">
            <label className="form-label small text-muted mb-2">Filtrar por Rol</label>
            <div className="btn-group" role="group">
              <button
                type="button"
                className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setFilter('all')}
              >
                Todos ({users.length})
              </button>
              <button
                type="button"
                className={`btn ${filter === 'super_administrador' ? 'btn-danger' : 'btn-outline-danger'}`}
                onClick={() => setFilter('super_administrador')}
              >
                Super Admin ({users.filter(u => u.role === 'super_administrador').length})
              </button>
              <button
                type="button"
                className={`btn ${filter === 'administrador' ? 'btn-warning' : 'btn-outline-warning'}`}
                onClick={() => setFilter('administrador')}
              >
                Admin ({users.filter(u => u.role === 'administrador').length})
              </button>
              <button
                type="button"
                className={`btn ${filter === 'docente' ? 'btn-info' : 'btn-outline-info'}`}
                onClick={() => setFilter('docente')}
              >
                Docentes ({users.filter(u => u.role === 'docente').length})
              </button>
              <button
                type="button"
                className={`btn ${filter === 'estudiante' ? 'btn-success' : 'btn-outline-success'}`}
                onClick={() => setFilter('estudiante')}
              >
                Estudiantes ({users.filter(u => u.role === 'estudiante').length})
              </button>
            </div>
          </div>
          
          {/* Filtros de búsqueda rápida */}
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label small text-muted">Buscar por Nombre</label>
              <div className="input-group">
                <span className="input-group-text">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nombre del usuario"
                  value={searchFilters.name}
                  onChange={(e) => handleSearchFilterChange('name', e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label small text-muted">Buscar por Email</label>
              <div className="input-group">
                <span className="input-group-text">
                  <Mail size={16} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Email del usuario"
                  value={searchFilters.email}
                  onChange={(e) => handleSearchFilterChange('email', e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label small text-muted">Buscar por Institución</label>
              <div className="input-group">
                <span className="input-group-text">
                  <Shield size={16} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nombre de la institución"
                  value={searchFilters.institution}
                  onChange={(e) => handleSearchFilterChange('institution', e.target.value)}
                />
              </div>
            </div>
          </div>
          
          {(searchFilters.name || searchFilters.email || searchFilters.institution) && (
            <div className="mt-3">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={clearSearchFilters}
              >
                Limpiar Búsqueda
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="card">
        <div className="card-body">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted">No hay usuarios para mostrar</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Fecha de Creación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((userItem) => (
                    <tr key={userItem.id} className={hasIncompleteRegistration(userItem) ? 'table-warning' : ''}>
                      <td>{userItem.id}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <User size={18} className="text-muted" />
                          {userItem.name}
                          {hasIncompleteRegistration(userItem) && (
                            <span className="badge bg-warning text-dark" title="Registro incompleto">
                              Incompleto
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <Mail size={18} className="text-muted" />
                          {userItem.email}
                        </div>
                      </td>
                      <td>
                        {userItem.phone ? (
                          <div className="d-flex align-items-center gap-2">
                            <Phone size={18} className="text-muted" />
                            {userItem.phone}
                          </div>
                        ) : (
                          <span className="text-muted">N/A</span>
                        )}
                      </td>
                      <td>{getRoleBadge(userItem.role)}</td>
                      <td>
                        <button
                          className={`btn btn-sm ${isActive(userItem.estado) ? 'btn-success' : 'btn-secondary'}`}
                          onClick={() => handleStatusChange(userItem.id, getEstadoAsNumber(userItem.estado))}
                          title={isActive(userItem.estado) ? 'Activo - Click para desactivar' : 'Inactivo - Click para activar'}
                        >
                          {isActive(userItem.estado) ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td>
                        {userItem.created_at 
                          ? new Date(userItem.created_at).toLocaleDateString('es-ES')
                          : 'N/A'}
                      </td>
                      <td>
                        <div className="d-flex gap-2 flex-wrap">
                          {/* Botón para completar registro (solo si tiene registro incompleto) */}
                          {hasIncompleteRegistration(userItem) && (
                            <button
                              className="btn btn-sm btn-outline-warning"
                              onClick={() => handleCompleteRegistration(userItem)}
                              title="Completar registro de datos"
                            >
                              <UserCheck size={16} />
                            </button>
                          )}
                          <Link
                            to={`/admin/users/${userItem.id}/edit`}
                            className="btn btn-sm btn-outline-primary"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </Link>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(userItem.id, userItem.name)}
                            disabled={userItem.id === user.id}
                            title={userItem.id === user.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersManagement;

