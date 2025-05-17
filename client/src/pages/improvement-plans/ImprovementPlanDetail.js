// pages/improvement-plans/ImprovementPlanDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, CheckCircle, XCircle, Mail } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ImprovementPlanDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchPlanDetails = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/improvement-plans/${id}`);
        setPlan(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar detalles del plan:', error);
        setError('No se pudieron cargar los detalles del plan. Por favor, intenta de nuevo.');
        setLoading(false);
      }
    };
    
    fetchPlanDetails();
  }, [id]);
  
  const handleStatusChange = async (completed) => {
    try {
      await axios.put(`${API_URL}/api/improvement-plans/${id}`, {
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
      // Aquí implementarías la lógica para enviar el email
      // Por ahora, solo actualizamos el estado
      await axios.put(`${API_URL}/api/improvement-plans/${id}`, {
        ...plan,
        email_sent: true
      });
      
      setPlan(prev => ({ ...prev, email_sent: true }));
      
      Swal.fire({
        icon: 'success',
        title: 'Email enviado',
        text: 'Se ha enviado un email con el plan de mejoramiento'
      });
    } catch (error) {
      console.error('Error al enviar email:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo enviar el email'
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
            {/* Modificar esta línea para que el botón Volver redirija a la ruta correcta */}
            <Link to="/student/improvement" className="btn btn-light btn-sm me-2">
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
        </div>
      </div>
    </div>
  );
};

export default ImprovementPlanDetail;
