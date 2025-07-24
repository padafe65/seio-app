import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const IndicatorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;
  
  // Estado inicial del formulario
  const [formData, setFormData] = useState({
    description: '',
    subject: '',
    phase: '',
    achieved: false,
    student_id: 'none', // Valor por defecto: no asignar a estudiantes
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
  const [students, setStudents] = useState([
    { 
      id: 'none', 
      name: 'No aplicar aún',
      grade: ''
    },
    { 
      id: 'all', 
      name: 'Todos los estudiantes del curso',
      grade: ''
    }
  ]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [teacherSubject, setTeacherSubject] = useState('');
  



  
  // Función auxiliar para cargar cuestionarios
  const loadQuestionnaires = async (userId, editing = false) => {
    if (!userId) return [];
    
    try {
      setLoading(true);
      console.log('🔍 Obteniendo cuestionarios para el usuario:', userId);
      
      const response = await axios.get(
        `/api/indicators/questionnaires/teacher/${userId}`, 
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
        
        if (!editing && questionnairesData.length > 0) {
          setManualEntry(false);
          
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
      }
      throw new Error('No se pudieron cargar los cuestionarios');
    } catch (error) {
      console.error('❌ Error al cargar cuestionarios:', error);
      setError('No se pudieron cargar los cuestionarios. Por favor, intente nuevamente.');
      setManualEntry(true);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Cargar cuestionarios del docente
  const fetchQuestionnaires = useCallback(() => {
    return loadQuestionnaires(user?.id, isEditing);
  }, [user?.id, isEditing, teacherSubject]);

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
      
      // Verificar si la respuesta es un array
      let studentsList = [];
      if (Array.isArray(response.data)) {
        studentsList = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        studentsList = response.data.data;
      } else if (response.data?.success && response.data.data) {
        studentsList = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
      }
      
      console.log(`📊 ${studentsList.length} estudiantes encontrados para el grado ${grade}`);
      
      // Siempre incluir las opciones por defecto
      const defaultOptions = [
        { 
          id: 'none', 
          name: 'No aplicar aún',
          grade: grade
        },
        { 
          id: 'all', 
          name: 'Todos los estudiantes del curso',
          grade: grade
        }
      ];
      
      // Mapear los estudiantes de la respuesta
      const studentOptions = studentsList.map(student => ({
        id: student.id || student.user_id,
        name: student.name || student.full_name || `Estudiante ${student.id || student.user_id}`,
        grade: student.grade || grade,
        email: student.email
      }));
      
      // Combinar opciones por defecto con estudiantes
      const formattedStudents = [...defaultOptions, ...studentOptions];
      
      console.log('📋 Opciones de estudiantes:', formattedStudents);
      setStudents(formattedStudents);
      
      // Si solo hay un estudiante, seleccionarlo por defecto
      if (studentsList.length === 1) {
        console.log('✅ Seleccionando único estudiante disponible');
        setFormData(prev => ({
          ...prev,
          student_id: studentsList[0].id || studentsList[0].user_id
        }));
      }
      
      return formattedStudents;
    } catch (error) {
      console.error('❌ Error al cargar estudiantes:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      
      let errorMessage = 'No se pudieron cargar los estudiantes. Intente nuevamente.';
      
      if (error.response) {
        switch(error.response.status) {
          case 400: 
            errorMessage = 'Datos de solicitud incorrectos.'; 
            break;
          case 401: 
            errorMessage = 'No autorizado. Inicie sesión nuevamente.'; 
            break;
          case 403: 
            errorMessage = 'No tiene permiso para ver estos estudiantes.'; 
            break;
          case 404: 
            errorMessage = 'No se encontraron estudiantes para el grado seleccionado.'; 
            break;
          case 500: 
            errorMessage = 'Error en el servidor. Intente más tarde.'; 
            break;
          default: 
            errorMessage = `Error del servidor (${error.response.status})`;
        }
      } else if (error.request) {
        errorMessage = 'No se recibió respuesta del servidor. Verifique su conexión.';
      }
      
      setError(errorMessage);
      
      // Mantener las opciones por defecto
      const defaultOptions = [
        { 
          id: 'none', 
          name: 'No aplicar aún',
          grade: grade
        },
        { 
          id: 'all', 
          name: 'No se pudieron cargar los estudiantes',
          grade: grade,
          disabled: true
        }
      ];
      
      setStudents(defaultOptions);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Manejador para cuando cambia el grado
  const handleGradeChange = (e) => {
    const selectedGrade = e.target.value;
    
    // Actualizar el estado del formulario
    setFormData(prev => ({
      ...prev,
      grade: selectedGrade,
      student_id: 'none' // Reiniciar a 'No aplicar aún' al cambiar el grado
    }));
    
    // Cargar estudiantes para el grado seleccionado
    if (teacherId && selectedGrade) {
      console.log(`🔄 Cargando estudiantes para el docente ${teacherId}, grado ${selectedGrade}`);
      fetchStudents(teacherId, selectedGrade).then(() => {
        console.log('✅ Estudiantes cargados correctamente');
      }).catch(error => {
        console.error('❌ Error al cargar estudiantes:', error);
        setError('No se pudieron cargar los estudiantes. Por favor, intente nuevamente.');
      });
    } else {
      console.log('⚠️ No se pudo cargar estudiantes - Falta teacherId o grado');
    }
  };



  // Cargar datos del indicador
  const fetchIndicator = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
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
          student_id: indicatorData.student_id || 'none',
          questionnaire_id: indicatorData.questionnaire_id || null,
          questionnaire_data: indicatorData.questionnaire_data || null
        }));
        
        setManualEntry(!indicatorData.questionnaire_id);
        
        // Si hay un grado, cargar los estudiantes
        if (indicatorData.grade && teacherId) {
          await fetchStudents(teacherId, indicatorData.grade);
        }
      }
    } catch (error) {
      console.error('Error al cargar el indicador:', error);
      setError('Error al cargar el indicador. Intente recargar la página.');
    } finally {
      setLoading(false);
    }
  }, [id, teacherId, fetchStudents]);

  // Cargar información del docente
  useEffect(() => {
    const loadTeacherInfo = async () => {
      if (!user?.id) return;
      
      try {
        const response = await axios.get(`/api/teachers/user/${user.id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        
        if (response.data?.success) {
          setTeacherId(response.data.id);
          setTeacherSubject(response.data.subject || '');
          
          // Si hay una materia, actualizamos el formulario
          if (response.data.subject) {
            setFormData(prev => ({
              ...prev,
              subject: response.data.subject
            }));
          }
        }
      } catch (error) {
        console.error('Error al cargar información del docente:', error);
      }
    };
    
    loadTeacherInfo();
  }, [user?.id]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // 1. Cargar cuestionarios
        await loadQuestionnaires(user.id, isEditing);
        
        // 2. Si estamos editando, cargar el indicador
        if (isEditing) {
          await fetchIndicator();
        }
      } catch (error) {
        console.error('Error al cargar los datos iniciales:', error);
        setError('Error al cargar los datos iniciales. Intente recargar la página.');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [user?.id, isEditing]);

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
    console.log('🔄 Cambiando estudiante seleccionado a:', selectedStudentId);
    
    // Encontrar el estudiante seleccionado
    const selectedStudent = students.find(s => s.id === selectedStudentId);
    
    // Actualizar el estado del formulario
    setFormData(prev => {
      const newState = {
        ...prev,
        student_id: selectedStudentId
      };
      
      // Si se selecciona un estudiante específico, actualizar el grado si es necesario
      if (selectedStudentId !== 'all' && selectedStudentId !== 'none' && selectedStudent) {
        newState.grade = selectedStudent.grade || prev.grade;
      }
      
      return newState;
    });
    
    console.log('✅ Estado actualizado con estudiante:', selectedStudentId);
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
      console.log('📤 Iniciando envío del formulario...');
      
      // Validar campos requeridos
      const requiredFields = ['description', 'subject', 'phase', 'grade'];
      const missingFields = requiredFields.filter(field => !formData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Por favor complete los campos requeridos: ${missingFields.join(', ')}`);
      }

      // Validar que si no es entrada manual, debe tener un cuestionario seleccionado
      if (!manualEntry && !formData.questionnaire_id) {
        throw new Error('Debe seleccionar un cuestionario o habilitar la entrada manual');
      }

      // Validar la selección de estudiantes
      if (formData.student_id === '') {
        throw new Error('Debe seleccionar una opción para "Aplicar a"');
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
        student_ids: formData.student_id === 'all' 
          ? 'all' 
          : formData.student_id === 'none'
            ? []
            : [formData.student_id]
      };

      console.log('📝 Datos a enviar al servidor:', JSON.stringify(dataToSend, null, 2));

      const url = isEditing 
        ? `/api/indicators/${id}`
        : '/api/indicators';
      
      const method = isEditing ? 'put' : 'post';
      
      console.log(`🔄 Enviando solicitud ${method.toUpperCase()} a ${url}`);
      
      const response = await axios({
        method,
        url,
        data: dataToSend,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Respuesta del servidor:', response.data);

      if (response.data.success) {
        console.log('🎉 Indicador guardado exitosamente');
        // Mostrar mensaje de éxito y redirigir
        alert(isEditing ? 'Indicador actualizado correctamente' : 'Indicador creado correctamente');
        navigate('/indicators');
      } else {
        throw new Error(response.data.message || 'Error al guardar el indicador');
      }
    } catch (error) {
      console.error('❌ Error al guardar indicador:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        }
      });
      
      const errorMessage = error.response?.data?.message || 
                         error.message || 
                         'Error al guardar el indicador. Por favor, intente nuevamente.';
      
      setError(errorMessage);
      
      // Desplazarse al principio del formulario para mostrar el error
      window.scrollTo(0, 0);
    } finally {
      setLoading(false);
    }
  };

  const renderStudentSelect = () => (
    <div className="mb-4">
      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="student_id">
        Aplicar a:
      </label>
      <select
        id="student_id"
        name="student_id"
        value={formData.student_id}
        onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
        className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        disabled={loading || !formData.grade}
      >
        <option value="none">No aplicar aún</option>
        <option value="all">Todos los estudiantes del curso</option>
        {students
          .filter(student => student.id !== 'all' && student.id !== 'none')
          .map(student => (
            <option key={student.id} value={student.id}>
              {student.name} - Grado {student.grade}
            </option>
          ))
        }
      </select>
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

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="student_id">
            Aplicar a:
          </label>
          <select
            id="student_id"
            name="student_id"
            value={formData.student_id}
            onChange={handleStudentChange}
            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            disabled={loading || !formData.grade}
            required
          >
            {!formData.grade ? (
              <option value="">Seleccione un grado primero</option>
            ) : loading ? (
              <option value="">Cargando estudiantes...</option>
            ) : students.length <= 2 ? ( // Solo las opciones por defecto
              <option value="">No hay estudiantes disponibles para este grado</option>
            ) : null}
            
            {students.map((student) => (
              <option 
                key={student.id} 
                value={student.id}
                disabled={student.disabled}
                className={student.disabled ? 'text-gray-400' : ''}
              >
                {student.name} {student.email ? `(${student.email})` : ''}
              </option>
            ))}
          </select>
          
          <p className="text-gray-600 text-xs mt-1">
            {formData.student_id === 'none' 
              ? 'El indicador no se aplicará a ningún estudiante por ahora.'
              : formData.student_id === 'all'
                ? 'El indicador se aplicará a todos los estudiantes del grado seleccionado.'
                : formData.student_id
                  ? 'El indicador se aplicará solo al estudiante seleccionado.'
                  : 'Seleccione una opción'}
          </p>
          
          {error && (
            <div className="text-red-500 text-xs mt-1">
              {error}
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
