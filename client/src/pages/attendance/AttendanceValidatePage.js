import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || '';

export default function AttendanceValidatePage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  const { user } = useAuth();
  const [token, setToken] = useState(tokenFromUrl || '');
  const [code, setCode] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    setToken(tokenFromUrl || '');
  }, [tokenFromUrl]);

  useEffect(() => {
    if (!token) {
      setSession(null);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${API_BASE}/api/attendance/validate/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.data) {
          setSession(data.data);
          setError('');
        } else {
          setSession(null);
          setError(data.message || 'Sesión no encontrada.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la sesión.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function fetchByCode() {
    const c = (code || '').trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_BASE}/api/attendance/validate/by-code/${encodeURIComponent(c)}`);
      const data = await r.json();
      if (data.success && data.data) {
        setToken(data.data.token);
        setSession(data.data);
      } else setError(data.message || 'Código no encontrado.');
    } catch {
      setError('No se pudo validar el código.');
    } finally {
      setLoading(false);
    }
  }

  async function registerAttendance() {
    if (!token || !user) return;
    setRegistering(true);
    setError('');
    try {
      const authToken = localStorage.getItem('authToken');
      const r = await fetch(`${API_BASE}/api/attendance/validate/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { Authorization: `Bearer ${authToken}` })
        },
        credentials: 'include'
      });
      const data = await r.json();
      if (r.ok && data.success) {
        setSuccess(true);
      } else if (r.status === 401) {
        setError('Inicia sesión como estudiante para registrar tu asistencia.');
      } else {
        setError(data.message || 'No se pudo registrar la asistencia.');
      }
    } catch {
      setError('Error de conexión.');
    } finally {
      setRegistering(false);
    }
  }

  const isStudent = user?.role === 'estudiante';

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
      <div className="card shadow-sm" style={{ maxWidth: '420px' }}>
        <div className="card-body">
          <h5 className="card-title mb-3">Registrar asistencia</h5>

          {!token ? (
            <>
              <p className="small text-muted">Escaneá el QR del profesor o ingresá el código de la sesión.</p>
              <div className="input-group mb-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Código (ej. AB12CD)"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={12}
                />
                <button type="button" className="btn btn-primary" onClick={fetchByCode} disabled={loading}>
                  {loading ? '…' : 'Buscar'}
                </button>
              </div>
              {error && <div className="alert alert-danger small py-2">{error}</div>}
            </>
          ) : (
            <>
              {loading && !session ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" />
                </div>
              ) : error && !session ? (
                <div className="alert alert-warning small">{error}</div>
              ) : session ? (
                <>
                  <p className="small mb-2">
                    <strong>{session.name || 'Sesión'}</strong> — {session.session_date}
                    {session.short_code && <span> · Código {session.short_code}</span>}
                  </p>
                  {success ? (
                    <div className="alert alert-success py-2">Asistencia registrada correctamente.</div>
                  ) : (
                    <>
                      {!user ? (
                        <p className="small text-muted">
                          Iniciá sesión como estudiante para registrar tu asistencia.
                        </p>
                      ) : !isStudent ? (
                        <p className="small text-muted">
                          Solo los estudiantes pueden marcar asistencia aquí.
                        </p>
                      ) : null}
                      <div className="d-flex gap-2 flex-wrap">
                        {user && isStudent && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={registerAttendance}
                            disabled={registering}
                          >
                            {registering ? 'Registrando…' : 'Registrar mi asistencia'}
                          </button>
                        )}
                        {!user && (
                          <Link to="/login" className="btn btn-outline-primary">Iniciar sesión</Link>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => { setToken(''); setCode(''); setSession(null); setError(''); setSuccess(false); }}
                        >
                          Usar otro código
                        </button>
                      </div>
                      {error && <div className="alert alert-danger small mt-2 py-2">{error}</div>}
                    </>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
