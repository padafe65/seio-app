// client/src/components/ChangePasswordModal.js
import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import axios from 'axios';

const notiMySwal = withReactContent(Swal);
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ChangePasswordModal = ({ show, onClose, authToken, onPasswordChanged }) => {
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'La contraseña actual es requerida';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'La nueva contraseña es requerida';
    } else if (formData.newPassword.length < 8 || !/[^\p{L}\p{N}]/u.test(formData.newPassword)) {
      newErrors.newPassword = 'Mínimo 8 caracteres e incluir un carácter especial';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Debe confirmar la nueva contraseña';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'La nueva contraseña debe ser diferente a la actual';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Limpiar error del campo
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.put(
        `${API_URL}/api/admin/change-password`,
        {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
          confirmPassword: formData.confirmPassword
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        notiMySwal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Contraseña cambiada correctamente. Por favor inicia sesión nuevamente.',
          confirmButtonColor: '#198754'
        }).then(() => {
          // Llamar callback para logout
          if (onPasswordChanged) {
            onPasswordChanged();
          }
          onClose();
        });

        // Limpiar formulario
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error.response?.data?.message || 'Error al cambiar la contraseña';
      
      notiMySwal.fire({
        icon: 'error',
        title: 'Error',
        text: errorMessage,
        confirmButtonColor: '#3085d6'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!show) {
    return null;
  }

  return (
    <div 
      className="modal d-block" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div 
        className="modal-dialog modal-dialog-centered" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <Lock size={20} className="me-2" />
              Cambiar Contraseña
            </h5>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={onClose}
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Contraseña Actual */}
              <div className="mb-3">
                <label className="form-label fw-bold">🔒 Contraseña Actual</label>
                <div className="input-group">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    name="currentPassword"
                    className={`form-control ${errors.currentPassword ? 'is-invalid' : ''}`}
                    placeholder="Ingresa tu contraseña actual"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => togglePasswordVisibility('current')}
                    disabled={loading}
                  >
                    {showPasswords.current ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                  {errors.currentPassword && (
                    <div className="invalid-feedback d-block">
                      {errors.currentPassword}
                    </div>
                  )}
                </div>
              </div>

              {/* Nueva Contraseña */}
              <div className="mb-3">
                <label className="form-label fw-bold">🔑 Nueva Contraseña</label>
                <div className="input-group">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    name="newPassword"
                    className={`form-control ${errors.newPassword ? 'is-invalid' : ''}`}
                    placeholder="Ingresa una nueva contraseña (mínimo 8 caracteres)"
                    value={formData.newPassword}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => togglePasswordVisibility('new')}
                    disabled={loading}
                  >
                    {showPasswords.new ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                  {errors.newPassword && (
                    <div className="invalid-feedback d-block">
                      {errors.newPassword}
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmar Contraseña */}
              <div className="mb-3">
                <label className="form-label fw-bold">✅ Confirmar Nueva Contraseña</label>
                <div className="input-group">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    name="confirmPassword"
                    className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                    placeholder="Confirma tu nueva contraseña"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => togglePasswordVisibility('confirm')}
                    disabled={loading}
                  >
                    {showPasswords.confirm ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                  {errors.confirmPassword && (
                    <div className="invalid-feedback d-block">
                      {errors.confirmPassword}
                    </div>
                  )}
                </div>
              </div>

              {/* Requisitos de contraseña */}
              <div className="alert alert-info small">
                <strong>Requisitos de contraseña:</strong>
                <ul className="mb-0 mt-2">
                  <li>Al menos 8 caracteres</li>
                  <li>Al menos un carácter especial, por ejemplo !, @ o #</li>
                  <li>Diferente a la contraseña actual</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Cambiando...
                  </>
                ) : (
                  <>
                    <Lock size={16} className="me-2" />
                    Cambiar Contraseña
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

export default ChangePasswordModal;
