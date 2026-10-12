// pages/improvement-plans/ImprovementPlanDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, CheckCircle, XCircle, Mail } from 'lucide-react';
import api from '../../config/axios';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';

const ImprovementPlanDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const dashboardPath = user?.role === 'estudiante' ? '/student/dashboard' : '/dashboard';
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submission, setSubmission] = useState({ submission_text: '', submission_url: '' });
  const [reviewFeedback, setReviewFeedback] = useState('');
  
  useEffect(() => {
    const fetchPlanDetails = async () => {
      try {
        const response = await api.get(`/improvement-plans/${id}`);
        setPlan(response.data);
        setSubmission({ submission_text: response.data.submission_text || '', submission_url: response.data.submission_url || '' });
        setReviewFeedback(response.data.submission_feedback || '');
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar detalles del plan:', error);
        setError('No se pudieron cargar los detalles del plan. Por favor, intenta de nuevo.');
        setLoading(false);
      }
    };
    
    fetchPlanDetails();
  }, [id]);

  const submitPlanWork = async () => {
    try {
      const response = await api.post(`/improvement-plans/${id}/submission`, submission);
      setPlan(prev => ({ ...prev, ...submission, submission_status: 'submitted', submitted_at: new Date().toISOString(), activity_status: 'in_progress', completed: 0 }));
      Swal.fire({ icon: 'success', title: 'Entrega registrada', text: response.data.message });
    } catch (submitError) {
      Swal.fire({ icon: 'error', title: 'No se pudo entregar', text: submitError.response?.data?.message || 'Intenta nuevamente.' });
    }
  };

  const reviewSubmission = async (status) => {
    try {
      await api.put(`/improvement-plans/${id}/submission-review`, { status, feedback: reviewFeedback });
      setPlan(prev => ({ ...prev, submission_status: status, submission_feedback: reviewFeedback, completed: status === 'approved' ? 1 : 0, activity_status: status === 'approved' ? 'completed' : status === 'needs_correction' ? 'in_progress' : prev.activity_status }));
      Swal.fire({ icon: 'success', title: 'Revisión guardada', text: status === 'approved' ? 'La entrega fue aprobada.' : status === 'needs_correction' ? 'Se solicitó una corrección.' : 'La entrega quedó en revisión.' });
    } catch (reviewError) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar la revisión', text: reviewError.response?.data?.message || 'Intenta nuevamente.' });
    }
  };
  
  const handleStatusChange = async (completed) => {
    try {
      await api.put(`/improvement-plans/${id}`, {
        ...plan,
        completed
      });
      
      setPlan(prev => ({ ...prev, completed }));
      
      Swal.fire({
        icon: 'success',
        title: 'Estado actualizado',
        text: `El plan ha sido marcado como ${completed ? 'completado' : 'pendiente'}`
      });
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo actualizar el estado del plan'
      });
    }
  };
  
  const handleSendEmail = async () => {
    try {
      await api.post(`/improvement-plans/${id}/send-email`);
      
      setPlan(prev => ({ ...prev, email_sent: true }));
      
      Swal.fire({
        icon: 'success',
        title: 'Email enviado',
        text: 'El plan de mejoramiento se envió por correo.'
      });
    } catch (error) {
      console.error('Error al enviar email:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo enviar el correo. Verifica la configuración del servicio SMTP.'
      });
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO');
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
  
  if (error) {
    return (
      <div className="alert alert-danger">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        {error}
      </div>
    );
  }
  
  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Plan de Mejoramiento</h5>
          <div>
            <Link to={dashboardPath} className="btn btn-light btn-sm me-2">
              <ArrowLeft size={16} className="me-1" /> Volver
            </Link>
            {user.role === 'docente' && (
              <Link to={`/planes-mejoramiento/${id}/editar`} className="btn btn-light btn-sm">
                <Edit size={16} className="me-1" /> Editar
              </Link>
            )}
          </div>
        </div>
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-8">
              <h4 className="mb-3">{plan.title}</h4>
              <p className="text-muted mb-2">
                <strong>Materia:</strong> {plan.subject}
              </p>
              <p className="text-muted mb-2">
                <strong>Estudiante:</strong> {plan.student_name} - {plan.grade}° - {plan.course_name}
              </p>
              <p className="text-muted mb-2">
                <strong>Docente:</strong> {plan.teacher_name}
              </p>
              <p className="text-muted mb-2">
                <strong>Fecha Límite:</strong> {formatDate(plan.deadline)}
              </p>
              <p className="text-muted mb-2"><strong>Estado de entrega:</strong> {({ pending: 'Sin entregar', submitted: 'Entregado', under_review: 'En revisión', needs_correction: 'Requiere corrección', approved: 'Aprobado' })[plan.submission_status] || 'Sin entregar'}</p>
            </div>
            <div className="col-md-4 text-end">
              <div className="d-flex flex-column align-items-end">
                <span className={`badge ${plan.completed ? 'bg-success' : 'bg-warning'} mb-2 p-2`}>
                  {plan.completed ? 'Completado' : 'Pendiente'}
                </span>
                
                {user.role === 'docente' && (
                  <div className="btn-group mt-2">
                    <button 
                      className="btn btn-sm btn-outline-success"
                      onClick={() => handleStatusChange(true)}
                      disabled={plan.completed}
                    >
                      <CheckCircle size={16} className="me-1" /> Marcar como Completado
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-warning"
                      onClick={() => handleStatusChange(false)}
                      disabled={!plan.completed}
                    >
                      <XCircle size={16} className="me-1" /> Marcar como Pendiente
                    </button>
                  </div>
                )}
                
                {user.role === 'docente' && !plan.email_sent && (
                  <button 
                    className="btn btn-sm btn-outline-primary mt-2"
                    onClick={handleSendEmail}
                  >
                    <Mail size={16} className="me-1" /> Enviar por Email
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <hr />
          
          <div className="row mb-4">
            <div className="col-12">
              <h5>Descripción</h5>
              <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>{plan.description}</p>
            </div>
          </div>
          
          <div className="row mb-4">
            <div className="col-12">
              <h5>Actividades</h5>
              <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>{plan.activities}</p>
            </div>
          </div>
          
          <div className="row">
            <div className="col-md-6 mb-4">
              <div className="card h-100 border-danger">
                <div className="card-header bg-danger text-white">
                  <h5 className="mb-0">Logros No Alcanzados</h5>
                </div>
                <div className="card-body">
                  <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>{plan.failed_achievements || 'No hay logros no alcanzados registrados.'}</p>
                </div>
              </div>
            </div>
            
            <div className="col-md-6 mb-4">
              <div className="card h-100 border-success">
                <div className="card-header bg-success text-white">
                  <h5 className="mb-0">Logros Alcanzados</h5>
                </div>
                <div className="card-body">
                  <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>{plan.passed_achievements || 'No hay logros alcanzados registrados.'}</p>
                </div>
              </div>
            </div>
          </div>
          
          {plan.file_url && (
            <div className="row mt-3">
              <div className="col-12">
                <h5>Recursos</h5>
                <a href={plan.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary">
                  Ver Archivo Adjunto
                </a>
              </div>
            </div>
          )}

          {user.role === 'estudiante' && (
            <section className="card mt-4 border-primary">
              <div className="card-header bg-light"><h5 className="mb-0">Mi entrega</h5></div>
              <div className="card-body">
                {plan.submission_feedback && <div className="alert alert-info"><strong>Comentario del docente:</strong> {plan.submission_feedback}</div>}
                <label className="form-label" htmlFor="submissionText">Respuesta o explicación del trabajo</label>
                <textarea id="submissionText" className="form-control mb-3" rows="4" value={submission.submission_text} onChange={e => setSubmission(prev => ({ ...prev, submission_text: e.target.value }))} disabled={plan.submission_status === 'approved'} />
                <label className="form-label" htmlFor="submissionUrl">Enlace al archivo o trabajo (opcional)</label>
                <input id="submissionUrl" type="url" className="form-control mb-3" value={submission.submission_url} onChange={e => setSubmission(prev => ({ ...prev, submission_url: e.target.value }))} placeholder="https://…" disabled={plan.submission_status === 'approved'} />
                <button className="btn btn-primary" onClick={submitPlanWork} disabled={plan.submission_status === 'approved'}>{plan.submission_status === 'needs_correction' ? 'Enviar corrección' : 'Entregar trabajo'}</button>
              </div>
            </section>
          )}

          {user.role === 'docente' && plan.submitted_at && (
            <section className="card mt-4 border-info">
              <div className="card-header bg-light"><h5 className="mb-0">Entrega del estudiante</h5><small>Recibida: {formatDate(plan.submitted_at)}</small></div>
              <div className="card-body">
                {plan.submission_text && <p style={{ whiteSpace: 'pre-line' }}>{plan.submission_text}</p>}
                {plan.submission_url && <p><a href={plan.submission_url} target="_blank" rel="noopener noreferrer">Abrir trabajo entregado</a></p>}
                <label className="form-label" htmlFor="reviewFeedback">Comentario para el estudiante</label>
                <textarea id="reviewFeedback" className="form-control mb-3" rows="3" value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)} />
                <div className="d-flex gap-2 flex-wrap">
                  <button className="btn btn-outline-primary" onClick={() => reviewSubmission('under_review')}>Dejar en revisión</button>
                  <button className="btn btn-outline-warning" onClick={() => reviewSubmission('needs_correction')}>Pedir corrección</button>
                  <button className="btn btn-success" onClick={() => reviewSubmission('approved')}>Aprobar entrega</button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImprovementPlanDetail;
