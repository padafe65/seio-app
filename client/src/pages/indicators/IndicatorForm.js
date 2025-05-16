import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const IndicatorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;
  
  const [formData, setFormData] = useState({
  description: '',
  subject: '',
  phase: '',
  achieved: false,
  student_id: null,
  questionnaire_id: null,
  grade: '' // Añadir esta línea
});

  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teacherId, setTeacherId] = useState(null);
  const [students, setStudents] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [manualEntry, setManualEntry] = useState(true);
  const [teacherSubject, setTeacherSubject] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Obtener ID del profesor si el usuario es docente
        if (user && user.role === 'docente') {
          try {
            const teacherResponse = await axios.get(`/api/teachers/by-user/${user.id}`);
            const teacherId = teacherResponse.data.id;
            setTeacherId(teacherId);
            
            // Obtener materia del docente
            const subjectResponse = await axios.get(`/api/indicators/subjects/teacher/${user.id}`);
            setTeacherSubject(subjectResponse.data.subject);
            setFormData(prev => ({ ...prev, subject: subjectResponse.data.subject }));
            
            // Obtener estudiantes asignados al profesor
            const studentsResponse = await axios.get(`/api/teacher/students/${user.id}`);
            setStudents(studentsResponse.data);
            
            // Obtener cuestionarios del profesor usando user_id
            try {
              console.log("Obteniendo cuestionarios para el usuario:", user.id);
              const questionnairesResponse = await axios.get(`/api/indicators/questionnaires/teacher/${user.id}`);
              console.log("Cuestionarios obtenidos:", questionnairesResponse.data);
              setQuestionnaires(questionnairesResponse.data);
              
              // Si hay cuestionarios disponibles, permitir seleccionar uno
              if (questionnairesResponse.data.length > 0) {
                setManualEntry(false);
              }
            } catch (questError) {
              console.error('Error al cargar cuestionarios:', questError);
              setQuestionnaires([]);
              // Activar entrada manual por defecto si no se pueden cargar los cuestionarios
              setManualEntry(true);
            }
          } catch (teacherError) {
            console.error('Error al obtener información del profesor:', teacherError);
            setError('Error al obtener información del profesor. Intente nuevamente.');
          }
        }
        
        // Si estamos editando, cargar datos del indicador
        if (isEditing) {
          try {
            const indicatorResponse = await axios.get(`/api/indicators/${id}`);
            setFormData(indicatorResponse.data);
            
            // Si tiene un cuestionario asociado, desactivar entrada manual
            if (indicatorResponse.data.questionnaire_id) {
              setManualEntry(false);
            }
          } catch (indicatorError) {
            console.error('Error al cargar indicador:', indicatorError);
            setError('Error al cargar indicador. Intente nuevamente.');
          }
        }
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setError('Error al cargar datos. Intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, isEditing, user]);
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };
  
  const handleQuestionnaireChange = (e) => {
    const selectedId = e.target.value;
    
    if (!selectedId) {
      setFormData(prev => ({
        ...prev,
        questionnaire_id: null
      }));
      return;
    }
    
    const selectedQuestionnaire = questionnaires.find(q => q.id.toString() === selectedId);
    
    if (selectedQuestionnaire) {
      setFormData(prev => ({
        ...prev,
        questionnaire_id: selectedId,
        subject: selectedQuestionnaire.category || teacherSubject || prev.subject,
        phase: selectedQuestionnaire.phase.toString()
      }));
    }
  };
  
  const toggleManualEntry = () => {
    setManualEntry(!manualEntry);
    if (!manualEntry) {
      // Si activamos entrada manual, limpiamos el cuestionario seleccionado
      setFormData(prev => ({
        ...prev,
        questionnaire_id: null
      }));
    }
  };
  
  const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    const dataToSend = {
      ...formData,
      teacher_id: teacherId,
      achieved: formData.achieved ? 1 : 0,
      questionnaire_id: manualEntry ? null : formData.questionnaire_id,
      grade: formData.grade || null // Asegurar que grade se envíe explícitamente
    };
    
    console.log("Enviando datos:", dataToSend);
    
    if (isEditing) {
      await axios.put(`/api/indicators/${id}`, dataToSend);
    } else {
      await axios.post('/api/indicators', dataToSend);
    }
    
    navigate('/indicadores');
  } catch (error) {
    console.error('Error al guardar indicador:', error);
    setError(`Error al guardar indicador: ${error.response?.data?.message || error.message}`);
  }
};

  
  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }
  
  return (
    <div className="container">
      <h2>{isEditing ? 'Editar Indicador' : 'Crear Nuevo Indicador'}</h2>
      
      {error && <div className="alert alert-danger">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-3 form-check">
          <input
            type="checkbox"
            className="form-check-input"
            id="manualEntry"
            checked={manualEntry}
            onChange={toggleManualEntry}
          />
          <label className="form-check-label" htmlFor="manualEntry">
            Ingresar datos manualmente (sin asociar a cuestionario)
          </label>
        </div>
        
        {!manualEntry && (
          <div className="mb-3">
            <label htmlFor="questionnaire_id" className="form-label">Cuestionario</label>
            <select
              className="form-select"
              id="questionnaire_id"
              name="questionnaire_id"
              value={formData.questionnaire_id || ''}
              onChange={handleQuestionnaireChange}
              required={!manualEntry}
            >
              <option value="">Seleccione un cuestionario</option>
              {questionnaires.map(q => (
                <option key={q.id} value={q.id}>
                  {q.title} (Grado: {q.grade}, Fase: {q.phase})
                </option>
              ))}
            </select>
            {questionnaires.length === 0 && (
              <div className="form-text text-warning">
                No se encontraron cuestionarios. Puede crear un indicador manualmente.
              </div>
            )}
          </div>
        )}
        
        <div className="mb-3">
          <label htmlFor="description" className="form-label">Descripción</label>
          <textarea
            className="form-control"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            required
          ></textarea>
        </div>
        
        <div className="mb-3">
          <label htmlFor="subject" className="form-label">Materia</label>
          <input
            type="text"
            className="form-control"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            readOnly={!manualEntry && formData.questionnaire_id}
            required
          />
          <div className="form-text">
            {teacherSubject && `Su materia asignada es: ${teacherSubject}`}
          </div>
        </div>
        
        <div className="mb-3">
          <label htmlFor="phase" className="form-label">Fase</label>
          <select
            className="form-select"
            id="phase"
            name="phase"
            value={formData.phase}
            onChange={handleChange}
            disabled={!manualEntry && formData.questionnaire_id}
            required
          >
            <option value="">Seleccione una fase</option>
            <option value="1">Fase 1</option>
            <option value="2">Fase 2</option>
            <option value="3">Fase 3</option>
            <option value="4">Fase 4</option>
          </select>
        </div>
        
        <div className="mb-3">
          <label htmlFor="grade" className="form-label">Grado</label>
          <select
            className="form-select"
            id="grade"
            name="grade"
            value={formData.grade || ''}
            onChange={handleChange}
          >
            <option value="">Seleccione un grado</option>
            <option value="6">Grado 6</option>
            <option value="7">Grado 7</option>
            <option value="8">Grado 8</option>
            <option value="9">Grado 9</option>
            <option value="10">Grado 10</option>
            <option value="11">Grado 11</option>
          </select>
        </div>



        <div className="mb-3">
          <label htmlFor="student_id" className="form-label">Estudiante (opcional)</label>
          <select
            className="form-select"
            id="student_id"
            name="student_id"
            value={formData.student_id || ''}
            onChange={handleChange}
          >
            <option value="">Todos los estudiantes</option>
            {students.map(student => (
              <option key={student.id} value={student.id}>{student.name}</option>
            ))}
          </select>
          <div className="form-text">Si no selecciona un estudiante, el indicador aplicará para todos.</div>
        </div>
        
        <div className="mb-3 form-check">
          <input
            type="checkbox"
            className="form-check-input"
            id="achieved"
            name="achieved"
            checked={formData.achieved}
            onChange={handleChange}
          />
          <label className="form-check-label" htmlFor="achieved">Logrado</label>
        </div>
        
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary">
            {isEditing ? 'Actualizar' : 'Crear'} Indicador
          </button>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => navigate('/indicadores')}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default IndicatorForm;
