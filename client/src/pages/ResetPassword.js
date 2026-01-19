import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Mail, Lock, CheckCircle } from 'lucide-react';

const notiMySwal = withReactContent(Swal);

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  // Estado para solicitar recuperación
  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  
  // Estado para restablecer con token
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokenValid, setTokenValid] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Verificar token si viene en la URL
  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      setLoading(true);
      const response = await axiosClient.get(`/auth/verify-reset-token/${token}`);
      if (response.data.success) {
        setTokenValid(true);
        setUserInfo(response.data);
      } else {
        setTokenValid(false);
      }
    } catch (error) {
      console.error('Error al verificar token:', error);
      setTokenValid(false);
      notiMySwal.fire({
        icon: 'error',
        title: 'Token inválido',
        text: error.response?.data?.error || 'El enlace de recuperación no es válido o ha expirado.',
        confirmButtonText: 'Solicitar nuevo enlace'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axiosClient.post('/auth/forgot-password', { email });
      
      if (response.data.success) {
        setRequestSent(true);
        notiMySwal.fire({
          icon: 'success',
          title: 'Correo enviado',
          html: `
            <p>Si el correo <strong>${email}</strong> está registrado, recibirás un enlace para restablecer tu contraseña.</p>
            <p class="text-muted small mt-2">Revisa tu bandeja de entrada y spam.</p>
          `,
          confirmButtonText: 'Entendido'
        });
      }
    } catch (error) {
      console.error('Error al solicitar recuperación:', error);
      notiMySwal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.error || 'Error al solicitar recuperación de contraseña.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      notiMySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Las contraseñas no coinciden.'
      });
      return;
    }

    if (newPassword.length < 6) {
      notiMySwal.fire({
        icon: 'error',
        title: 'Error',
        text: 'La contraseña debe tener al menos 6 caracteres.'
      });
      return;
    }

    try {
      setLoading(true);
      const response = await axiosClient.post('/auth/reset-password', {
        token,
        newPassword
      });

      if (response.data.success) {
        notiMySwal.fire({
          icon: 'success',
          title: 'Contraseña actualizada',
          text: 'Tu contraseña ha sido restablecida correctamente.',
          confirmButtonText: 'Ir a inicio de sesión'
        }).then(() => {
          navigate('/');
        });
      }
    } catch (error) {
      console.error('Error al restablecer contraseña:', error);
      notiMySwal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.error || 'Error al restablecer la contraseña.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Si hay token, mostrar formulario de restablecimiento
  if (token) {
    if (loading && tokenValid === null) {
      return (
        <div className="container mt-5">
          <div className="row justify-content-center">
            <div className="col-md-6">
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Verificando enlace...</span>
                </div>
                <p className="mt-3">Verificando enlace de recuperación...</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (tokenValid === false) {
      return (
        <div className="container mt-5">
          <div className="row justify-content-center">
            <div className="col-md-6">
              <div className="card">
                <div className="card-body text-center">
                  <h4 className="text-danger mb-3">Enlace Inválido</h4>
                  <p>El enlace de recuperación no es válido o ha expirado.</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate('/reset-password')}
                  >
                    Solicitar nuevo enlace
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (tokenValid === true) {
      return (
        <div className="container mt-5">
          <div className="row justify-content-center">
            <div className="col-md-6">
              <div className="card shadow">
                <div className="card-header bg-primary text-white">
                  <h4 className="mb-0 d-flex align-items-center">
                    <Lock size={24} className="me-2" />
                    Restablecer Contraseña
                  </h4>
                </div>
                <div className="card-body">
                  {userInfo && (
                    <div className="alert alert-info">
                      <strong>Usuario:</strong> {userInfo.name} ({userInfo.email})
                    </div>
                  )}
                  <form onSubmit={handleResetPassword}>
                    <div className="mb-3">
                      <label htmlFor="newPassword" className="form-label">Nueva Contraseña</label>
                      <input
                        type="password"
                        id="newPassword"
                        className="form-control"
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="mb-3">
                      <label htmlFor="confirmPassword" className="form-label">Confirmar Contraseña</label>
                      <input
                        type="password"
                        id="confirmPassword"
                        className="form-control"
                        placeholder="Repite la contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="btn btn-primary w-100"
                      disabled={loading}
                    >
                      {loading ? 'Procesando...' : 'Restablecer Contraseña'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Si no hay token, mostrar formulario para solicitar recuperación
  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow">
            <div className="card-header bg-warning text-dark">
              <h4 className="mb-0 d-flex align-items-center">
                <Mail size={24} className="me-2" />
                Recuperar Contraseña
              </h4>
            </div>
            <div className="card-body">
              {requestSent ? (
                <div className="text-center py-4">
                  <CheckCircle size={64} className="text-success mb-3" />
                  <h5>Correo Enviado</h5>
                  <p>
                    Si el correo <strong>{email}</strong> está registrado, recibirás un enlace para restablecer tu contraseña.
                  </p>
                  <p className="text-muted small">
                    Revisa tu bandeja de entrada y carpeta de spam. El enlace expira en 1 hora.
                  </p>
                  <button 
                    className="btn btn-outline-primary mt-3"
                    onClick={() => {
                      setRequestSent(false);
                      setEmail('');
                    }}
                  >
                    Solicitar otro correo
                  </button>
                  <button 
                    className="btn btn-primary mt-3 ms-2"
                    onClick={() => navigate('/')}
                  >
                    Volver al inicio
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-muted">
                    Ingresa tu correo electrónico y te enviaremos un enlace seguro para restablecer tu contraseña.
                  </p>
                  <form onSubmit={handleRequestReset}>
                    <div className="mb-3">
                      <label htmlFor="email" className="form-label">Correo Electrónico</label>
                      <input
                        type="email"
                        id="email"
                        className="form-control"
                        placeholder="tu@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="btn btn-warning w-100"
                      disabled={loading}
                    >
                      {loading ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
                    </button>
                  </form>
                  <div className="mt-3 text-center">
                    <button 
                      className="btn btn-link"
                      onClick={() => navigate('/')}
                    >
                      Volver al inicio de sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
