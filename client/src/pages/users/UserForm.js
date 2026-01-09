import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { ArrowLeft, Save } from 'lucide-react';

const UserForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: '',
    estado: 1
  });

  useEffect(() => {
    if (!isAuthReady) return;
    
    if (!user || user.role !== 'super_administrador') {
      navigate('/');
      return;
    }

    if (id) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [id, user, isAuthReady, navigate]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await axiosClient.get(`/admin/users/${id}`);
      const userData = response.data.data || response.data;
      setFormData({
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        password: '', // No cargar la contraseña
        role: userData.role || '',
        estado: userData.estado !== undefined ? userData.estado : 1
      });
    } catch (error) {
      console.error('Error al cargar usuario:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el usuario',
        confirmButtonText: 'OK'
      }).then(() => navigate('/admin/users'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.name || !formData.email || !formData.role) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos obligatorios',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (!id && !formData.password) {
      Swal.fire({
        icon: 'warning',
        title: 'Contraseña requerida',
        text: 'La contraseña es obligatoria para nuevos usuarios',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (formData.password && formData.password.length < 6) {
      Swal.fire({
        icon: 'warning',
        title: 'Contraseña inválida',
        text: 'La contraseña debe tener al menos 6 caracteres',
        confirmButtonText: 'OK'
      });
      return;
    }

    try {
      setSaving(true);
      
      const dataToSend = { ...formData };
      // Si es edición y no se cambió la contraseña, no enviarla
      if (id && !dataToSend.password) {
        delete dataToSend.password;
      }

      if (id) {
        // Actualizar usuario existente
        await axiosClient.put(`/admin/users/${id}`, dataToSend);
        Swal.fire({
          icon: 'success',
          title: 'Usuario actualizado',
          text: 'El usuario se ha actualizado exitosamente',
          confirmButtonText: 'OK'
        });
      } else {
        // Crear nuevo usuario
        await axiosClient.post('/admin/users', dataToSend);
        Swal.fire({
          icon: 'success',
          title: 'Usuario creado',
          text: 'El usuario se ha creado exitosamente',
          confirmButtonText: 'OK'
        });
      }
      
      navigate('/admin/users');
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo guardar el usuario',
        confirmButtonText: 'OK'
      });
    } finally {
      setSaving(false);
    }
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
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            {id ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
          </h5>
          <button
            className="btn btn-light btn-sm"
            onClick={() => navigate('/admin/users')}
          >
            <ArrowLeft size={18} className="me-1" />
            Volver
          </button>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="name" className="form-label">
                  Nombre Completo <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="email" className="form-label">
                  Correo Electrónico <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="phone" className="form-label">Teléfono</label>
                <input
                  type="text"
                  className="form-control"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Opcional"
                />
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="role" className="form-label">
                  Rol <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccione un rol</option>
                  <option value="estudiante">Estudiante</option>
                  <option value="docente">Docente</option>
                  <option value="administrador">Administrador</option>
                  <option value="super_administrador">Super Administrador</option>
                </select>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="password" className="form-label">
                  Contraseña {id ? <span className="text-muted">(dejar vacío para no cambiar)</span> : <span className="text-danger">*</span>}
                </label>
                <input
                  type="password"
                  className="form-control"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={!id}
                  minLength={6}
                  placeholder={id ? "Dejar vacío para mantener la contraseña actual" : "Mínimo 6 caracteres"}
                />
              </div>

              {id && (
                <div className="col-md-6 mb-3">
                  <label htmlFor="estado" className="form-label">Estado</label>
                  <select
                    className="form-select"
                    id="estado"
                    name="estado"
                    value={formData.estado}
                    onChange={(e) => setFormData(prev => ({ ...prev, estado: parseInt(e.target.value) }))}
                  >
                    <option value={1}>Activo</option>
                    <option value={0}>Inactivo</option>
                  </select>
                </div>
              )}
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/admin/users')}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={18} className="me-2" />
                    {id ? 'Actualizar' : 'Crear'} Usuario
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserForm;

