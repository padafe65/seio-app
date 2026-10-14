// pages/improvement-plans/ImprovementPlanForm.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';

// Removed API_URL since axiosClient already has baseURL configured

const ImprovementPlanForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [error, setError] = useState(null);
  const [students, setStudents] = useState([]);
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [failedIndicators, setFailedIndicators] = useState([]);
  const [passedIndicators, setPassedIndicators] = useState([]);
  const [planPdf, setPlanPdf] = useState(null);
  const [hasPublishedPdf, setHasPublishedPdf] = useState(false);
  
  const [formData, setFormData] = useState({
    student_id: '',
    teacher_id: '',
    title: '',
    subject: '',
    description: '',
    activities: '',
    deadline: '',
    file_url: '',
    failed_achievements: '',
    passed_achievements: '',
    video_urls: '',
    resource_links: '',
    activity_status: 'pending',
    teacher_notes: '',
    student_feedback: '',
    attempts_count: 0,
    completed: false,
    email_sent: false,
    physical_delivery_required: false
  });
  
  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        const response = await axiosClient.get(`/teacher/by-user/${user.id}`);
        if (response.data && response.data.success && response.data.data) {
          const teacherData = response.data.data;
          setFormData(prev => ({
            ...prev,
            teacher_id: teacherData.id
          }));
          // Los estudiantes vienen incluidos en la respuesta del profesor
          setStudents(teacherData.students || []);
        }
      } catch (error) {
        console.error('Error al obtener datos del profesor:', error);
        setError('Error al obtener datos del profesor.');
      }
    };

    const fetchAdministratorData = async () => {
      try {
        const [studentsResponse, teachersResponse] = await Promise.all([
          axiosClient.get('/students'),
          axiosClient.get('/teachers')
        ]);
        setStudents(Array.isArray(studentsResponse.data) ? studentsResponse.data : studentsResponse.data?.students || []);
        setTeacherOptions(Array.isArray(teachersResponse.data) ? teachersResponse.data : []);
      } catch (loadError) {
        console.error('Error al cargar estudiantes y docentes:', loadError);
        setError('No se pudieron cargar los estudiantes y docentes.');
      }
    };
    
    const fetchTemplates = async () => {
      try {
        const response = await axiosClient.get('/improvement-plans/templates');
        setTemplates(response.data);
      } catch (error) {
        console.error('Error al cargar plantillas:', error);
      }
    };
    
    const fetchPlanDetails = async () => {
      if (isEditing) {
        try {
          const response = await axiosClient.get(`/improvement-plans/${id}`);
          const planData = response.data;
          
          setFormData({
            student_id: planData.student_id || '',
            teacher_id: planData.teacher_id || '',
            title: planData.title || '',
            subject: planData.subject || '',
            description: planData.description || '',
            activities: planData.activities || '',
            deadline: planData.deadline ? planData.deadline.split('T')[0] : '',
            file_url: planData.file_url || '',
            failed_achievements: planData.failed_achievements || '',
            passed_achievements: planData.passed_achievements || '',
            video_urls: planData.video_urls || '',
            resource_links: planData.resource_links || '',
            teacher_notes: planData.teacher_notes || '',
            student_feedback: planData.student_feedback || '',
            attempts_count: planData.attempts_count || 0,
            activity_status: planData.activity_status || 'pending',
            completed: planData.completed === 1,
            email_sent: planData.email_sent === 1,
            physical_delivery_required: planData.physical_delivery_required === 1
          });
          setHasPublishedPdf(Boolean(planData.plan_pdf_path));
          
          // Cargar indicadores para este estudiante
          if (planData.student_id && planData.grade && planData.phase) {
            fetchIndicators(planData.student_id, planData.grade, planData.phase);
          }
          
          setInitialLoading(false);
        } catch (error) {
          console.error('Error al cargar detalles del plan:', error);
          setError('Error al cargar detalles del plan.');
          setInitialLoading(false);
        }
      }
    };
    
    if (user.role === 'docente') {
      fetchTeacherData();
    } else if (['admin', 'administrador', 'super_administrador'].includes(user.role)) {
      fetchAdministratorData();
    }
    
    fetchTemplates();
    fetchPlanDetails();
  }, [id, isEditing, user.id, user.role]);
  
  const fetchIndicators = async (studentId, grade, phase) => {
    try {
      // Obtener indicadores no alcanzados
      const failedResponse = await axiosClient.get(
        `/improvement-plans/indicators/failed/${studentId}/${grade}/${phase}`
      );
      setFailedIndicators(failedResponse.data);
      
      // Obtener indicadores alcanzados
      const passedResponse = await axiosClient.get(
        `/improvement-plans/indicators/passed/${studentId}/${grade}/${phase}`
      );
      setPassedIndicators(passedResponse.data);
    } catch (error) {
      console.error('Error al cargar indicadores:', error);
    }
  };
  
  const handleStudentChange = async (e) => {
    const studentId = e.target.value;
    setFormData(prev => ({ ...prev, student_id: studentId }));
    
    // Buscar el estudiante seleccionado
    const selectedStudent = students.find(s => s.id === parseInt(studentId));
    if (selectedStudent) {
      // Cargar indicadores para este estudiante
      fetchIndicators(studentId, selectedStudent.grade, 1); // Fase 1 por defecto
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleTemplateSelect = (description) => {
    setFormData(prev => ({ ...prev, description }));
  };
  
  const handleIndicatorsSelect = (type) => {
    const indicators = type === 'failed' ? failedIndicators : passedIndicators;
    
    if (indicators.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin indicadores',
        text: `No hay indicadores ${type === 'failed' ? 'no alcanzados' : 'alcanzados'} para este estudiante.`
      });
      return;
    }
    
    // Formatear los indicadores como texto
    const formattedIndicators = indicators
      .map(ind => `- ${ind.description} (${ind.subject})`)
      .join('\n');
    
    // Actualizar el campo correspondiente
    setFormData(prev => ({
      ...prev,
      [type === 'failed' ? 'failed_achievements' : 'passed_achievements']: formattedIndicators
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isEditing) {
        await axiosClient.put(`/improvement-plans/${id}`, formData);
        if (planPdf) await uploadPlanPdf(id);
        Swal.fire({
          icon: 'success',
          title: 'Plan actualizado',
          text: 'El plan de mejoramiento ha sido actualizado correctamente'
        });
      } else {
        const response = await axiosClient.post('/improvement-plans', formData);
        if (planPdf) await uploadPlanPdf(response.data.id);
        Swal.fire({
          icon: 'success',
          title: 'Plan creado',
          text: 'El plan de mejoramiento ha sido creado correctamente'
        });
      }
      
      navigate('/planes-mejoramiento');
    } catch (error) {
      console.error('Error al guardar plan:', error);
      setError('Error al guardar el plan de mejoramiento.');
      setLoading(false);
    }
  };

  const uploadPlanPdf = async (planId) => {
    const payload = new FormData();
    payload.append('file', planPdf);
    await axiosClient.put(`/improvement-plans/${planId}/plan-pdf`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  };
  
  if (initialLoading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">{isEditing ? 'Editar Plan de Mejoramiento' : 'Nuevo Plan de Mejoramiento'}</h5>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="student_id" className="form-label">Estudiante</label>
                <select
                  id="student_id"
                  name="student_id"
                  className="form-select"
                  value={formData.student_id}
                  onChange={handleStudentChange}
                  required
                  disabled={isEditing}
                >
                  <option value="">Seleccionar estudiante</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name || student.user_name} - {student.grade}° - {student.course_name}
                    </option>
                  ))}
                </select>
                {['admin', 'administrador', 'super_administrador'].includes(user.role) && (
                  <div className="mt-3">
                    <label htmlFor="teacher_id" className="form-label">Docente responsable</label>
                    <select id="teacher_id" name="teacher_id" className="form-select" value={formData.teacher_id} onChange={handleInputChange} required>
                      <option value="">Seleccionar docente</option>
                      {teacherOptions.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name} — {teacher.subject}</option>)}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="col-md-6">
                <label htmlFor="subject" className="form-label">Materia</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  className="form-control"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            
            <div className="mb-3">
              <label htmlFor="title" className="form-label">Título</label>
              <input
                type="text"
                id="title"
                name="title"
                className="form-control"
                value={formData.title}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="description" className="form-label">Descripción</label>
              <div className="mb-2">
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    const templatesList = templates.map(t => t.description);
                    if (templatesList.length === 0) {
                      Swal.fire('No hay plantillas disponibles');
                      return;
                    }
                    Swal.fire({
                      title: 'Seleccionar plantilla',
                      input: 'select',
                      inputOptions: templatesList.reduce((acc, t, i) => {
                        acc[i] = t.substring(0, 50) + '...';
                        return acc;
                      }, {}),
                      inputPlaceholder: 'Selecciona una plantilla',
                      showCancelButton: true,
                      cancelButtonText: 'Cancelar',
                      confirmButtonText: 'Seleccionar'
                    }).then((result) => {
                      if (result.isConfirmed) {
                        handleTemplateSelect(templatesList[result.value]);
                      }
                    });
                  }}
                >
                  Usar plantilla
                </button>
              </div>
              <textarea
                id="description"
                name="description"
                className="form-control"
                rows="4"
                value={formData.description}
                onChange={handleInputChange}
                required
              ></textarea>
            </div>
            
            <div className="mb-3">
              <label htmlFor="activities" className="form-label">Actividades</label>
              <textarea
                id="activities"
                name="activities"
                className="form-control"
                rows="4"
                value={formData.activities}
                onChange={handleInputChange}
                required
              ></textarea>
            </div>
            
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="failed_achievements" className="form-label">Logros No Alcanzados</label>
                <div className="mb-2">
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleIndicatorsSelect('failed')}
                  >
                    Cargar indicadores no alcanzados
                  </button>
                </div>
                <textarea
                  id="failed_achievements"
                  name="failed_achievements"
                  className="form-control"
                  rows="4"
                  value={formData.failed_achievements}
                  onChange={handleInputChange}
                ></textarea>
              </div>
              
              <div className="col-md-6">
                <label htmlFor="passed_achievements" className="form-label">Logros Alcanzados</label>
                <div className="mb-2">
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-success"
                    onClick={() => handleIndicatorsSelect('passed')}
                  >
                    Cargar indicadores alcanzados
                  </button>
                </div>
                <textarea
                  id="passed_achievements"
                  name="passed_achievements"
                  className="form-control"
                  rows="4"
                  value={formData.passed_achievements}
                  onChange={handleInputChange}
                ></textarea>
              </div>
            </div>
            
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="deadline" className="form-label">Fecha Límite</label>
                <input
                  type="date"
                  id="deadline"
                  name="deadline"
                  className="form-control"
                  value={formData.deadline}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="col-md-6">
                <label htmlFor="activity_status" className="form-label">Estado del Plan</label>
                <select
                  id="activity_status"
                  name="activity_status"
                  className="form-select"
                  value={formData.activity_status}
                  onChange={handleInputChange}
                >
                  <option value="pending">Pendiente</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="completed">Completado</option>
                  <option value="failed">Fallido</option>
                </select>
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="video_urls" className="form-label">URLs de Videos</label>
                <textarea
                  id="video_urls"
                  name="video_urls"
                  className="form-control"
                  rows="3"
                  value={formData.video_urls}
                  onChange={handleInputChange}
                  placeholder="https://youtube.com/watch?v=ejemplo1&#10;https://youtube.com/watch?v=ejemplo2"
                />
                <small className="form-text text-muted">
                  Una URL por línea. Soporta YouTube, Vimeo, etc.
                </small>
              </div>
              
              <div className="col-md-6">
                <label htmlFor="resource_links" className="form-label">Enlaces a Recursos</label>
                <textarea
                  id="resource_links"
                  name="resource_links"
                  className="form-control"
                  rows="3"
                  value={formData.resource_links}
                  onChange={handleInputChange}
                  placeholder="https://khanacademy.org/math&#10;https://mathway.com"
                />
                <small className="form-text text-muted">
                  Enlaces a recursos externos, uno por línea.
                </small>
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="file_url" className="form-label">URL de Archivo (opcional)</label>
                <input
                  type="text"
                  id="file_url"
                  name="file_url"
                  className="form-control"
                  value={formData.file_url}
                  onChange={handleInputChange}
                />
                <small className="form-text text-muted">Puedes conservar un enlace externo. Para publicar el PDF en la plataforma, selecciónalo abajo.</small>
              </div>
              
              <div className="col-md-6">
                <label htmlFor="attempts_count" className="form-label">Intentos del Estudiante</label>
                <input
                  type="number"
                  id="attempts_count"
                  name="attempts_count"
                  className="form-control"
                  value={formData.attempts_count}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="planPdf" className="form-label">PDF del plan para el estudiante</label>
              <input
                id="planPdf"
                type="file"
                accept="application/pdf,.pdf"
                className="form-control"
                onChange={event => setPlanPdf(event.target.files?.[0] || null)}
              />
              <small className="form-text text-muted">
                {planPdf ? `Se publicará: ${planPdf.name}` : hasPublishedPdf ? 'Ya hay un PDF publicado. Selecciona otro para reemplazarlo.' : 'El plan aparecerá como pendiente para el estudiante hasta que publiques un PDF.'}
              </small>
            </div>

            <div className="form-check mb-3">
              <input
                id="physical_delivery_required"
                name="physical_delivery_required"
                type="checkbox"
                className="form-check-input"
                checked={Boolean(formData.physical_delivery_required)}
                onChange={handleInputChange}
              />
              <label htmlFor="physical_delivery_required" className="form-check-label">
                También solicitar entrega física al docente (opcional)
              </label>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="teacher_notes" className="form-label">Notas del Profesor</label>
                <textarea
                  id="teacher_notes"
                  name="teacher_notes"
                  className="form-control"
                  rows="3"
                  value={formData.teacher_notes}
                  onChange={handleInputChange}
                  placeholder="Notas adicionales para el estudiante..."
                />
              </div>
              
              <div className="col-md-6">
                <label htmlFor="student_feedback" className="form-label">Comentarios del Estudiante</label>
                <textarea
                  id="student_feedback"
                  name="student_feedback"
                  className="form-control"
                  rows="3"
                  value={formData.student_feedback}
                  onChange={handleInputChange}
                  placeholder="Comentarios del estudiante sobre el plan..."
                />
              </div>
            </div>
            
            {isEditing && (
              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      id="completed"
                      name="completed"
                      className="form-check-input"
                      checked={formData.completed}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="completed" className="form-check-label">Completado</label>
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      id="email_sent"
                      name="email_sent"
                      className="form-check-input"
                      checked={formData.email_sent}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="email_sent" className="form-check-label">Email Enviado</label>
                  </div>
                </div>
              </div>
            )}
            
            <div className="d-flex justify-content-between mt-4">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/planes-mejoramiento')}
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ImprovementPlanForm;
