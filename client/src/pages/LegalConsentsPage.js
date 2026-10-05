import React, { useEffect, useMemo, useState } from 'react';
import { FileCheck2, RefreshCw, Search } from 'lucide-react';
import axiosClient from '../api/axiosClient';

const STATUS_LABELS = {
  accepted: 'Aceptada en formulario',
  pending_guardian: 'Pendiente autorización familiar',
  institution_confirmed: 'Verificada por institución',
  revoked: 'Revocada'
};

const EMAIL_LABELS = { pending: 'Pendiente', sent: 'Enviado', partial: 'Parcial', failed: 'Fallido' };
const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
};

const LegalConsentsPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadConsents = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosClient.get('/admin/legal-consents');
      setRows(response.data?.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'No fue posible cargar las aceptaciones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConsents(); }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    return rows.filter((row) => {
      const matchesText = !needle || [row.subject_name, row.subject_email, row.institution, row.accepter_name,
        row.accepter_account_name, row.creator_name, row.teacher_names, row.student_contact_email]
        .some((value) => String(value || '').toLocaleLowerCase('es').includes(needle));
      return matchesText && (!statusFilter || row.consent_status === statusFilter);
    });
  }, [rows, query, statusFilter]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1"><FileCheck2 className="me-2" />Aceptaciones de tratamiento de datos</h1>
          <p className="text-muted mb-0">Historial, responsables de aceptación y estado de los avisos por correo.</p>
        </div>
        <button className="btn btn-outline-primary" onClick={loadConsents} disabled={loading}>
          <RefreshCw size={16} className="me-2" />Actualizar
        </button>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-8">
          <div className="input-group"><span className="input-group-text"><Search size={16} /></span>
            <input className="form-control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar estudiante, correo, institución o docente" />
          </div>
        </div>
        <div className="col-md-4">
          <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <div className="text-center py-5"><div className="spinner-border" role="status" /><p className="mt-2">Cargando historial…</p></div> : (
        <div className="table-responsive">
          <table className="table table-striped table-hover align-middle">
            <thead><tr><th>Fecha</th><th>Titular</th><th>Quién registró</th><th>Institución</th><th>Estado</th><th>Docente(s)</th><th>Correo</th><th>Versión</th></tr></thead>
            <tbody>
              {filteredRows.map((row) => {
                const emailDetails = asArray(row.notification_details);
                const recipients = asArray(row.notification_recipients);
                const teacherEmails = String(row.teacher_emails || '').split(',').map((email) => email.trim()).filter(Boolean);
                const isMinor = row.student_age != null
                  ? Number(row.student_age) < 18
                  : row.subject_type === 'minor_student';
                const linkedEmails = [
                  { label: row.subject_role === 'docente' ? 'Docente' : 'Titular', email: row.subject_email },
                  ...(isMinor
                    ? [{ label: 'Contacto familiar', email: row.student_contact_email || row.guardian_email }]
                    : []),
                  ...teacherEmails.map((email) => ({ label: 'Docente asociado', email }))
                ].filter((item) => item.email);
                return <tr key={row.id}>
                  <td>{row.accepted_at || row.created_at || '—'}</td>
                  <td><strong>{row.subject_name}</strong><br /><small>{row.subject_email}</small>{row.student_age != null && <><br /><small>Edad registrada: {row.student_age}</small>{row.subject_type === 'minor_student' && Number(row.student_age) >= 18 && <><br /><small className="text-warning">Revisar: marcado menor, pero la edad es 18 o más</small></>}</>}</td>
                  <td>{row.accepter_name || row.accepter_account_name || row.creator_name || '—'}<br /><small>{row.accepter_relationship || row.acceptance_method}</small></td>
                  <td>{row.institution || '—'}</td>
                  <td><span className={`badge ${row.consent_status === 'accepted' ? 'bg-success' : row.consent_status === 'pending_guardian' ? 'bg-warning text-dark' : 'bg-secondary'}`}>{STATUS_LABELS[row.consent_status] || row.consent_status}</span><br /><small>{row.subject_type}</small></td>
                  <td>{row.teacher_names || 'Sin docente asociado'}</td>
                  <td>
                    <div className="mb-1"><strong>Correos vinculados</strong></div>
                    {linkedEmails.length ? linkedEmails.map((item, index) => <div key={`${item.email}-${index}`}><small>{item.label}: {item.email}</small></div>) : <small className="text-muted">No hay correos asociados en el perfil.</small>}
                    <div className="mt-2"><span className={`badge ${row.notification_status === 'sent' ? 'bg-success' : row.notification_status === 'partial' || row.notification_status === 'pending' ? 'bg-warning text-dark' : 'bg-danger'}`}>{row.notification_status ? (EMAIL_LABELS[row.notification_status] || row.notification_status) : 'Sin registro de envío'}</span></div>
                    {recipients.length > 0 && <div><small>Intento(s) registrados: {recipients.join(', ')}</small></div>}
                    {emailDetails.some((item) => !item.sent) && <details><summary>Ver resultado</summary>{emailDetails.filter((item) => !item.sent).map((item, index) => <div key={index}>{item.email || 'Correo'}: {item.error || 'No enviado'}</div>)}</details>}
                  </td>
                  <td>{row.policy_version}</td>
                </tr>;
              })}
              {!filteredRows.length && <tr><td colSpan="8" className="text-center text-muted py-4">No hay registros que coincidan.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <small className="text-muted">Mostrando {filteredRows.length} de {rows.length} registros.</small>
    </div>
  );
};

export default LegalConsentsPage;
