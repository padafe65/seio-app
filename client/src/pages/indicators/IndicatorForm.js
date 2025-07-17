import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const IndicatorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const isEditing = !!id;
  
  const [formData, setFormData] = useState({
    description: '',
    subject: '',
    phase: '',
    achieved: false,
    student_id: 'all', // Valor por defecto para 'Todos los estudiantes'
    questionnaire_id: null,
    grade: ''
  });

  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teacherId, setTeacherId] = useState(null);
  const [students, setStudents] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [manualEntry, setManualEntry] = useState(true);
  const [teacherSubject, setTeacherSubject] = useState('');
  


  // Función para cargar estudiantes por grado
  const fetchStudents = useCallback(async (teacherId, grade) => {
    try {
      // Si no hay grado, salir
      if (!grade) {
        console.log('⚠️ No se ha especificado un grado para cargar estudiantes');
        return;
      }
      
      console.log(`🔍 Cargando estudiantes para el docente ${teacherId}, grado ${grade}`);
      setLoading(true);
      
      const response = await axios.get(`/api/teachers/${teacherId}/students/by-grade/${grade}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      
      console.log('📊 Estudiantes cargados:', response.data);
      
      // Agregar la opción "Todos los estudiantes" al principio
      const studentsList = Array.isArray(response.data) ? response.data : [];
      
      setStudents([
        { id: 'all', name: 'Todos los estudiantes del curso' },
        ...studentsList
      ]);
      
      // Si solo hay un estudiante, seleccionarlo automáticamente
      if (studentsList.length === 1) {
        setFormData(prev => ({
          ...prev,
          student_id: studentsList[0].id
        }));
      }
    } catch (error) {
      console.error('❌ Error al cargar estudiantes:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      setError('No se pudieron cargar los estudiantes. Intente nuevamente.');
      
      // Mostrar un mensaje más descriptivo al usuario
      if (error.response?.status === 403) {
        setError('No tiene permiso para ver los estudiantes de este grado.');
      } else if (error.response?.status === 404) {
        setError('No se encontraron estudiantes para el grado seleccionado.');
      }
    } finally {
      setLoading(false);
    }
  }, []); // Eliminamos la dependencia de shouldLoadStudents

  // Manejador para cuando cambia el grado
  const handleGradeChange = (e) => {
    const selectedGrade = e.target.value;
    console.log(`📝 Grado seleccionado: ${selectedGrade}`);
    
    // Actualizar el estado del formulario
    setFormData(prev => ({
      ...prev,
      grade: selectedGrade,
      student_id: 'all' // Resetear la selección de estudiante
    }));
    
    // Si hay un docente y un grado seleccionado, cargar estudiantes
    if (teacherId && selectedGrade) {
      fetchStudents(teacherId, selectedGrade);
    }
  };

  // Efecto para cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Obtener ID del profesor si el usuario es docente
        if (user && user.role === 'docente') {
          console.log('👨‍🏫 Usuario es docente, obteniendo información adicional...');
          
          try {
            // Obtener información del profesor
            const teacherResponse = await axios.get(`/api/teachers/by-user/${user.id}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
            });
            
            console.log('📊 Información del docente:', teacherResponse.data);
            
            if (!teacherResponse.data || !teacherResponse.data.id) {
              throw new Error('No se pudo obtener el ID del profesor');
            }
            
            const teacherId = teacherResponse.data.id;
            setTeacherId(teacherId);
            
            // Actualizar el estado del usuario con el ID del docente
            setUser(prev => ({
              ...prev,
              teacherId: teacherId
            }));
            
            // Obtener materia del docente
            try {
              console.log('📚 Obteniendo materia del docente...');
              const subjectResponse = await axios.get(
                `/api/indicators/subjects/teacher/${user.id}`, 
                { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }}
              );
              
              console.log('📊 Materia del docente:', subjectResponse.data);
              
              if (subjectResponse.data && subjectResponse.data.subject) {
                setTeacherSubject(subjectResponse.data.subject);
                setFormData(prev => ({ 
                  ...prev, 
                  subject: subjectResponse.data.subject 
                }));
              }
            } catch (subjectError) {
              console.warn('⚠️ No se pudo obtener la materia del docente:', subjectError);
              console.warn('Detalles:', {
                status: subjectError.response?.status,
                data: subjectError.response?.data,
                message: subjectError.message
              });
            }
            
            // Obtener cuestionarios del profesor
            try {
              console.log('📋 Obteniendo cuestionarios para el docente:', user.id);
              const questionnairesResponse = await axios.get(
                `/api/indicators/questionnaires/teacher/${user.id}`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }}
              );
              
              console.log('📊 Cuestionarios obtenidos:', questionnairesResponse.data);
              
              setQuestionnaires(questionnairesResponse.data || []);
              
              // Si hay cuestionarios disponibles, permitir seleccionar uno
              if (questionnairesResponse.data && questionnairesResponse.data.length > 0) {
                console.log('✅ Hay cuestionarios disponibles, desactivando entrada manual');
                setManualEntry(false);
              }
            } catch (questError) {
              console.warn('No se pudieron cargar los cuestionarios, usando entrada manual');
              setQuestionnaires([]);
              setManualEntry(true);
            }
          } catch (teacherError) {
            console.error('Error al obtener información del profesor:', teacherError);
            setError('No se pudo cargar la información del profesor. Por favor, verifique su conexión e intente nuevamente.');
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
  }, [id, isEditing, user, setUser]);
  
  // Efecto para cargar estudiantes cuando cambian las dependencias
  useEffect(() => {
    if (teacherId && formData.grade) {
      fetchStudents(teacherId, formData.grade);
    }
  }, [teacherId, formData.grade, fetchStudents]);

  // Inicializar con la opción por defecto
  useEffect(() => {
    if (students.length === 0) {
      setStudents([{ id: 'all', name: 'Todos los estudiantes del curso' }]);
    }
  }, [students.length]);

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
    setLoading(true);
    setError(null);

    try {
      const dataToSend = { 
        ...formData,
        // Si se seleccionó 'todos', no enviamos student_id
        student_id: formData.student_id === 'all' ? null : formData.student_id,
        // Aseguramos que el teacher_id esté incluido
        teacher_id: teacherId || formData.teacher_id
      };
      
      // Si no hay un cuestionario seleccionado, no lo enviamos
      if (!dataToSend.questionnaire_id) {
        delete dataToSend.questionnaire_id;
      }

      if (isEditing) {
        await axios.put(`/api/indicators/${id}`, dataToSend);
      } else {
        await axios.post('/api/indicators', dataToSend);
      }
      
      navigate('/indicators');
    } catch (error) {
      console.error('Error al guardar indicador:', error);
      const errorMessage = error.response?.data?.message || 
                         error.response?.data?.error?.message || 
                         'Error al guardar el indicador. Por favor, intente nuevamente.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Selector de estudiantes
  const studentSelect = (
    <div className="mb-3">
      <label className="form-label">Aplicar a</label>
      <select
        className="form-select"
        name="student_id"
        value={formData.student_id || 'all'}
        onChange={handleChange}
        required
        disabled={!formData.grade}
      >
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.name} {student.grade ? `- Grado ${student.grade}` : ''}
          </option>
        ))}
        {students.length === 1 && (
          <option value="" disabled>No hay estudiantes disponibles</option>
        )}
      </select>
      <div className="form-text">
        {formData.grade 
          ? `Mostrando estudiantes de grado ${formData.grade}`
          : 'Seleccione un grado para ver las opciones'}
        {loading && <span className="ms-2">Cargando estudiantes...</span>}
      </div>
    </div>
  );

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
          {teacherSubject && (
            <div className="form-text">Materia asignada: {teacherSubject}</div>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="phase" className="form-label">Fase</label>
          <select
            className="form-select"
            id="phase"
            name="phase"
            value={formData.phase}
            onChange={handleChange}
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
          <label htmlFor="grade" className="form-label">Grado del Estudiante:</label>
          <select
            id="grade"
            className="form-select"
            value={formData.grade}
            onChange={handleGradeChange}
            required
            disabled={loading}
          >
            <option value="">Seleccione un grado</option>
            {['6', '7', '8', '9', '10', '11'].map(grade => (
              <option key={grade} value={grade}>
                {grade}°
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label htmlFor="student_id" className="form-label">Aplicar a:</label>
          <select
            id="student_id"
            className="form-select"
            value={formData.student_id}
            onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
            required
            disabled={!formData.grade || loading}
          >
            {!formData.grade ? (
              <option>Seleccione un grado primero</option>
            ) : loading ? (
              <option>Cargando estudiantes...</option>
            ) : students.length === 0 ? (
              <option>No hay estudiantes disponibles para este grado</option>
            ) : (
              [
                <option key="all" value="all">
                  Todos los estudiantes del curso
                </option>,
                ...students
                  .filter(student => student.id !== 'all')
                  .map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))
              ]
            )}
          </select>
          {error && (
            <div className="text-danger mt-2">
              <small>{error}</small>
            </div>
          )}
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
