import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const IndicatorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const isEditing = !!id;
  
  // Estado inicial del formulario
  const [formData, setFormData] = useState({
    description: '',
    subject: '',
    phase: '',
    achieved: false,
    student_id: 'all',
    teacher_id: '',
    questionnaire_id: null,
    students: [],
    grade: ''
  });
  
  // Estados del componente
  const [loading, setLoading] = useState(true);
  const [manualEntry, setManualEntry] = useState(true);
  const [error, setError] = useState(null);
  const [teacherId, setTeacherId] = useState(null);
  const [students, setStudents] = useState([{ 
    id: 'all', 
    name: 'Todos los estudiantes del curso' 
  }]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [teacherSubject, setTeacherSubject] = useState('');
  



  
  // Función para cargar estudiantes por grado
  const fetchStudents = useCallback(async (teacherId, grade) => {
    if (!grade) {
      console.log('⚠️ No se ha especificado un grado para cargar estudiantes');
      return [];
    }
    
    try {
      console.log(`🔍 Cargando estudiantes para el docente ${teacherId}, grado ${grade}`);
      setLoading(true);
      
      const response = await axios.get(`/api/teachers/${teacherId}/students/by-grade/${grade}`, {
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const studentsList = Array.isArray(response.data) ? response.data : [];
      
      const formattedStudents = [
        { 
          id: 'all', 
          name: 'Todos los estudiantes del curso',
          grade: grade
        },
        ...studentsList.map(student => ({
          ...student,
          name: student.name || `Estudiante ${student.id}`,
          grade: student.grade || grade
        }))
      ];
      
      setStudents(formattedStudents);
      
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
      
      let errorMessage = 'No se pudieron cargar los estudiantes. Intente nuevamente.';
      
      if (error.response) {
        switch(error.response.status) {
          case 400: errorMessage = 'Datos de solicitud incorrectos.'; break;
          case 401: errorMessage = 'No autorizado. Inicie sesión nuevamente.'; break;
          case 403: errorMessage = 'No tiene permiso para ver estos estudiantes.'; break;
          case 404: errorMessage = 'No se encontraron estudiantes para el grado seleccionado.'; break;
          case 500: errorMessage = 'Error en el servidor. Intente más tarde.'; break;
          default: errorMessage = `Error del servidor (${error.response.status})`;
        }
      } else if (error.request) {
        errorMessage = 'No se recibió respuesta del servidor.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Manejador para cuando cambia el grado
  const handleGradeChange = (e) => {
    const selectedGrade = e.target.value;
    setFormData(prev => ({
      ...prev,
      grade: selectedGrade,
      student_id: 'all'
    }));
    
    if (teacherId && selectedGrade) {
      fetchStudents(teacherId, selectedGrade);
    }
  };



  // Cargar cuestionarios del docente
  const fetchQuestionnaires = useCallback(async () => {
    if (!user?.id) return [];
    
    try {
      setLoading(true);
      console.log('🔍 Obteniendo cuestionarios para el usuario:', user.id);
      
      // Obtener los cuestionarios del docente
      const response = await axios.get(
        `/api/indicators/questionnaires/teacher/${user.id}`, 
        {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
      );
      
      if (response.data?.success) {
        const questionnairesData = response.data.data || [];
        setQuestionnaires(questionnairesData);
        
        // Si estamos creando un nuevo indicador y hay cuestionarios disponibles
        if (!isEditing && questionnairesData.length > 0) {
          setManualEntry(false);
          
          // Seleccionar el primer cuestionario por defecto
          if (questionnairesData.length === 1) {
            const firstQuestionnaire = questionnairesData[0];
            setFormData(prev => ({
              ...prev,
              questionnaire_id: firstQuestionnaire.id,
              description: firstQuestionnaire.title || '',
              subject: firstQuestionnaire.subject || teacherSubject || '',
              phase: firstQuestionnaire.phase || '',
              grade: firstQuestionnaire.grade || '',
              questionnaire_data: {
                created_by: firstQuestionnaire.created_by || '',
                teacher_name: firstQuestionnaire.teacher_name || '',
                category: firstQuestionnaire.category || '',
                phase: firstQuestionnaire.phase || '',
                grade: firstQuestionnaire.grade || '',
                created_at: firstQuestionnaire.created_at || ''
              }
            }));
          }
        }
        
        return questionnairesData;
      } else {
        throw new Error('No se pudieron cargar los cuestionarios');
      }
    } catch (error) {
      console.error('❌ Error al cargar cuestionarios:', error);
      setError('No se pudieron cargar los cuestionarios. Por favor, intente nuevamente.');
      setManualEntry(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.id, isEditing, teacherSubject]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // 1. Cargar cuestionarios (esto también obtendrá el teacherId)
        await fetchQuestionnaires();
        
        // 2. Si estamos editando, cargar los datos del indicador
        if (isEditing && id) {
          const indicatorResponse = await axios.get(`/api/indicators/${id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
          });
          
          if (indicatorResponse.data.success) {
            const indicatorData = indicatorResponse.data.data;
            setFormData(prev => ({
              ...prev,
              description: indicatorData.description || '',
              subject: indicatorData.subject || '',
              phase: indicatorData.phase || '',
              grade: indicatorData.grade || '',
              student_id: indicatorData.student_id || 'all',
              questionnaire_id: indicatorData.questionnaire_id || null,
              questionnaire_data: indicatorData.questionnaire_data || null
            }));
            
            setManualEntry(!indicatorData.questionnaire_id);
            
            // Si hay un grado, cargar los estudiantes
            if (indicatorData.grade && teacherId) {
              await fetchStudents(teacherId, indicatorData.grade);
            }
          }
        }
      } catch (error) {
        console.error('Error al cargar los datos iniciales:', error);
        setError('Error al cargar los datos iniciales. Intente recargar la página.');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [id, isEditing, user, teacherId, fetchStudents]);

  // Inicializar con la opción por defecto
  useEffect(() => {
    if (students.length === 0 && !error) {
      setStudents([
        { 
          id: 'all', 
          name: 'Todos los estudiantes del curso',
          grade: formData.grade || ''
        }
      ]);
    }
  }, [students.length, error, formData.grade, formData]);

  // Actualizar estudiantes cuando cambia el grado
  useEffect(() => {
    if (teacherId && formData.grade) {
      fetchStudents(teacherId, formData.grade);
    }
  }, [formData.grade, teacherId, fetchStudents]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleQuestionnaireChange = (e) => {
    const selectedQuestionnaireId = e.target.value;
    const selectedQuestionnaire = questionnaires.find(q => q.id === selectedQuestionnaireId);
    
    setFormData(prev => ({
      ...prev,
      questionnaire_id: selectedQuestionnaireId === 'none' ? null : selectedQuestionnaireId,
      ...(selectedQuestionnaire ? {
        description: selectedQuestionnaire.title || '',
        subject: selectedQuestionnaire.subject || teacherSubject || '',
        phase: selectedQuestionnaire.phase || '',
        grade: selectedQuestionnaire.grade || '',
        // Guardar información adicional del cuestionario
        questionnaire_data: {
          created_by: selectedQuestionnaire.created_by || '',
          teacher_name: selectedQuestionnaire.teacher_name || '',
          category: selectedQuestionnaire.category || '',
          phase: selectedQuestionnaire.phase || '',
          grade: selectedQuestionnaire.grade || '',
          created_at: selectedQuestionnaire.created_at || ''
        }
      } : {
        // Limpiar datos del cuestionario si no hay selección
        questionnaire_data: null
      })
    }));
    
    setManualEntry(selectedQuestionnaireId === 'none');
  };

  const handleStudentChange = (e) => {
    const selectedStudentId = e.target.value;
    
    setFormData(prev => ({
      ...prev,
      student_id: selectedStudentId,
      ...(selectedStudentId !== 'all' && students.length > 0 ? {
        grade: students.find(s => s.id === selectedStudentId)?.grade || prev.grade
      } : {})
    }));
  };

  const toggleManualEntry = () => {
    const newManualEntry = !manualEntry;
    setManualEntry(newManualEntry);
    
    // Si estamos desactivando la entrada manual y hay cuestionarios disponibles
    if (!newManualEntry && questionnaires.length > 0) {
      setFormData(prev => ({
        ...prev,
        // Si hay un cuestionario, usamos sus valores
        ...(questionnaires[0] ? {
          subject: questionnaires[0].subject || teacherSubject || prev.subject,
          phase: questionnaires[0].phase || prev.phase
        } : {})
      }));
    }
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

      // Preparar datos para enviar
      const dataToSend = { 
        description: formData.description,
        subject: formData.subject,
        phase: formData.phase,
        grade: formData.grade,
        achieved: formData.achieved,
        teacher_id: teacherId,
        questionnaire_id: manualEntry ? null : formData.questionnaire_id,
        student_id: formData.student_id === 'all' ? null : formData.student_id
      };

      console.log('Enviando datos al servidor:', dataToSend);

      const response = await axios({
        method: isEditing ? 'put' : 'post',
        url: isEditing ? `/api/indicators/${id}` : '/api/indicators',
        data: dataToSend,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        navigate('/indicators');
      } else {
        throw new Error(response.data.message || 'Error al guardar el indicador');
      }
    } catch (error) {
      console.error('Error al guardar indicador:', error);
      setError(error.response?.data?.message || error.message || 'Error al guardar el indicador. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const studentSelect = (
    <div className="mb-3">
      <label className="form-label">Aplicar a</label>
      <select
        id="student_id"
        name="student_id"
        value={formData.student_id || 'all'}
        onChange={handleStudentChange}
        className="form-select"
        disabled={loading || !formData.grade}
        required
      >
        {students.map(student => (
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
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">
        {isEditing ? 'Editar Indicador' : 'Nuevo Indicador'}
      </h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Selección de cuestionario o entrada manual */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Asociar a cuestionario</h2>
          
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={manualEntry}
                onChange={toggleManualEntry}
                className="form-checkbox h-5 w-5 text-blue-600"
                disabled={questionnaires.length === 0}
              />
              <span className={`ml-2 ${questionnaires.length === 0 ? 'text-gray-500' : 'text-gray-700'}`}>
                Ingresar datos manualmente (sin asociar a cuestionario)
                {questionnaires.length === 0 && ' (No hay cuestionarios disponibles)'}
              </span>
            </label>
          </div>
          
          {!manualEntry && questionnaires.length > 0 && (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="questionnaire_id">
                Cuestionario
              </label>
              <div className="space-y-4">
                <select
                  id="questionnaire_id"
                  name="questionnaire_id"
                  value={formData.questionnaire_id || ''}
                  onChange={handleQuestionnaireChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  disabled={loading}
                  required={!manualEntry}
                >
                  <option value="">Seleccione un cuestionario</option>
                  {questionnaires.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} - Grado {q.grade}°
                    </option>
                  ))}
                </select>

                {formData.questionnaire_data && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-2">Información del cuestionario seleccionado:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Docente:</span>
                        <span className="ml-2">{formData.questionnaire_data.teacher_name || 'No disponible'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Categoría:</span>
                        <span className="ml-2">{formData.questionnaire_data.category || 'No especificada'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Fase:</span>
                        <span className="ml-2">{formData.questionnaire_data.phase || 'No especificada'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Grado:</span>
                        <span className="ml-2">{formData.questionnaire_data.grade || 'No especificado'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium text-gray-600">Creado el:</span>
                        <span className="ml-2">
                          {formData.questionnaire_data.created_at 
                            ? new Date(formData.questionnaire_data.created_at).toLocaleDateString() 
                            : 'Fecha no disponible'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
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
