// client/src/pages/Profile.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Edit2, Save, X, Lock } from 'lucide-react';
import ImageUploader from '../components/ImageUploader';
import UserAvatar from '../components/UserAvatar';
import ChangePasswordModal from '../components/ChangePasswordModal';
import axios from 'axios';

const notiMySwal = withReactContent(Swal);
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Profile = () => {
  const { user, authToken, updateUserProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    institution: user?.institution || '',
    profile_image: user?.profile_image || null
  });

  useEffect(() => {
    setProfileLoading(true);
    
    if (!authToken) {
      setProfileLoading(false);
      navigate('/login');
      return;
    }

    // Obtener datos actualizados del usuario desde el servidor
    const fetchUserData = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/admin/me`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        if (response.data && response.data.data) {
          const userData = response.data.data;
          setProfileData({
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || '',
            institution: userData.institution || '',
            profile_image: userData.profile_image || null
          });
        } else if (user) {
          // Fallback: usar datos del contexto
          setProfileData({
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            institution: user?.institution || '',
            profile_image: user?.profile_image || null
          });
        }
      } catch (error) {
        console.warn('⚠️ Error obteniendo datos del servidor:', error.message);
        // Usar datos del contexto si falla el servidor
        if (user) {
          setProfileData({
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            institution: user?.institution || '',
            profile_image: user?.profile_image || null
          });
        }
      } finally {
        setProfileLoading(false);
      }
    };

    fetchUserData();
  }, [authToken, navigate, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = (imageUrl) => {
    setProfileData(prev => ({
      ...prev,
      profile_image: imageUrl
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await axios.put(
        `${API_URL}/api/admin/update-profile`,
        {
          name: profileData.name,
          phone: profileData.phone,
          institution: profileData.institution
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.data) {
        // Acceder a los datos - pueden estar en response.data directamente o en response.data.data
        const serverData = response.data.data ? response.data.data : response.data;
        
        // Actualizar el contexto con los nuevos datos
        const updatedUser = {
          ...user,
          id: serverData.id || user?.id,
          name: serverData.name || profileData.name,
          email: serverData.email || user?.email,
          phone: serverData.phone || profileData.phone,
          institution: serverData.institution || profileData.institution,
          profile_image: serverData.profile_image || profileData.profile_image,
          role: serverData.role || user?.role,
          estado: serverData.estado || user?.estado
        };
        
        // Usar el método del contexto para actualizar en toda la app
        updateUserProfile(updatedUser);
        
        // Actualizar profileData también
        setProfileData({
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          institution: updatedUser.institution,
          profile_image: updatedUser.profile_image
        });
        
        setEditMode(false);
        setUpdateSuccess(true);
        notiMySwal.fire({
          icon: 'success',
          title: 'Éxito',
          text: 'Perfil actualizado correctamente',
          confirmButtonColor: '#198754'
        });
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = error.response?.data?.message || 'Error al actualizar el perfil';
      notiMySwal.fire({
        icon: 'error',
        title: 'Error',
        text: errorMsg,
        confirmButtonColor: '#3085d6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Restaurar datos a los originales del servidor o contexto
    if (user) {
      setProfileData({
        name: user?.name || profileData.name,
        email: user?.email || profileData.email,
        phone: user?.phone || profileData.phone,
        institution: user?.institution || profileData.institution,
        profile_image: user?.profile_image || profileData.profile_image
      });
    }
    setEditMode(false);
  };

  const handleBackToDashboard = () => {
    // Navegar al dashboard según el rol del usuario
    if (user?.role === 'estudiante') {
      navigate('/student/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  if (!authToken) {
    return (
      <div className="container mt-5">
        <div className="alert alert-warning text-center">
          <p>Redirigiendo a login...</p>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="container mt-5">
        <div className="alert alert-info text-center">
          <p>Cargando perfil...</p>
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!profileData.name && (!user || !user.name)) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger text-center">
          <p>Error al cargar el perfil. Por favor recarga la página.</p>
          <button 
            className="btn btn-primary mt-2"
            onClick={() => window.location.reload()}
          >
            Recargar Página
          </button>
        </div>
      </div>
    );
  }

  // Usar userId de profileData o del user context
  const userId = user?.id || profileData.id;

  return (
    <div className="container mt-5 mb-5">
      <div className="row">
        <div className="col-md-8 mx-auto">
          <div className="card shadow-lg">
            {/* Header del perfil */}
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <h3 className="mb-0">💼 Mi Perfil</h3>
              <button 
                className={`btn btn-sm ${editMode ? 'btn-warning' : 'btn-light'}`}
                onClick={() => editMode ? handleCancel() : setEditMode(true)}
              >
                {editMode ? (
                  <>
                    <X size={16} className="me-2" />
                    Cancelar
                  </>
                ) : (
                  <>
                    <Edit2 size={16} className="me-2" />
                    Editar
                  </>
                )}
              </button>
            </div>

            <div className="card-body">
              {/* Avatar y foto de perfil */}
              <div className="text-center mb-4">
                <UserAvatar 
                  user={{ 
                    id: userId,
                    name: profileData.name || user?.name, 
                    profile_image: profileData.profile_image 
                  }} 
                  size="lg" 
                  authToken={authToken} 
                />
                <p className="text-muted mt-2 small">
                  {editMode ? 'Haz clic abajo para cambiar tu foto' : 'Tu foto de perfil'}
                </p>
              </div>

              {/* Subir/cambiar foto solo en modo edición */}
              {editMode && (
                <div className="mb-4 border-bottom pb-4">
                  <ImageUploader 
                    currentImage={profileData.profile_image ? `${API_URL}${profileData.profile_image}` : null}
                    onImageUpload={handleImageUpload}
                    userId={userId}
                  />
                </div>
              )}

              {/* Formulario de datos */}
              <form>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">👤 Nombre</label>
                    {editMode ? (
                      <input 
                        type="text" 
                        name="name"
                        value={profileData.name}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="Tu nombre completo"
                      />
                    ) : (
                      <div className="p-2 bg-light rounded">{profileData.name}</div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">📧 Email</label>
                    <div className="p-2 bg-light rounded text-muted">
                      {profileData.email || user?.email}
                      <br />
                      <small>(No editable)</small>
                    </div>
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">📱 Teléfono</label>
                    {editMode ? (
                      <input 
                        type="tel" 
                        name="phone"
                        value={profileData.phone}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="Ej: 3001234567"
                      />
                    ) : (
                      <div className="p-2 bg-light rounded">
                        {profileData.phone || <span className="text-muted">No especificado</span>}
                      </div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">🏫 Institución</label>
                    {editMode ? (
                      <input 
                        type="text" 
                        name="institution"
                        value={profileData.institution}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="Nombre de la institución"
                      />
                    ) : (
                      <div className="p-2 bg-light rounded">
                        {profileData.institution || <span className="text-muted">No especificada</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">🎭 Rol</label>
                    <div className="p-2 bg-light rounded">
                      <span className="badge bg-info px-3 py-2">
                        {user?.role === 'docente' ? '👨‍🏫 Docente' : 
                         user?.role === 'estudiante' ? '👨‍🎓 Estudiante' : 
                         user?.role === 'administrador' ? '🔧 Administrador' : 
                         user?.role === 'super_administrador' ? '👑 Super Administrador' : user?.role || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">✅ Estado</label>
                    <div className="p-2 bg-light rounded">
                      <span className={`badge px-3 py-2 ${
                        user?.estado === 'activo' ? 'bg-success' : 
                        user?.estado === 'pendiente' ? 'bg-warning text-dark' : 'bg-danger'
                      }`}>
                        {user?.estado === 'activo' ? '✅ Activo' : 
                         user?.estado === 'pendiente' ? '⏳ Pendiente' : user?.estado === 'suspendido' ? '❌ Suspendido' : '❌ Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="row">
                  <div className="col-12">
                    <label className="form-label fw-bold">📅 Fecha de Registro</label>
                    <div className="p-2 bg-light rounded text-muted">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : 'N/A'}
                    </div>
                  </div>
                </div>
              </form>

              {/* Botones de acción */}
              {editMode && (
                <div className="mt-4 d-flex gap-2">
                  <button 
                    className="btn btn-success flex-grow-1"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save size={18} className="me-2" />
                        Guardar Cambios
                      </>
                    )}
                  </button>
                  <button 
                    className="btn btn-secondary flex-grow-1"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    <X size={18} className="me-2" />
                    Cancelar
                  </button>
                </div>
              )}

              {/* Sección de Seguridad */}
              {!editMode && (
                <div className="mt-4 pt-4 border-top">
                  <h5 className="mb-3">🔐 Seguridad</h5>
                  <button 
                    className="btn btn-warning w-100"
                    onClick={() => setShowChangePasswordModal(true)}
                  >
                    <Lock size={18} className="me-2" />
                    Cambiar Contraseña
                  </button>
                </div>
              )}

              {/* Botón para volver al Dashboard */}
              {!editMode && (
                <div className="mt-4">
                  <button 
                    className="btn btn-primary w-100"
                    onClick={handleBackToDashboard}
                  >
                    ← Volver al Dashboard
                  </button>
                  {updateSuccess && (
                    <div className="alert alert-success mt-3 mb-0" role="alert">
                      ✅ Cambios guardados exitosamente
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal para cambiar contraseña */}
      <ChangePasswordModal 
        show={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        authToken={authToken}
        onPasswordChanged={() => {
          // Logout automático después de cambiar contraseña
          logout();
          navigate('/login');
        }}
      />
    </div>
  );
};

export default Profile;
