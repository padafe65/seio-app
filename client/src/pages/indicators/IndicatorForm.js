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
      setError(null);
      
      const response = await axios.get(`/api/teachers/${teacherId}/students/by-grade/${grade}`, {
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('📊 Estudiantes cargados:', response.data);
      
      // Agregar la opción "Todos los estudiantes" al principio
      const studentsList = Array.isArray(response.data) ? response.data : [];
      
      const formattedStudents = [
        { 
          id: 'all', 
          name: 'Todos los estudiantes del curso',
          grade: grade
        },
        ...studentsList.map(student => ({
          ...student,
          // Asegurar que el nombre se muestre correctamente
          name: student.name || `Estudiante ${student.id}`,
          // Asegurar que el grado esté presente
          grade: student.grade || grade
        }))
      ];
      
      setStudents(formattedStudents);
      
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
        status: error.response?.status,
        stack: error.stack
      });
      
      // Mensaje de error predeterminado
      let errorMessage = 'No se pudieron cargar los estudiantes. Intente nuevamente.';
      
      // Mensajes más específicos según el tipo de error
      if (error.response) {
        // El servidor respondió con un estado de error
        switch(error.response.status) {
          case 400:
            errorMessage = 'Datos de solicitud incorrectos. Verifique los parámetros.';
            break;
          case 401:
            errorMessage = 'No autorizado. Por favor, inicie sesión nuevamente.';
            break;
          case 403:
            errorMessage = 'No tiene permiso para ver los estudiantes de este grado.';
            break;
          case 404:
            errorMessage = 'No se encontraron estudiantes para el grado seleccionado.';
            break;
          case 500:
            errorMessage = 'Error en el servidor. Por favor, intente más tarde.';
            break;
          default:
            errorMessage = `Error del servidor (${error.response.status}): ${error.response.data?.message || 'Error desconocido'}`;
        }
      } else if (error.request) {
        // La solicitud fue hecha pero no hubo respuesta
        errorMessage = 'No se recibió respuesta del servidor. Verifique su conexión a internet.';
      } else {
        // Error al configurar la solicitud
        errorMessage = `Error al configurar la solicitud: ${error.message}`;
      }
      
      setError(errorMessage);
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
        setError(null);
        
        // Obtener ID del profesor si el usuario es docente
        if (user && (user.role === 'docente' || user.role === 'super_administrador')) {
          console.log('👨\u200d🏫 Usuario es docente o administrador, obteniendo información adicional...');
          
          // Intentar obtener el ID del docente de diferentes maneras
          let teacherIdToUse = null;
          let teacherLoadError = null;
          
          // 1. Si ya tenemos teacherId en el estado del usuario
          if (user.teacherId) {
            console.log(`🔍 Usando teacherId del estado del usuario: ${user.teacherId}`);
            teacherIdToUse = user.teacherId;
          } 
          // 2. Si no, intentar obtenerlo del endpoint de teachers/by-user
          else {
            console.log(`🔍 Solicitando información del docente para el usuario ID: ${user.id}`);
            try {
              const teacherResponse = await axios.get(`/api/teachers/by-user/${user.id}`, {
                headers: { 
                  Authorization: `Bearer ${localStorage.getItem('authToken')}`,
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                }
              });
              
              console.log('📊 Respuesta completa del servidor:', teacherResponse);
              
              if (teacherResponse.data?.id) {
                teacherIdToUse = teacherResponse.data.id;
                console.log(`✅ ID de docente obtenido: ${teacherIdToUse}`);
                
                // Actualizar el estado del usuario con el ID del docente
                setUser(prev => ({
                  ...prev,
                  teacherId: teacherIdToUse
                }));
              }
            } catch (error) {
              teacherLoadError = error;
              console.warn('⚠️ No se pudo obtener información del docente:', error);
            }
          }
          
          // Si tenemos un teacherId, cargar la información relacionada
          if (teacherIdToUse) {
            setTeacherId(teacherIdToUse);
            
            // Cargar materia del docente
            try {
              console.log('📚 Obteniendo materia del docente...');
              const subjectResponse = await axios.get(
                `/api/indicators/subjects/teacher/${user.id}`, 
                { 
                  headers: { 
                    Authorization: `Bearer ${localStorage.getItem('authToken')}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                  }
                }
              );
              
              console.log('📊 Materia del docente:', subjectResponse.data);
              
              if (subjectResponse.data?.subject) {
                const subject = subjectResponse.data.subject;
                setTeacherSubject(subject);
                setFormData(prev => ({ 
                  ...prev, 
                  subject: subject
                }));
              }
            } catch (error) {
              console.warn('⚠️ No se pudo obtener la materia del docente:', error);
            }
            
            // Cargar cuestionarios del docente
            try {
              console.log('📋 Obteniendo cuestionarios para el docente:', user.id);
              const questionnairesResponse = await axios.get(
                `/api/indicators/questionnaires/teacher/${user.id}`,
                { 
                  headers: { 
                    Authorization: `Bearer ${localStorage.getItem('authToken')}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                  }
                }
              );
              
              console.log('📊 Cuestionarios obtenidos:', questionnairesResponse.data);
              
              const questionnairesList = Array.isArray(questionnairesResponse.data) ? 
                questionnairesResponse.data : [];
              
              setQuestionnaires(questionnairesList);
              
              if (questionnairesList.length > 0) {
                console.log('✅ Hay cuestionarios disponibles, desactivando entrada manual');
                setManualEntry(false);
                
                // Si estamos editando y no hay un cuestionario seleccionado, seleccionar el primero
                if (isEditing && !formData.questionnaire_id) {
                  setFormData(prev => ({
                    ...prev,
                    questionnaire_id: questionnairesList[0].id,
                    subject: questionnairesList[0].category || prev.subject || teacherSubject,
                    phase: questionnairesList[0].phase?.toString() || prev.phase
                  }));
                }
              }
            } catch (error) {
              console.warn('⚠️ No se pudieron cargar los cuestionarios:', error);
              setQuestionnaires([]);
              setManualEntry(true);
              
              if (isEditing) {
                setFormData(prev => ({
                  ...prev,
                  questionnaire_id: null
                }));
              }
            }
          } else if (teacherLoadError) {
            // Solo mostramos error si no se pudo cargar el ID del docente
            setError('No se pudo cargar la información del profesor. Por favor, verifique su conexión e intente nuevamente.');
          }
        }
        
        // Si estamos editando, cargar datos del indicador
        if (isEditing) {
          try {
            console.log(`🔄 Cargando datos del indicador ${id}...`);
            const indicatorResponse = await axios.get(`/api/indicators/${id}`, {
              headers: { 
                Authorization: `Bearer ${localStorage.getItem('authToken')}`,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            
            console.log('📊 Datos del indicador cargados:', indicatorResponse.data);
            
            const indicatorData = indicatorResponse.data || {};
            setFormData(prev => ({
              ...prev,
              ...indicatorData
            }));
            
            // Si tiene un cuestionario asociado, desactivar entrada manual
            if (indicatorData.questionnaire_id) {
              console.log(`✅ Indicador tiene cuestionario asociado: ${indicatorData.questionnaire_id}`);
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
        questionnaire_id: null,
        // Restablecer subject y phase solo si no hay valor previo
        ...(prev.subject === teacherSubject ? { subject: '' } : {}),
        ...(prev.phase ? {} : { phase: '' })
      }));
      return;
    }
    
    const selectedQuestionnaire = questionnaires.find(q => q.id.toString() === selectedId);
    
    if (selectedQuestionnaire) {
      setFormData(prev => ({
        ...prev,
        questionnaire_id: selectedId,
        // Solo actualizamos subject si no hay un valor previo o si coincide con teacherSubject
        subject: selectedQuestionnaire.category || teacherSubject || prev.subject || '',
        // Solo actualizamos phase si no hay un valor previo
        phase: prev.phase || (selectedQuestionnaire.phase?.toString() || '')
      }));
    }
  };
  
  const toggleManualEntry = () => {
    const newManualEntry = !manualEntry;
    setManualEntry(newManualEntry);
    
    // Si activamos entrada manual, limpiamos el cuestionario seleccionado
    // Si la desactivamos, intentamos seleccionar un cuestionario por defecto si hay uno disponible
    setFormData(prev => ({
      ...prev,
      questionnaire_id: newManualEntry ? null : (questionnaires[0]?.id || null),
      // Si hay un cuestionario seleccionado, actualizamos subject y phase
      ...(questionnaires[0] && !newManualEntry ? {
        subject: questionnaires[0].category || teacherSubject || prev.subject,
        phase: questionnaires[0].phase?.toString() || prev.phase
      } : {})
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validar campos requeridos
      if (!formData.description || !formData.subject || !formData.phase || !formData.grade) {
        throw new Error('Por favor complete todos los campos requeridos');
      }

      // Validar que si no es entrada manual, debe tener un cuestionario seleccionado
      if (!manualEntry && !formData.questionnaire_id) {
        throw new Error('Debe seleccionar un cuestionario o habilitar la entrada manual');
      }

      const dataToSend = { 
        ...formData,
        // Si se seleccionó 'todos', no enviamos student_id
        student_id: formData.student_id === 'all' ? null : formData.student_id,
        // Aseguramos que el teacher_id esté incluido
        teacher_id: teacherId || formData.teacher_id,
        // Forzamos el questionnaire_id a null si es entrada manual
        questionnaire_id: manualEntry ? null : formData.questionnaire_id
      };
      
      // Si es entrada manual, aseguramos que no se envíe el questionnaire_id
      if (manualEntry) {
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
