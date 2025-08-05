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
    student_ids: [], // Ahora manejamos un array de IDs
    teacher_id: '',
    questionnaire_id: null,
    grade: ''
  });
  
  // Estados del componente
  const [loading, setLoading] = useState(true);
  const [manualEntry, setManualEntry] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
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
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState(null);
  
  // Estado para controlar la vista de selección (tabla o combo)
  const [showTableView, setShowTableView] = useState(true);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [teacherSubject, setTeacherSubject] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  



  
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
    
    console.log(`🔍 Cargando estudiantes para el docente ${teacherId}, grado ${grade}`);
    setLoading(true);
    
    try {
      // 1. Obtener los estudiantes del docente para el grado especificado
      const [studentsResponse, indicatorStudentsResponse] = await Promise.all([
        // Obtener estudiantes del grado
        axios.get(`/api/teachers/${teacherId}/students/by-grade/${grade}`, {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        // Obtener estudiantes con indicador asignado (si estamos editando)
        isEditing && id ? axios.get(`/api/indicators/${id}/students`, {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }).catch(error => {
          console.error('❌ Error al cargar estudiantes con indicador:', error);
          return { data: { success: false, data: [] } };
        }) : { data: { success: false, data: [] } }
      ]);
      
      // 2. Procesar la lista de estudiantes
      let studentsList = [];
      if (studentsResponse.data && Array.isArray(studentsResponse.data)) {
        studentsList = studentsResponse.data;
      } else if (studentsResponse.data?.data) {
        // Si la respuesta viene en formato { data: [...] }
        studentsList = Array.isArray(studentsResponse.data.data) 
          ? studentsResponse.data.data 
          : [];
      } else {
        console.error('Formato de respuesta inesperado al cargar estudiantes:', studentsResponse);
        studentsList = [];
      }
      
      console.log(`📊 ${studentsList.length} estudiantes encontrados para el grado ${grade}`);
      
      // 3. Procesar estudiantes con indicador asignado
      const assignedStudents = [];
      const assignedStudentIds = new Set();
      
      if (indicatorStudentsResponse.data?.success && Array.isArray(indicatorStudentsResponse.data.data)) {
        indicatorStudentsResponse.data.data.forEach(student => {
          if (student.has_indicator === 1) {
            assignedStudentIds.add(String(student.id));
            assignedStudents.push({
              ...student,
              id: String(student.id),
              hasIndicator: true
            });
          }
        });
        
        console.log('👥 Estudiantes con indicador asignado:', assignedStudents);
      }
      
      // 4. Combinar estudiantes con información de asignación
      const processedStudents = studentsList
        .filter(student => student && (student.id || student.user_id))
        .map(student => {
          const studentId = String(student.id || student.user_id);
          const isAssigned = assignedStudentIds.has(studentId);
          const assignedInfo = assignedStudents.find(s => String(s.id) === studentId) || {};
          
          return {
            id: studentId,
            name: student.name || student.full_name || `Estudiante ${studentId}`,
            grade: student.grade || grade,
            email: student.email || '',
            hasIndicator: isAssigned,
            ...assignedInfo
          };
        });
      
      // 5. Agregar opciones por defecto
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
      
      // 6. Combinar opciones por defecto con estudiantes
      const allStudents = [...defaultOptions, ...processedStudents];
      
      console.log('👥 Estudiantes mapeados:', allStudents);
      
      // 7. Actualizar el estado
      setStudents(allStudents);
      
      // 8. Actualizar los IDs de estudiantes seleccionados si hay asignados
      if (assignedStudents.length > 0) {
        setFormData(prev => ({
          ...prev,
          student_ids: assignedStudents.map(s => s.id)
        }));
      }
      
      return allStudents;
      
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
      
      // Manejar diferentes tipos de errores
      let errorMessage = 'Error al cargar la lista de estudiantes. Por favor, intente nuevamente.';
      
      if (error.response) {
        // El servidor respondió con un código de estado fuera del rango 2xx
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
        // La solicitud fue hecha pero no se recibió respuesta
        errorMessage = 'No se recibió respuesta del servidor. Verifique su conexión.';
      }
      
      // Mostrar el mensaje de error al usuario
      setError(errorMessage);
      
      // Opciones por defecto en caso de error
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
      return defaultOptions;
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
      student_ids: [] // Reiniciar la selección de estudiantes al cambiar el grado
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
        
        // Obtener los IDs de los estudiantes asignados
        const assignedStudentIds = Array.isArray(indicatorData.student_ids) 
          ? indicatorData.student_ids 
          : (indicatorData.student_ids === 'all' ? ['all'] : []);
        
        // Actualizar el estado del formulario con los datos del indicador
        setFormData(prev => ({
          ...prev,
          description: indicatorData.description || '',
          subject: indicatorData.subject || '',
          phase: indicatorData.phase || '',
          grade: indicatorData.grade || '',
          student_ids: assignedStudentIds,
          questionnaire_id: indicatorData.questionnaire_id || null,
          questionnaire_data: indicatorData.questionnaire_data || null
        }));
        
        setManualEntry(!indicatorData.questionnaire_id);
        
        // Si hay un grado, cargar los estudiantes
        if (indicatorData.grade && teacherId) {
          // Esperar a que se carguen los estudiantes antes de marcar los asignados
          await fetchStudents(teacherId, indicatorData.grade).then(() => {
            // Marcar los estudiantes que ya tienen este indicador asignado
            setStudents(prevStudents => 
              prevStudents.map(student => ({
                ...student,
                hasIndicator: assignedStudentIds.includes('all') || 
                            assignedStudentIds.includes(student.id) || 
                            false
              }))
            );
          });
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
        
        // 1. Obtener información del docente actual
        const teacherResponse = await axios.get(`/api/teachers/user/${user.id}`, {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (teacherResponse.data?.id) {
          setTeacherId(teacherResponse.data.id);
          
          // 2. Cargar cuestionarios del docente
          await loadQuestionnaires(user.id, isEditing);
          
          // 3. Si estamos editando, cargar el indicador
          if (isEditing) {
            await fetchIndicator();
          }
          
          // 4. Si ya hay un grado seleccionado, cargar los estudiantes
          if (formData.grade) {
            await fetchStudents(teacherResponse.data.id, formData.grade);
          }
        } else {
          throw new Error('No se pudo obtener la información del docente');
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

  // Inicializar con las opciones por defecto
  useEffect(() => {
    if (students.length === 0 && !error) {
      setStudents([
        { 
          id: 'none', 
          name: 'No aplicar aún',
          grade: formData.grade || ''
        },
        { 
          id: 'all', 
          name: 'Todos los estudiantes del curso',
          grade: formData.grade || ''
        }
      ]);
    }
  }, [students.length, error, formData.grade]);

  // Actualizar estudiantes cuando cambia el grado o el docente
  useEffect(() => {
    if (formData.grade && teacherId) {
      console.log('🔄 Actualizando estudiantes para el grado:', formData.grade);
      console.log('🆔 ID del docente:', teacherId);
      
      // Limpiar la lista de estudiantes actual
      setStudents([
        { 
          id: 'none', 
          name: 'No aplicar aún',
          grade: formData.grade
        },
        { 
          id: 'all', 
          name: 'Todos los estudiantes del curso',
          grade: formData.grade
        }
      ]);
      
      fetchStudents(teacherId, formData.grade).catch(error => {
        console.error('Error al cargar estudiantes:', error);
        setError('No se pudieron cargar los estudiantes. Por favor, intente nuevamente.');
      });
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
    // Manejar opciones especiales: 'none' o 'all'
    if (selectedStudentId === 'none' || selectedStudentId === 'all') {
      setFormData(prev => ({
        ...prev,
        student_ids: selectedStudentId === 'all' ? ['all'] : []
      }));
      return;
    }
    
    // Si es un estudiante individual, agregar o quitar de la selección
    setFormData(prev => {
      const currentIds = [...prev.student_ids];
      const studentIndex = currentIds.indexOf(selectedStudentId);
      
      if (studentIndex === -1) {
        // Agregar el estudiante si no está en la lista
        currentIds.push(selectedStudentId);
      } else {
        // Quitar el estudiante si ya está en la lista
        currentIds.splice(studentIndex, 1);
      }
      
      return {
        ...prev,
        student_ids: currentIds
      };
    });
    
    console.log('✅ Estado actualizado con estudiantes:', formData.student_ids);
  };
  
  // Manejar selección/deselección de todos los estudiantes
  const toggleSelectAllStudents = (selectAll) => {
    if (selectAll) {
      // Seleccionar todos los estudiantes (excluyendo las opciones especiales)
      const allStudentIds = students
        .filter(student => student.id !== 'none' && student.id !== 'all')
        .map(student => student.id);
      
      setFormData(prev => ({
        ...prev,
        student_ids: allStudentIds
      }));
    } else {
      // Deseleccionar todos
      setFormData(prev => ({
        ...prev,
        student_ids: []
      }));
    }
  };

  // Función para cargar estudiantes con su estado de indicador
  const fetchStudentsWithIndicator = useCallback(async () => {
    if (!id || !teacherId) return;
    
    try {
      setStudentsLoading(true);
      setStudentsError(null);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No se encontró el token de autenticación');
      }
      
      console.log(`🔍 Solicitando estudiantes para el indicador ${id} con token:`, token ? 'Token presente' : 'Sin token');
      
      const response = await axios.get(`/api/indicators/${id}/students`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        withCredentials: true
      });

      if (response.data?.success) {
        const studentsData = response.data.data || [];
        console.log('📊 Datos de estudiantes recibidos:', JSON.stringify(studentsData, null, 2));
        
        // Crear un mapa de estudiantes con indicador para búsqueda rápida
        const indicatorMap = new Map();
        const studentsWithIndicator = [];
        
        // Procesar los datos de los estudiantes
        studentsData.forEach(student => {
          if (student.has_indicator === 1) {
            const studentId = String(student.id);
            const studentData = {
              ...student,
              id: studentId,
              hasIndicator: true,
              achieved: student.achieved || false,
              assignedAt: student.assigned_at || null
            };
            
            indicatorMap.set(studentId, studentData);
            studentsWithIndicator.push(studentData);
            
            console.log(`✅ Estudiante ${studentId} - ${student.name} tiene el indicador asignado`);
          }
        });
        
        console.log('👥 Total de estudiantes con indicador:', studentsWithIndicator.length);
        
        // Actualizar el estado de los estudiantes para reflejar los indicadores
        setStudents(prevStudents => 
          prevStudents.map(student => {
            const studentId = String(student.id);
            const hasIndicator = indicatorMap.has(studentId);
            
            // Si el estudiante está en el mapa, combinar sus datos
            if (hasIndicator) {
              const indicatorData = indicatorMap.get(studentId);
              return {
                ...student,
                ...indicatorData,
                hasIndicator: true
              };
            }
            
            // Si no tiene indicador, mantener los datos existentes pero limpiar el estado de indicador
            return {
              ...student,
              hasIndicator: false,
              indicator_id: null,
              achieved: null,
              assigned_at: null
            };
          })
        );
        
        // Actualizar los IDs de estudiantes seleccionados
        if (studentsWithIndicator.length > 0) {
          setFormData(prev => ({
            ...prev,
            student_ids: studentsWithIndicator.map(s => s.id)
          }));
        }
        
        return studentsWithIndicator;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error al cargar estudiantes con indicador:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setStudentsError('No se pudieron cargar los estudiantes con el estado del indicador');
      return [];
    } finally {
      setStudentsLoading(false);
    }
  }, [id, teacherId]);

  // Verificar si un estudiante está seleccionado
  const isStudentSelected = (studentId) => {
    return formData.student_ids.includes(studentId) || formData.student_ids.includes('all');
  };

  // Toggle para cambiar entre vista de tabla y combo
  const toggleViewMode = () => {
    setShowTableView(!showTableView);
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
        setLoading(false);
        throw new Error(`Por favor complete los campos requeridos: ${missingFields.join(', ')}`);
      }

      // Validar que si no es entrada manual, debe tener un cuestionario seleccionado
      if (!manualEntry && !formData.questionnaire_id) {
        setLoading(false);
        throw new Error('Debe seleccionar un cuestionario o habilitar la entrada manual');
      }

      // Identificar estudiantes que tenían el indicador pero fueron desmarcados
      const studentsWithIndicator = students.filter(s => s.hasIndicator);
      const removedStudents = studentsWithIndicator.filter(
        student => !formData.student_ids.includes(student.id)
      );
      
      // Mostrar confirmación para eliminar relaciones
      if (removedStudents.length > 0) {
        const studentNames = removedStudents.map(s => s.name).join('\n• ');
        const confirmMessage = `¿Está seguro que desea eliminar este indicador de los siguientes estudiantes?\n\n• ${studentNames}\n\nEsta acción no se puede deshacer.`;
        
        if (!window.confirm(confirmMessage)) {
          console.log('❌ Usuario canceló la eliminación de estudiantes');
          setLoading(false);
          return;
        }
        
        console.log(`🔄 Procesando eliminación de ${removedStudents.length} estudiantes...`);
        
        // Eliminar las relaciones de los estudiantes desmarcados
        const removalResults = await Promise.allSettled(
          removedStudents.map(student => handleRemoveIndicator(student))
        );
        
        // Verificar si hubo errores en la eliminación
        const failedRemovals = removalResults
          .map((result, index) => ({
            student: removedStudents[index],
            result
          }))
          .filter(({ result }) => result.status === 'rejected' || result.value === false);
        
        if (failedRemovals.length > 0) {
          console.error('❌ Errores al eliminar indicadores:', failedRemovals);
          const errorMessage = `No se pudieron eliminar los indicadores de ${failedRemovals.length} estudiante(s). Por favor, intente nuevamente.`;
          setError(errorMessage);
          throw new Error(errorMessage);
        }
        
        console.log('✅ Eliminación de estudiantes completada correctamente');
      }

      // Preparar datos para enviar
      const dataToSend = { 
        description: formData.description,
        subject: formData.subject,
        phase: formData.phase,
        grade: formData.grade,
        achieved: formData.achieved,
        teacher_id: teacherId,
        questionnaire_id: manualEntry ? null : formData.questionnaire_id
      };
      
      // Incluir student_ids solo si hay estudiantes seleccionados
      // Si no se selecciona ningún estudiante, se eliminarán todas las asociaciones
      dataToSend.student_ids = formData.student_ids.includes('all') 
        ? 'all' 
        : formData.student_ids.filter(id => id !== 'none');

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
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Asegurarse de que no lance error en 401/403
      }
    });

    console.log('✅ Respuesta del servidor:', response.data);

    if (response.data.success) {
      console.log('🎉 Indicador guardado exitosamente');
      
      // Verificar si hay un nuevo token en la respuesta
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        console.log('🔑 Token actualizado');
        // Actualizar el token en Axios para las siguientes peticiones
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      
      // Mostrar mensaje de éxito y redirigir
      alert(isEditing ? 'Indicador actualizado correctamente' : 'Indicador creado correctamente');
      navigate('/indicadores');
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
    
    // Manejar error de autenticación expirada
    if (error.response?.status === 401 || error.response?.data?.requiresLogin) {
      // Verificar si el error es específicamente por token expirado
      const isTokenExpired = error.response?.data?.message?.includes('expirado') || 
                           error.response?.data?.error?.includes('expirado');
      
      if (isTokenExpired) {
        // Limpiar token expirado
        localStorage.removeItem('authToken');
        // Limpiar encabezado de autorización de Axios
        delete axios.defaults.headers.common['Authorization'];
        // Redirigir a login con mensaje
        navigate('/login', { 
          state: { 
            message: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
            from: window.location.pathname 
          } 
        });
        return;
      }
    }
    
    // Manejar otros errores sin redirigir
    const errorMessage = error.response?.data?.message || 
                       error.message || 
                       'Error al guardar el indicador. Por favor, intente nuevamente.';
    
    setError(errorMessage);
    
    // Mostrar mensaje de error al usuario
    alert(errorMessage);
    
    // Desplazarse al principio del formulario para mostrar el error
    window.scrollTo(0, 0);
  } finally {
    setLoading(false);
  }
};

const renderStudentSelectionInfo = () => {
  return (
    <div>
      <span className="block mt-1 text-blue-600">
        {students
          .filter(s => formData.student_ids.includes(s.id))
          .map(s => s.name)
          .join(', ')}
      </span>
      <p className="text-sm text-gray-500 mt-1">
        {formData.student_ids.includes('all')
          ? 'El indicador se aplicará a todos los estudiantes del grado.'
          : formData.student_ids.length > 0
            ? `Se aplicará a ${formData.student_ids.length} estudiante(s) seleccionado(s).`
            : 'No se aplicará a ningún estudiante por ahora.'}
      </p>
    </div>
  );
}

  // Función para manejar el cambio de estado de un estudiante
  const handleStudentToggle = async (student, isChecked) => {
    console.log(`🔄 Cambiando estado de ${student.name} a ${isChecked ? 'marcado' : 'desmarcado'}`);
    
    // Si se está desmarcando un estudiante que ya tenía el indicador, pedir confirmación
    if (!isChecked && student.hasIndicator) {
      const confirmMessage = `¿Está seguro que desea eliminar este indicador del estudiante ${student.name}?\n\nEsta acción solo eliminará la relación, no el indicador en sí.`;
      
      if (!window.confirm(confirmMessage)) {
        console.log('❌ Usuario canceló la eliminación del estudiante');
        return; // No hacer ningún cambio si el usuario cancela
      }
      
      console.log(`🔄 Iniciando eliminación de la relación para ${student.name}...`);
      
      try {
        const success = await handleRemoveIndicator(student);
        
        if (!success) {
          // Si hay un error al eliminar, mantener el estado actual
          setStudents(prev => 
            prev.map(s => 
              s.id === student.id 
                ? { ...s, hasIndicator: true } 
                : s
            )
          );
          
          // Mostrar mensaje de error
          setError(`No se pudo eliminar el indicador de ${student.name}. Intente nuevamente.`);
          setTimeout(() => setError(''), 5000);
        }
      } catch (error) {
        console.error('❌ Error al eliminar la relación:', error);
        
        // Revertir el cambio en la UI en caso de error
        setStudents(prev => 
          prev.map(s => 
            s.id === student.id 
              ? { ...s, hasIndicator: true } 
              : s
          )
        );
        
        // Mostrar mensaje de error
        setError(`Error al eliminar el indicador: ${error.message}`);
        setTimeout(() => setError(''), 5000);
      }
    } else if (isChecked) {
      console.log(`✅ Marcando estudiante ${student.name} como seleccionado`);
      
      // Si se está marcando, actualizamos el estado local primero
      setStudents(prev => 
        prev.map(s => 
          s.id === student.id 
            ? { ...s, hasIndicator: true } 
            : s
        )
      );
      
      // Luego actualizamos el estado del formulario
      setFormData(prev => {
        const newStudentIds = [
          ...prev.student_ids.filter(id => id !== 'none' && id !== 'all'),
          student.id
        ];
        
        console.log('📝 Actualizando lista de estudiantes seleccionados:', newStudentIds);
        
        return {
          ...prev,
          student_ids: newStudentIds
        };
      });
    }
  };

  // Función para manejar la eliminación de un indicador
  const handleRemoveIndicator = async (student) => {
    if (!id || !student?.id) {
      console.error('❌ ID de indicador o estudiante no válido:', { indicatorId: id, studentId: student?.id });
      setError('No se pudo identificar el indicador o el estudiante');
      return false;
    }

    try {
      console.log(`🔄 [1/4] Iniciando eliminación de relación - Indicador: ${id}, Estudiante: ${student.name} (${student.id})`);
      setIsUpdating(true);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('❌ No se encontró token de autenticación');
        setError('Error de autenticación. Por favor, inicie sesión nuevamente.');
        return false;
      }
      
      console.log(`🔄 [2/4] Enviando petición DELETE a /api/indicators/${id}/students/${student.id}`);
      
      // Llamar a la API para eliminar la relación
      const response = await axios.delete(`/api/indicators/${id}/students/${student.id}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        validateStatus: (status) => status < 500 // Aceptar códigos de estado menores a 500 como exitosos
      });
      
      console.log('✅ [3/4] Respuesta del servidor al eliminar:', {
        status: response.status,
        data: response.data,
        success: response.data?.success,
        message: response.data?.message
      });
      
      if (response.data.success) {
        console.log(`✅ [4/4] Indicador eliminado correctamente de ${student.name}`);
        
        // Actualizar el estado local del estudiante
        setStudents(prev => {
          const updated = prev.map(s => 
            s.id === student.id 
              ? { 
                  ...s, 
                  hasIndicator: false,
                  has_indicator: 0,
                  indicator_id: null,
                  assigned_at: null
                } 
              : s
          );
          console.log('🔄 Estado de estudiantes actualizado localmente');
          return updated;
        });
        
        // Actualizar el estado del formulario
        setFormData(prev => {
          const updatedStudentIds = prev.student_ids.filter(id => id !== student.id && id !== 'all');
          console.log('🔄 IDs de estudiantes actualizados en el formulario:', updatedStudentIds);
          return {
            ...prev,
            student_ids: updatedStudentIds
          };
        });
        
        // Mostrar mensaje de éxito
        setSuccess(`Indicador eliminado correctamente de ${student.name}`);
        setTimeout(() => setSuccess(''), 3000);
        
        // Forzar recarga de la lista de estudiantes para sincronizar con la base de datos
        console.log('🔄 Recargando lista de estudiantes...');
        await fetchStudentsWithIndicator();
        
        return true;
      } else {
        const errorMsg = response.data?.message || 'Error al eliminar la asignación';
        console.error('❌ Error en la respuesta del servidor:', {
          status: response.status,
          message: errorMsg,
          data: response.data
        });
        
        // Mostrar mensaje de error al usuario
        setError(`Error: ${errorMsg}`);
        setTimeout(() => setError(''), 5000);
        
        return false;
      }
    } catch (error) {
      console.error('Error al eliminar la asignación:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Mostrar mensaje de error al usuario
      setError(`Error al eliminar el indicador: ${error.message}`);
      setTimeout(() => setError(''), 5000);
      
      // Revertir cambios en caso de error
      await fetchStudentsWithIndicator();
      
      throw error; // Relanzar el error para manejarlo en el componente padre
    } finally {
      setIsUpdating(false);
    }
  }

// JSX para mostrar la selección actual de estudiantes
const renderStudentSelection = () => {
  // Filtrar solo estudiantes reales (excluyendo opciones especiales)
  const realStudents = students.filter(s => s.id !== 'all' && s.id !== 'none');
  
  return (
    <div className="mb-4">
      {/* Mostrar mensajes de éxito o error */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
          {success}
        </div>
      )}
      
      <div className="flex flex-col space-y-4">
        {/* Opción para aplicar a todos */}
        <div className="flex items-center">
          <input
            type="radio"
            id="apply-all"
            name="apply-to"
            checked={formData.student_ids.includes('all')}
            onChange={() => {
              // Verificar si hay estudiantes con indicador asignado
              if (isEditing && realStudents.some(s => s.hasIndicator)) {
                alert('No puede seleccionar "Todos" porque ya hay estudiantes con este indicador asignado.');
                return;
              }
              setFormData(prev => ({ ...prev, student_ids: ['all'] }));
            }}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            disabled={isEditing && realStudents.some(s => s.hasIndicator)}
          />
          <label 
            htmlFor="apply-all" 
            className={`ml-2 block text-sm ${isEditing && realStudents.some(s => s.hasIndicator) ? 'text-gray-400' : 'text-gray-700'}`}
          >
            Aplicar a todos los estudiantes del grado
            {isEditing && realStudents.some(s => s.hasIndicator) && (
              <span className="ml-2 text-xs text-yellow-600">(No disponible: ya hay estudiantes con indicador asignado)</span>
            )}
          </label>
        </div>
        
        {/* Opción para seleccionar estudiantes específicos */}
        <div className="flex items-center">
          <input
            type="radio"
            id="apply-specific"
            name="apply-to"
            checked={!formData.student_ids.includes('all') && formData.student_ids.length > 0}
            onChange={() => setFormData(prev => ({ ...prev, student_ids: [] }))}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
          />
          <label htmlFor="apply-specific" className="ml-2 block text-sm text-gray-700">
            Seleccionar estudiantes específicos
          </label>
        </div>
        
        {/* Mostrar estado de carga o error */}
        {studentsLoading ? (
          <div className="p-4 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-sm text-gray-600">Cargando estudiantes...</p>
          </div>
        ) : studentsError ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm">
            {studentsError}
            <button
              onClick={fetchStudentsWithIndicator}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              Reintentar
            </button>
          </div>
        ) : (
          /* Lista de estudiantes (solo si no se seleccionó 'todos') */
          !formData.student_ids.includes('all') && realStudents.length > 0 && (
            <div className="mt-2 ml-6 space-y-2 max-h-60 overflow-y-auto p-2 border rounded">
              {realStudents.map(student => {
                const hasIndicator = student.hasIndicator === true || student.has_indicator === 1;
                const isSelected = formData.student_ids.includes(student.id);
                const assignmentDate = student.assignedAt || student.assigned_at || student.indicator_created_at || new Date().toISOString();
                const formattedDate = assignmentDate ? new Date(assignmentDate).toLocaleDateString('es-ES') : '';
                
                // Debug: Mostrar información del estudiante en consola
                console.log('👤 Estudiante:', {
                  id: student.id,
                  name: student.name,
                  hasIndicator,
                  has_indicator: student.has_indicator,
                  indicator_id: student.indicator_id,
                  current_indicator_id: id,
                  assigned_at: student.assigned_at,
                  isSelected,
                  student_ids: formData.student_ids
                });
                
                return (
                  <div 
                    key={student.id} 
                    className={`flex items-center p-3 transition-colors ${
                      student.hasIndicator 
                        ? 'bg-green-50 border-l-4 border-l-green-500' 
                        : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center w-full">
                      <div className="relative flex items-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={student.hasIndicator}
                            onChange={(e) => handleStudentToggle(student, e.target.checked)}
                            className={`w-4 h-4 rounded border ${
                              student.hasIndicator 
                                ? 'bg-green-100 border-green-600 text-green-600 focus:ring-green-200' 
                                : 'border-gray-300 hover:border-blue-500 bg-white hover:bg-gray-50 focus:ring-blue-200'
                            } cursor-pointer transition-colors focus:ring-2 focus:ring-offset-1`}
                            disabled={isUpdating}
                            title={student.hasIndicator ? 'Quitar indicador' : 'Asignar indicador'}
                          />
                        </label>
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-800">
                            {student.name}
                            {student.hasIndicator && (
                              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                Asignado
                              </span>
                            )}
                          </span>
                          {student.hasIndicator && student.assigned_at && (
                            <span className="text-xs text-gray-500">
                              {new Date(student.assigned_at).toLocaleDateString('es-ES')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
};

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }
  
  return (
    <div className="container mt-4">
      <h2 className="mb-4">{isEditing ? 'Editar' : 'Crear Nuevo'} Indicador</h2>
      
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

        {/* Selección de estudiantes */}
        <div className="mb-4 p-4 border rounded-lg bg-white">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Aplicar indicador a estudiantes</h3>
          
          {!formData.grade ? (
            <div className="p-4 text-center text-gray-500 bg-gray-50 rounded">
              Seleccione un grado para ver los estudiantes disponibles
            </div>
          ) : loading ? (
            <div className="p-4 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-sm text-gray-600">Cargando estudiantes...</p>
            </div>
          ) : students.length <= 2 ? (
            <div className="p-4 text-center text-gray-500 bg-yellow-50 rounded">
              No hay estudiantes disponibles para el grado {formData.grade}°
            </div>
          ) : (
            renderStudentSelection()
          )}
          
          {error && (
            <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-md text-sm">
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
