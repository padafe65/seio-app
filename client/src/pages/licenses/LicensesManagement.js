// pages/licenses/LicensesManagement.js
// Gestión de Licencias de Docentes para Administradores/Super Administradores

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { 
  CreditCard, UserPlus, Search, Filter, 
  Pause, Play, Eye, RefreshCw, AlertCircle 
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const LicensesManagement = () => {
  const { user, authToken, isAuthReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [licenses, setLicenses] = useState([]);
  const [filteredLicenses, setFilteredLicenses] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    expired: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    institution: '',
    teacher_id: ''
  });
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({
    teacher_id: '',
    institution: '',
    purchased_date: new Date().toISOString().split('T')[0]
  });
  const [suspendReason, setSuspendReason] = useState('');
  const [extendYear, setExtendYear] = useState(true);
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    if (!isAuthReady || !authToken) {
      setLoading(false);
      return;
    }

    if (user && (user.role === 'administrador' || user.role === 'super_administrador')) {
      fetchLicenses();
      fetchTeachers();
    } else {
      setLoading(false);
    }
  }, [user, authToken, isAuthReady]);

  useEffect(() => {
    filterLicenses();
  }, [licenses, filters]);

  const fetchLicenses = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.institution) params.append('institution', filters.institution);
      if (filters.teacher_id) params.append('teacher_id', filters.teacher_id);

      const response = await axiosClient.get(`/teacher-licenses/licenses?${params.toString()}`);
      const licensesData = response.data?.data || [];
      
      setLicenses(licensesData);
      
      // Calcular estadísticas
      setStats({
        total: licensesData.length,
        active: licensesData.filter(l => l.license_status === 'active').length,
        suspended: licensesData.filter(l => l.license_status === 'suspended').length,
        expired: licensesData.filter(l => l.license_status === 'expired').length
      });
    } catch (error) {
      console.error('Error al cargar licencias:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las licencias'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await axiosClient.get('/admin/users');
      const users = response.data?.data || [];
      const teachersList = users.filter(u => u.role === 'docente').map(u => ({
        id: u.teacher_id || u.id,
        name: u.name,
        email: u.email,
        subject: u.subject || 'N/A'
      }));
      setTeachers(teachersList);
    } catch (error) {
      console.error('Error al cargar docentes:', error);
    }
  };

  const filterLicenses = () => {
    let filtered = [...licenses];

    if (filters.status) {
      filtered = filtered.filter(l => l.license_status === filters.status);
    }

    if (filters.institution) {
      filtered = filtered.filter(l => 
        l.institution.toLowerCase().includes(filters.institution.toLowerCase())
      );
    }

    if (filters.teacher_id) {
      filtered = filtered.filter(l => l.teacher_id === parseInt(filters.teacher_id));
    }

    setFilteredLicenses(filtered);
  };

  const handlePurchaseLicense = async (e) => {
    e.preventDefault();
    
    if (!purchaseForm.teacher_id || !purchaseForm.institution) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor complete todos los campos'
      });
      return;
    }

    try {
      const response = await axiosClient.post(
        `/teacher-licenses/teacher/${purchaseForm.teacher_id}/purchase-license`,
        {
          institution: purchaseForm.institution,
          purchased_date: purchaseForm.purchased_date
        }
      );

      Swal.fire({
        icon: 'success',
        title: 'Licencia comprada',
        html: `
          <p>Licencia creada exitosamente</p>
          <p><strong>Fecha de expiración:</strong> ${response.data.data.expiration_date}</p>
        `
      });

      setShowPurchaseModal(false);
      setPurchaseForm({
        teacher_id: '',
        institution: '',
        purchased_date: new Date().toISOString().split('T')[0]
      });
      fetchLicenses();
    } catch (error) {
      console.error('Error al comprar licencia:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo comprar la licencia'
      });
    }
  };

  const handleSuspendLicense = async () => {
    if (!selectedLicense) return;

    try {
      await axiosClient.put(`/teacher-licenses/license/${selectedLicense.id}/suspend`, {
        reason: suspendReason
      });

      Swal.fire({
        icon: 'success',
        title: 'Licencia suspendida',
        text: 'La licencia ha sido suspendida exitosamente. Los datos del docente y estudiantes se mantienen intactos.'
      });

      setShowSuspendModal(false);
      setSelectedLicense(null);
      setSuspendReason('');
      fetchLicenses();
    } catch (error) {
      console.error('Error al suspender licencia:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo suspender la licencia'
      });
    }
  };

  const handleReactivateLicense = async () => {
    if (!selectedLicense) return;

    try {
      await axiosClient.put(`/teacher-licenses/license/${selectedLicense.id}/reactivate`, {
        extend_year: extendYear
      });

      Swal.fire({
        icon: 'success',
        title: 'Licencia reactivada',
        html: extendYear 
          ? 'La licencia ha sido reactivada y extendida 1 año adicional.'
          : 'La licencia ha sido reactivada exitosamente.'
      });

      setShowReactivateModal(false);
      setSelectedLicense(null);
      setExtendYear(true);
      fetchLicenses();
    } catch (error) {
      console.error('Error al reactivar licencia:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo reactivar la licencia'
      });
    }
  };

  const handleCheckExpired = async () => {
    try {
      const response = await axiosClient.post('/teacher-licenses/licenses/check-expired');
      
      Swal.fire({
        icon: 'success',
        title: 'Verificación completada',
        text: `${response.data.expired_count || 0} licencia(s) marcada(s) como expirada(s)`
      });

      fetchLicenses();
    } catch (error) {
      console.error('Error al verificar licencias expiradas:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron verificar las licencias expiradas'
      });
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { class: 'bg-success', text: 'Activa' },
      suspended: { class: 'bg-warning text-dark', text: 'Suspendida' },
      expired: { class: 'bg-danger', text: 'Expirada' }
    };
    const badge = badges[status] || { class: 'bg-secondary', text: status };
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const calculateDaysRemaining = (expirationDate) => {
    if (!expirationDate) return '-';
    const today = new Date();
    const expiry = new Date(expirationDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 'Expirada';
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
    <div className="p-6">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-0">
            <CreditCard size={28} className="me-2" />
            Gestión de Licencias de Docentes
          </h1>
          <p className="text-muted mt-2">Administra las licencias de docentes por institución</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-success"
            onClick={() => setShowPurchaseModal(true)}
          >
            <UserPlus size={18} className="me-2" />
            Comprar Licencia
          </button>
          <button
            className="btn btn-info"
            onClick={handleCheckExpired}
          >
            <RefreshCw size={18} className="me-2" />
            Verificar Expiradas
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <div className="small">Total Licencias</div>
                  <div className="h4 mb-0">{stats.total}</div>
                </div>
                <CreditCard size={32} className="opacity-75" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-success text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <div className="small">Activas</div>
                  <div className="h4 mb-0">{stats.active}</div>
                </div>
                <Play size={32} className="opacity-75" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-warning text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <div className="small">Suspendidas</div>
                  <div className="h4 mb-0">{stats.suspended}</div>
                </div>
                <Pause size={32} className="opacity-75" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-danger text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <div className="small">Expiradas</div>
                  <div className="h4 mb-0">{stats.expired}</div>
                </div>
                <AlertCircle size={32} className="opacity-75" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Estado</label>
              <select
                className="form-select"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="active">Activa</option>
                <option value="suspended">Suspendida</option>
                <option value="expired">Expirada</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Institución</label>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por institución"
                value={filters.institution}
                onChange={(e) => setFilters({ ...filters, institution: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Docente</label>
              <select
                className="form-select"
                value={filters.teacher_id}
                onChange={(e) => setFilters({ ...filters, teacher_id: e.target.value })}
              >
                <option value="">Todos</option>
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} - {teacher.subject}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de licencias */}
      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Docente</th>
                  <th>Materia</th>
                  <th>Institución</th>
                  <th>Estado</th>
                  <th>Fecha Compra</th>
                  <th>Fecha Expiración</th>
                  <th>Días Restantes</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredLicenses.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No se encontraron licencias
                    </td>
                  </tr>
                ) : (
                  filteredLicenses.map(license => (
                    <tr key={license.id}>
                      <td>
                        <div>
                          <strong>{license.teacher_name}</strong>
                          <br />
                          <small className="text-muted">{license.teacher_email}</small>
                        </div>
                      </td>
                      <td>{license.teacher_subject || 'N/A'}</td>
                      <td>{license.institution}</td>
                      <td>{getStatusBadge(license.license_status)}</td>
                      <td>{license.purchased_date || 'N/A'}</td>
                      <td>{license.expiration_date || 'Sin expiración'}</td>
                      <td>
                        {license.license_status === 'active' && license.expiration_date
                          ? `${calculateDaysRemaining(license.expiration_date)} días`
                          : '-'}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          {license.license_status === 'active' ? (
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => {
                                setSelectedLicense(license);
                                setShowSuspendModal(true);
                              }}
                              title="Suspender licencia"
                            >
                              <Pause size={16} />
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => {
                                setSelectedLicense(license);
                                setShowReactivateModal(true);
                              }}
                              title="Reactivar licencia"
                            >
                              <Play size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Comprar Licencia */}
      {showPurchaseModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Comprar Nueva Licencia</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPurchaseModal(false)}
                ></button>
              </div>
              <form onSubmit={handlePurchaseLicense}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Docente <span className="text-danger">*</span></label>
                    <select
                      className="form-select"
                      value={purchaseForm.teacher_id}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, teacher_id: e.target.value })}
                      required
                    >
                      <option value="">Seleccione un docente</option>
                      {teachers.map(teacher => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name} - {teacher.subject}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Institución <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={purchaseForm.institution}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, institution: e.target.value })}
                      placeholder="Ej: Colegio La Chucua"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Fecha de Compra</label>
                    <input
                      type="date"
                      className="form-control"
                      value={purchaseForm.purchased_date}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, purchased_date: e.target.value })}
                    />
                    <small className="form-text text-muted">
                      La fecha de expiración se calculará automáticamente (1 año después)
                    </small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPurchaseModal(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success">
                    Comprar Licencia
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Suspender Licencia */}
      {showSuspendModal && selectedLicense && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">Suspender Licencia</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowSuspendModal(false);
                    setSelectedLicense(null);
                    setSuspendReason('');
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-warning">
                  <strong>⚠️ Importante:</strong> Al suspender la licencia, los datos del docente y estudiantes se mantendrán intactos.
                </div>
                <p><strong>Docente:</strong> {selectedLicense.teacher_name}</p>
                <p><strong>Institución:</strong> {selectedLicense.institution}</p>
                <div className="mb-3">
                  <label className="form-label">Motivo de suspensión (opcional)</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Ej: No se ha recibido el pago de la mensualidad"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowSuspendModal(false);
                    setSelectedLicense(null);
                    setSuspendReason('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={handleSuspendLicense}
                >
                  Confirmar Suspensión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reactivar Licencia */}
      {showReactivateModal && selectedLicense && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">Reactivar Licencia</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setShowReactivateModal(false);
                    setSelectedLicense(null);
                    setExtendYear(true);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <p><strong>Docente:</strong> {selectedLicense.teacher_name}</p>
                <p><strong>Institución:</strong> {selectedLicense.institution}</p>
                <div className="form-check mt-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={extendYear}
                    onChange={(e) => setExtendYear(e.target.checked)}
                    id="extendYear"
                  />
                  <label className="form-check-label" htmlFor="extendYear">
                    Extender licencia 1 año adicional
                  </label>
                </div>
                {extendYear && selectedLicense.expiration_date && (
                  <div className="alert alert-info mt-3">
                    Nueva fecha de expiración: {
                      new Date(new Date(selectedLicense.expiration_date).setFullYear(
                        new Date(selectedLicense.expiration_date).getFullYear() + 1
                      )).toLocaleDateString()
                    }
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowReactivateModal(false);
                    setSelectedLicense(null);
                    setExtendYear(true);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleReactivateLicense}
                >
                  Reactivar Licencia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LicensesManagement;
