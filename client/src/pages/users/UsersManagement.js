import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { Edit, Trash2, UserPlus, Shield, User, Mail, Phone, Eye } from 'lucide-react';

const UsersManagement = () => {
  const { user, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, estudiante, docente, administrador, super_administrador

  useEffect(() => {
    if (!isAuthReady) return;
    
    if (user && user.role === 'super_administrador') {
      fetchUsers();
    } else {
      navigate('/');
    }
  }, [user, isAuthReady, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axiosClient.get('/admin/users');
      const usersData = response.data.data || response.data || [];
      
      // Debug: Verificar valores de estado recibidos
      if (usersData.length > 0) {
        console.log('🔍 Valores de estado recibidos (primeros 3):', usersData.slice(0, 3).map(u => ({
          id: u.id,
          name: u.name,
          estado: u.estado,
          estadoType: typeof u.estado
        })));
      }
      
      setUsers(usersData);
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
    // Normalizar el estado actual y cambiarlo: activo (1, '1', 'activo', true) -> inactivo (0), inactivo -> activo (1)
    const isCurrentlyActive = currentStatus === 1 || currentStatus === '1' || currentStatus === 'activo' || currentStatus === true;
    const newStatus = isCurrentlyActive ? 0 : 1;
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

  const filteredUsers = filter === 'all' 
    ? users 
    : users.filter(u => u.role === filter);

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
                    <tr key={userItem.id}>
                      <td>{userItem.id}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <User size={18} className="text-muted" />
                          {userItem.name}
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
                        {(() => {
                          // Normalizar el estado: puede venir como número (1/0), string ('1'/'0'), o string ('activo'/'inactivo')
                          const estado = userItem.estado;
                          const isActive = estado === 1 || estado === '1' || estado === 'activo' || estado === true;
                          return (
                            <button
                              className={`btn btn-sm ${isActive ? 'btn-success' : 'btn-secondary'}`}
                              onClick={() => handleStatusChange(userItem.id, userItem.estado)}
                              title={isActive ? 'Activo - Click para desactivar' : 'Inactivo - Click para activar'}
                            >
                              {isActive ? 'Activo' : 'Inactivo'}
                            </button>
                          );
                        })()}
                      </td>
                      <td>
                        {userItem.created_at 
                          ? new Date(userItem.created_at).toLocaleDateString('es-ES')
                          : 'N/A'}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
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

