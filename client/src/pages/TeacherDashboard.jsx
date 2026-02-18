import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { Users, RefreshCw, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';

const TeacherDashboard = () => {
  const { questionnaireId } = useParams();
  const { user } = useAuth();
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questionnaireInfo, setQuestionnaireInfo] = useState(null);

  const fetchProgress = useCallback(async () => {
    if (!questionnaireId) return;
    setLoading(true);
    try {
      // 1. Obtener progreso de estudiantes
      const res = await axiosClient.get(`/teacher/progress/${questionnaireId}`);
      setProgress(Array.isArray(res.data) ? res.data : []);
      
      // 2. Obtener info del cuestionario
      const qRes = await axiosClient.get(`/questionnaires/${questionnaireId}`);
      setQuestionnaireInfo(qRes.data);
    } catch (err) {
      console.error("Error cargando progreso:", err);
      setProgress([]);
      // El error 401 ya es manejado por el interceptor de axiosClient
    } finally {
      setLoading(false);
    }
  }, [questionnaireId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const handleResetSession = async (sessionId, studentName) => {
    const result = await Swal.fire({
      title: '¿Reiniciar intento?',
      text: `Se eliminará la sesión activa de ${studentName}. El estudiante podrá volver a entrar sin perder sus intentos permitidos.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, borrar sesión',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await axiosClient.delete(`/teacher/sessions/${sessionId}`);
        Swal.fire('¡Eliminado!', 'La sesión ha sido reiniciada con éxito.', 'success');
        fetchProgress();
      } catch (err) {
        Swal.fire('Error', 'No se pudo eliminar la sesión. Intenta de nuevo.', 'error');
      }
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <span className="badge bg-success d-inline-flex align-items-center gap-1"><CheckCircle size={14}/> Completado</span>;
      case 'in_progress':
        return <span className="badge bg-primary d-inline-flex align-items-center gap-1"><Clock size={14}/> En curso</span>;
      case 'expired':
        return <span className="badge bg-danger d-inline-flex align-items-center gap-1"><AlertCircle size={14}/> Expirado</span>;
      default:
        return <span className="badge bg-secondary">Sin iniciar</span>;
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item"><Link to="/dashboard">Dashboard</Link></li>
              <li className="breadcrumb-item active">Progreso</li>
            </ol>
          </nav>
          <h2 className="h3 d-flex align-items-center gap-2 fw-bold text-dark">
            <Users className="text-primary" size={28} /> 
            {questionnaireInfo?.title || `Cuestionario #${questionnaireId}`}
          </h2>
        </div>
        <button onClick={fetchProgress} className="btn btn-primary shadow-sm d-flex align-items-center gap-2">
          <RefreshCw size={18} /> Sincronizar Datos
        </button>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-light text-secondary">
                <tr>
                  <th className="px-4 py-3">Estudiante</th>
                  <th className="py-3">Estado</th>
                  <th className="py-3 text-center">Intento</th>
                  <th className="py-3 text-center">Puntaje</th>
                  <th className="px-4 py-3 text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {progress.length > 0 ? (
                  progress.map((row, i) => (
                    <tr key={`${row.student_id}-${i}`}>
                      <td className="px-4">
                        <div className="fw-bold text-dark">{row.student_name}</div>
                        <small className="text-muted">{row.email || 'Sin correo registrado'}</small>
                      </td>
                      <td>{getStatusBadge(row.status)}</td>
                      <td className="text-center">
                        <span className="badge rounded-pill bg-light text-dark border px-3">
                          {row.attempt_number || 0} / 2
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`fw-bold h6 mb-0 ${parseFloat(row.score) >= 3 ? 'text-success' : 'text-danger'}`}>
                          {row.score ? parseFloat(row.score).toFixed(1) : '-'}
                        </span>
                      </td>
                      <td className="px-4 text-end">
                        {user?.role === 'docente' ? (
                          <Link to={`/estudiantes/${row.student_id}/calificaciones`} className="btn btn-sm btn-outline-primary me-2">
                            Calificaciones
                          </Link>
                        ) : (
                          <Link to={`/estudiantes/${row.student_id}`} className="btn btn-sm btn-outline-info me-2">
                            Detalles
                          </Link>
                        )}
                        
                        {row.session_id && row.status === 'in_progress' && (
                          <button 
                            onClick={() => handleResetSession(row.session_id, row.student_name)}
                            className="btn btn-sm btn-danger shadow-sm"
                            title="Reiniciar intento"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      No hay registros de actividad para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;