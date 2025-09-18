// src/pages/indicators/IndicatorForm.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

// Configuración de la API base
const API_BASE_URL = 'http://localhost:5000';
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Interceptor para agregar el token a las peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const IndicatorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;
  
  // Estado inicial del formulario
  const [formData, setFormData] = useState({
    description: '',
    subject: '',
    phase: '1',
    grade: '',
    questionnaire_id: '',
    students: [],
    student_ids: [],  // Usando array para múltiples estudiantes
    teacher_id: ''
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
  const [selectedStudents, setSelectedStudents] = useState([]);
 
  // Función auxiliar para cargar cuestionarios
  const loadQuestionnaires = useCallback(async (userId, editing = false) => {
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
      
      console.log('📋 Respuesta de la API de cuestionarios:', response.data);
      
      if (response.data?.success) {
        const questionnairesData = response.data.data || [];
        console.log(`📊 Se encontraron ${questionnairesData.length} cuestionarios`);
        
        setQuestionnaires(questionnairesData);
        
        if (!editing && questionnairesData.length > 0) {
          setManualEntry(false);
          
          if (questionnairesData.length === 1) {
            const firstQuestionnaire = questionnairesData[0];
            console.log('📝 Configurando primer cuestionario:', firstQuestionnaire);
            
            setFormData(prev => ({
              ...prev,
              questionnaire_id: firstQuestionnaire.id,
              description: firstQuestionnaire.description || firstQuestionnaire.title || '',
              // Usar valores por defecto para subject, phase y grade ya que estos campos ya no vienen del cuestionario
              subject: teacherSubject || '',
              phase: '',
              grade: '',
              questionnaire_data: {
                created_by: firstQuestionnaire.created_by || '',
                teacher_name: firstQuestionnaire.created_by_name || '',
                course_id: firstQuestionnaire.course_id || '',
                course_name: firstQuestionnaire.course_name || '',
                created_at: firstQuestionnaire.created_at || ''
              }
            }));
          }
        }
        
        return questionnairesData;
      }
      
      throw new Error(response.data?.message || 'No se pudieron cargar los cuestionarios');
      
    } catch (error) {
      console.error('❌ Error al cargar cuestionarios:', error);
      setError(error.message || 'No se pudieron cargar los cuestionarios. Por favor, intente nuevamente.');
      setManualEntry(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, [teacherSubject]);

  // Cargar cuestionarios del docente
  const fetchQuestionnaires = useCallback(() => {
    return loadQuestionnaires(user?.id, isEditing);
  }, [user?.id, isEditing, loadQuestionnaires]);

  // Cargar información del docente
  useEffect(() => {
    const loadTeacherInfo = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          console.error('No se encontró el token de autenticación');
          return;
        }

        const response = await axios.get(`/api/teachers/by-user/${user.id}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        });
            
        console.log('✅ Información del docente:', response.data);
            
        // Ajustar según el formato de respuesta del servidor
        const teacherData = response.data.success ? response.data.data : response.data;
            
        if (teacherData) {
          const teacherId = teacherData.id || teacherData.teacher_id;
          const subject = teacherData.subject || '';
              
          if (teacherId) {
            setTeacherId(teacherId);
            setTeacherSubject(subject);
                
            // Actualizar el formulario con la materia del docente si existe
            if (subject) {
              setFormData(prev => ({
                ...prev,
                subject: subject
              }));
            }
          }
        }
      } catch (error) {
        console.error('❌ Error al cargar información del docente:', {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
      }
    };
    
    if (user?.id) {
      loadTeacherInfo();
    }
  }, [user?.id]);

  // Función para cargar estudiantes por grado
  const fetchStudents = useCallback(async (teacherId, grade) => {
    if (!grade) {
      const errorMsg = '⚠️ [fetchStudents] No se ha especificado un grado para cargar estudiantes';
      console.warn(errorMsg);
      setError(errorMsg);
      return [];
    }
    
    if (!teacherId) {
      const errorMsg = '❌ [fetchStudents] No se proporcionó un ID de docente válido';
      console.error(errorMsg);
      setError(errorMsg);
      return [];
    }
    
    console.log('🔍 ===== INICIO DE CARGA DE ESTUDIANTES =====');
    console.log(`🔍 [fetchStudents] Docente ID: ${teacherId}, Grado: ${grade}`);
    console.log(`🔍 [fetchStudents] URL: /api/teachers/${teacherId}/students/by-grade/${grade}`);
    
    const token = localStorage.getItem('authToken');
    if (!token) {
      const errorMsg = '❌ [fetchStudents] No se encontró el token de autenticación';
      console.error(errorMsg);
      setError('Error de autenticación. Por favor, inicie sesión nuevamente.');
      return [];
    }
    
    console.log('🔍 [fetchStudents] Token encontrado (primeros 20 caracteres):', token.substring(0, 20) + '...');
    
    const requestHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    console.log('🔍 [fetchStudents] Headers de la petición:', JSON.stringify(requestHeaders, null, 2));
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 [fetchStudents] Iniciando petición de estudiantes...');
      
      // 1. Obtener los estudiantes del docente para el grado especificado
      const [studentsResponse, indicatorStudentsResponse] = await Promise.all([
        // Obtener estudiantes del grado
        axios.get(`/api/teachers/${teacherId}/students/by-grade/${grade}`, {
          headers: requestHeaders,
          timeout: 10000 // 10 segundos de timeout
        })
        .then(response => {
          console.log('✅ [fetchStudents] Respuesta de estudiantes recibida:', {
            status: response.status,
            statusText: response.statusText,
            dataCount: Array.isArray(response.data) ? response.data.length : 'No es un array'
          });
          return response;
        })
        .catch(error => {
          console.error('❌ [fetchStudents] Error en la petición de estudiantes:', {
            message: error.message,
            response: {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data
            },
            config: {
              url: error.config?.url,
              method: error.config?.method,
              headers: error.config?.headers
            }
          });
          throw error; // Relanzar para manejarlo en el catch externo
        }),
        
        // Obtener estudiantes con indicador asignado (si estamos editando)
        isEditing && id ? 
          axios.get(`/api/indicators/${id}/students`, {
            headers: requestHeaders,
            timeout: 10000 // 10 segundos de timeout
          })
          .catch(error => {
            console.warn('⚠️ [fetchStudents] No se pudieron cargar los estudiantes con indicador:', error.message);
            return { data: { success: false, data: [] } };
          })
          : 
          Promise.resolve({ data: { success: false, data: [] } })
      ]);
      
      // 2. Procesar la lista de estudiantes
      console.log('📦 [fetchStudents] Procesando respuesta de la API...');
      
      let studentsList = [];
      
      // Verificar si la respuesta es exitosa
      if (!studentsResponse) {
        console.error('❌ [fetchStudents] La respuesta de la API es undefined');
        throw new Error('No se recibió respuesta del servidor');
      }
      
      // Verificar si hay un error en la respuesta
      if (studentsResponse.status !== 200) {
        console.error('❌ [fetchStudents] Error en la respuesta de la API:', {
          status: studentsResponse.status,
          statusText: studentsResponse.statusText,
          data: studentsResponse.data
        });
        throw new Error(studentsResponse.data?.message || 'Error al cargar los estudiantes');
      }
      
      // Procesar los datos de la respuesta
      console.log('📥 [fetchStudents] Respuesta recibida:', {
        status: studentsResponse.status,
        data: studentsResponse.data
      });
      
      // Verificar si la respuesta tiene la estructura esperada
      if (studentsResponse.data && studentsResponse.data.success === true) {
        // Verificar si los datos están en data.data o directamente en data
        if (Array.isArray(studentsResponse.data.data)) {
          console.log('📥 [fetchStudents] Formato 1: Respuesta con éxito y datos en data.data');
          studentsList = studentsResponse.data.data;
        } else if (Array.isArray(studentsResponse.data)) {
          console.log('📥 [fetchStudents] Formato 2: Respuesta directa como array');
          studentsList = studentsResponse.data;
        }
      } else if (Array.isArray(studentsResponse.data)) {
        console.log('📥 [fetchStudents] Formato 3: Respuesta directa como array (sin success)');
        studentsList = studentsResponse.data;
      } else if (studentsResponse.data?.data && Array.isArray(studentsResponse.data.data)) {
        console.log('📥 [fetchStudents] Formato 4: Respuesta con propiedad data');
        studentsList = studentsResponse.data.data;
      } else {
        console.log('📥 [fetchStudents] Formato 5: Formato de respuesta no reconocido, intentando extraer datos');
        // Intentar extraer los datos aunque el formato no sea el esperado
        if (studentsResponse.data && typeof studentsResponse.data === 'object') {
          // Buscar cualquier propiedad que sea un array
          const arrayProps = Object.entries(studentsResponse.data)
            .filter(([_, value]) => Array.isArray(value))
            .map(([key]) => key);
          
          if (arrayProps.length > 0) {
            console.log(`📥 [fetchStudents] Se encontraron arrays en las propiedades: ${arrayProps.join(', ')}`);
            // Usar el primer array que encontremos
            studentsList = studentsResponse.data[arrayProps[0]];
          }
        }
      }
      
      console.log(`📊 [fetchStudents] ${studentsList.length} estudiantes recibidos para el grado ${grade}`);
      if (studentsList.length > 0) {
        console.log('📋 [fetchStudents] Muestra de estudiantes (primeros 3):', 
          studentsList.slice(0, 3).map(s => `${s.name || 'Sin nombre'} (ID: ${s.id})`)
        );
      }
      
      // 3. Procesar estudiantes con indicador asignado
      const assignedStudents = [];
      const assignedStudentIds = new Set();
      
      if (indicatorStudentsResponse.data?.success && Array.isArray(indicatorStudentsResponse.data.data)) {
        indicatorStudentsResponse.data.data.forEach(student => {
          if (student.has_indicator === 1) {
            const studentId = String(student.id);
            assignedStudentIds.add(studentId);
            assignedStudents.push({
              ...student,
              id: studentId,
              hasIndicator: true,
              name: student.name || student.full_name || `Estudiante ${studentId}`,
              grade: student.grade || grade
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
      
      console.log('📝 Estudiantes procesados:', processedStudents);
      
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
      
      console.log('👥 Todos los estudiantes mapeados:', allStudents);
      
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
      console.log(`🔄 [handleGradeChange] Cargando estudiantes para docente ${teacherId}, grado ${selectedGrade}`);
      setLoading(true);
      
      fetchStudents(teacherId, selectedGrade)
        .then(students => {
          console.log('✅ [handleGradeChange] Estudiantes cargados correctamente:', students);
          
          // Verificar si hay estudiantes
          if (!students || students.length === 0) {
            console.warn('⚠️ No se encontraron estudiantes para este grado');
            setError('No se encontraron estudiantes para el grado seleccionado.');
          } else {
            // Actualizar el estado de los estudiantes
            setStudents(students);
            
            // Si solo hay un estudiante, seleccionarlo automáticamente
            if (students.length === 1 && students[0].id !== 'all' && students[0].id !== 'none') {
              setFormData(prev => ({
                ...prev,
                student_ids: [students[0].id]
              }));
            }
          }
        })
        .catch(error => {
          console.error('❌ [handleGradeChange] Error al cargar estudiantes:', error);
          setError('No se pudieron cargar los estudiantes. Por favor, intente nuevamente.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      console.log('⚠️ [handleGradeChange] No se pudo cargar estudiantes - Falta teacherId o grado');
      if (!teacherId) console.error('❌ Falta teacherId');
      if (!selectedGrade) console.error('❌ Falta grado seleccionado');
    }
  };

  // Cargar datos del indicador
  const fetchIndicator = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      console.log(`🔍 [fetchIndicator] Cargando datos del indicador ID: ${id}`);
      
      // Obtener el token de autenticación
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No se encontró el token de autenticación');
      }
      
      // 1. Obtener los datos del indicador
      const [indicatorResponse, studentsResponse] = await Promise.all([
        axios.get(`/api/indicators/${id}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          withCredentials: true
        }),
        // Obtener estudiantes asociados al indicador
        axios.get(`/api/indicators/${id}/students`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          withCredentials: true
        }).catch(error => {
          console.error('❌ [fetchIndicator] Error al cargar estudiantes del indicador:', error);
          return { data: { success: false, data: [] } };
        })
      ]);
      
      console.log('📦 [fetchIndicator] Respuesta del servidor para el indicador:', indicatorResponse.data);
      
      if (indicatorResponse.data.success) {
        const indicatorData = indicatorResponse.data.data;
        console.log('📋 Datos del indicador procesados:', indicatorData);
        
        // Procesar estudiantes asignados
        const assignedStudents = studentsResponse.data.success ? 
          (Array.isArray(studentsResponse.data.data) ? studentsResponse.data.data : []) : [];
        
        const assignedStudentIds = assignedStudents.length > 0 ? 
          assignedStudents.map(s => String(s.id || s.student_id)) : 
          (indicatorData.student_ids === 'all' ? ['all'] : []);
        
        console.log('👥 Estudiantes asignados al indicador:', assignedStudents);
        console.log('🆔 IDs de estudiantes asignados:', assignedStudentIds);
        
        // Actualizar el estado del formulario con los datos del indicador
        const formDataUpdate = {
          description: indicatorData.description || '',
          subject: indicatorData.subject || '',
          phase: indicatorData.phase?.toString() || '1',
          grade: indicatorData.grade?.toString() || '',
          student_ids: assignedStudentIds,
          questionnaire_id: indicatorData.questionnaire_id || '',
          students: assignedStudents
        };
        
        setFormData(formDataUpdate);
        console.log('📝 Formulario actualizado:', formDataUpdate);
        
        // Actualizar el estado del docente
        if (indicatorData.teacher_id) {
          setTeacherId(indicatorData.teacher_id);
          console.log('👨‍🏫 ID del docente actualizado:', indicatorData.teacher_id);
          
          // Si hay un grado, cargar los estudiantes
          if (indicatorData.grade) {
            console.log(`🔄 Cargando estudiantes para el grado ${indicatorData.grade}...`);
            
            // Cargar estudiantes del grado
            await fetchStudents(indicatorData.teacher_id, indicatorData.grade)
              .then(() => {
                console.log('✅ Estudiantes cargados correctamente');
                
                // Marcar los estudiantes que ya tienen el indicador asignado
                if (assignedStudentIds.length > 0) {
                  console.log('🏷️ Marcando estudiantes con indicador asignado...');
                  setStudents(prevStudents => 
                    prevStudents.map(student => ({
                      ...student,
                      hasIndicator: assignedStudentIds.includes('all') || 
                                  assignedStudentIds.includes(String(student.id)) || 
                                  false
                    }))
                  );
                  
                  // Si hay estudiantes asignados, actualizar el estado del formulario
                  if (assignedStudentIds[0] !== 'all') {
                    setFormData(prev => ({
                      ...prev,
                      student_ids: assignedStudentIds
                    }));
                  }
                }
              })
              .catch(error => {
                console.error('❌ Error al cargar estudiantes:', error);
                setError('No se pudieron cargar los estudiantes. Por favor, intente nuevamente.');
              });
          }
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
      
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('No se encontró el token de autenticación');
        return;
      }

      const response = await axios.get(`/api/teachers/by-user/${user.id}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
        
      console.log('✅ Información del docente:', response.data);
        
      // Ajustar según el formato de respuesta del servidor
      const teacherData = response.data.success ? response.data.data : response.data;
        
      if (teacherData) {
        const teacherId = teacherData.id || teacherData.teacher_id;
        const subject = teacherData.subject || '';
          
        if (teacherId) {
          setTeacherId(teacherId);
          setTeacherSubject(subject);
            
          // Actualizar el formulario con la materia del docente si existe
          if (subject) {
            setFormData(prev => ({
              ...prev,
              subject: subject
            }));
          }
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar información del docente:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    }
  };
    
  loadTeacherInfo();
}, [user?.id]);

  // Efecto para cargar estudiantes cuando cambia el grado
  useEffect(() => {
    if (formData.grade && teacherId) {
      console.log(`🔄 [useEffect] Grado cambiado a ${formData.grade}, cargando estudiantes...`);
      handleGradeChange({ target: { value: formData.grade } });
    }
  }, [formData.grade, teacherId]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user?.id) return;
      
      console.log('🔄 [loadInitialData] Iniciando carga de datos iniciales...');
      
      // Cargar cuestionarios
      try {
        await loadQuestionnaires(user.id, isEditing);
      } catch (error) {
        console.error('❌ [loadInitialData] Error al cargar cuestionarios:', error);
        setError('No se pudieron cargar los cuestionarios. Por favor, intente nuevamente.');
      }
      
      // Si estamos editando, cargar los datos del indicador
      if (id) {
        try {
          setLoading(true);
          const token = localStorage.getItem('authToken');
          
          // Obtener los datos del indicador
          const indicatorResponse = await axios.get(`/api/indicators/${id}`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            withCredentials: true
          });
          
          console.log('📝 Respuesta del servidor para el indicador:', indicatorResponse.data);
          
          let indicatorData = indicatorResponse.data.success ? 
            indicatorResponse.data.data : 
            indicatorResponse.data;
            
          // Si es un array, tomar el primer elemento
          if (Array.isArray(indicatorData)) {
            indicatorData = indicatorData[0];
          }
          
          console.log('📋 Datos del indicador procesados:', indicatorData);
          
          if (indicatorData) {
            // Actualizar el estado del formulario con los datos del indicador
            const formDataUpdate = {
              description: indicatorData.description || '',
              subject: indicatorData.subject || '',
              phase: indicatorData.phase?.toString() || '1',
              grade: indicatorData.grade?.toString() || '',
              questionnaire_id: indicatorData.questionnaire_id || '',
              students: indicatorData.students || []
            };
            
            setFormData(formDataUpdate);
            console.log('📝 Formulario actualizado:', formDataUpdate);
            
            // Actualizar el estado del docente si está disponible
            if (indicatorData.teacher_id) {
              setTeacherId(indicatorData.teacher_id);
              console.log('👨‍🏫 ID del docente actualizado:', indicatorData.teacher_id);
            }
            
            // Si hay estudiantes asociados, cargarlos
            if (indicatorData.students && indicatorData.students.length > 0) {
              // Usar un Set para eliminar duplicados basados en el ID del estudiante
              const uniqueStudents = [];
              const seen = new Set();
              
              for (const student of indicatorData.students) {
                const studentId = student.id || student.student_id;
                if (!seen.has(studentId)) {
                  seen.add(studentId);
                  uniqueStudents.push({
                    value: studentId,
                    label: student.name || student.student_name
                  });
                }
              }
              
              setSelectedStudents(uniqueStudents);
              console.log('👥 Estudiantes cargados (sin duplicados):', uniqueStudents);
            } else {
              // Si no hay estudiantes en la respuesta, intentar cargarlos por separado
              try {
                const studentsResponse = await axios.get(`/api/indicators/${id}/students`, {
                  headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  withCredentials: true
                });
                
                if (studentsResponse.data?.data?.length > 0) {
                  // Eliminar duplicados también cuando se cargan desde el endpoint separado
                  const uniqueStudents = [];
                  const seen = new Set();
                  
                  for (const student of studentsResponse.data.data) {
                    const studentId = student.id || student.student_id;
                    if (!seen.has(studentId)) {
                      seen.add(studentId);
                      uniqueStudents.push({
                        value: studentId,
                        label: student.name || student.student_name
                      });
                    }
                  }
                  
                  setSelectedStudents(uniqueStudents);
                  console.log('👥 Estudiantes cargados desde endpoint separado (sin duplicados):', uniqueStudents);
                }
              } catch (studentsError) {
                console.warn('⚠️ No se pudieron cargar los estudiantes:', studentsError.message);
              }
            }
          }
        } catch (error) {
          console.error('❌ Error al cargar los datos del indicador:', {
            error: error.message,
            response: error.response?.data,
            status: error.response?.status,
            url: error.config?.url
          });
          
          setError(`No se pudieron cargar los datos del indicador: ${error.response?.data?.message || error.message}`);
        } finally {
          setLoading(false);
        }
      }
      
      try {
        setLoading(true);
        
        // 1. Obtener información del docente actual
        const token = localStorage.getItem('authToken');
        const teacherResponse = await axios.get(`/api/teachers/by-user/${user.id}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        });
        
        if (teacherResponse.data?.success) {
          const teacherData = teacherResponse.data.data || teacherResponse.data;
          if (teacherData?.id) {
            setTeacherId(teacherData.id);
            
            // Cargar estudiantes si hay un grado seleccionado
            if (formData.grade) {
              await fetchStudents(teacherData.id, formData.grade);
            }
          }
        }
      } catch (error) {
        console.error('Error al cargar información del docente:', error);
        setError('No se pudo cargar la información del docente. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [user?.id, id, isEditing, formData.grade, loadQuestionnaires, fetchStudents]);

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
  
  // Obtener la lista de estudiantes reales (excluyendo opciones especiales)
  const realStudents = React.useMemo(() => {
    // Filtrar estudiantes válidos (excluyendo 'all' y 'none' y entradas nulas)
    const validStudents = students.filter(s => 
      s && s.id && s.id !== 'all' && s.id !== 'none' && s.id !== 'null' && s.id !== 'undefined'
    );
    
    // Ordenar estudiantes por nombre
    return [...validStudents].sort((a, b) => {
      const nameA = a.name?.toLowerCase() || '';
      const nameB = b.name?.toLowerCase() || '';
      return nameA.localeCompare(nameB);
    });
  }, [students]);

  // Actualizar los estudiantes seleccionados cuando cambia la lista de estudiantes
  useEffect(() => {
    if (isEditing && realStudents.length > 0) {
      const studentsWithIndicator = realStudents.filter(s => s.hasIndicator);
      if (studentsWithIndicator.length > 0) {
        setFormData(prev => ({
          ...prev,
          student_ids: studentsWithIndicator.map(s => s.id)
        }));
      }
    }
  }, [realStudents, isEditing]);

  // Manejar selección/deselección de todos los estudiantes
  const toggleSelectAllStudents = (selectAll) => {
    if (selectAll) {
      // Seleccionar todos los estudiantes (excluyendo las opciones especiales)
      const allStudentIds = realStudents
        .filter(student => !['none', 'all'].includes(String(student.id)))
        .map(student => student.id);
      
      // Eliminar duplicados
      const uniqueStudentIds = [...new Set(allStudentIds)];
      
      setFormData(prev => {
        // Asegurarse de que student_ids sea un array
        const currentStudentIds = Array.isArray(prev.student_ids) ? prev.student_ids : [];
        
        return {
          ...prev,
          student_ids: [...new Set([...currentStudentIds, ...uniqueStudentIds])] // Combinar y eliminar duplicados
        };
      });
    } else {
      // Deseleccionar todos los estudiantes
      setFormData(prev => ({
        ...prev,
        student_ids: []
      }));
    }
  };

  // Función para cargar estudiantes con su estado de indicador
  const fetchStudentsWithIndicator = useCallback(async () => {
    if (!id || !teacherId || !formData.grade) return [];
    
    try {
      setStudentsLoading(true);
      setStudentsError(null);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No se encontró el token de autenticación');
      }
      
      console.log(`🔍 Solicitando estudiantes para el indicador ${id} del docente ${teacherId}, grado ${formData.grade}`);
      
      // Obtener todos los estudiantes del docente por grado
      const studentsResponse = await axios.get(`/api/teachers/${teacherId}/students/by-grade/${formData.grade}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        withCredentials: true,
        timeout: 10000
      });

      // Obtener estudiantes con este indicador específico
      const indicatorStudentsResponse = await axios.get(`/api/indicators/${id}/students`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        withCredentials: true,
        timeout: 10000
      });

      // Procesar la respuesta de estudiantes
      let allStudents = [];
      if (studentsResponse.data?.success || Array.isArray(studentsResponse.data)) {
        allStudents = Array.isArray(studentsResponse.data?.data) ? 
          studentsResponse.data.data : 
          (Array.isArray(studentsResponse.data) ? studentsResponse.data : []);
      }
      
      console.log('📊 Todos los estudiantes del grado:', allStudents);
      
      // Procesar la respuesta de estudiantes con indicador
      let indicatorStudents = [];
      if (indicatorStudentsResponse.data?.success || Array.isArray(indicatorStudentsResponse.data)) {
        indicatorStudents = Array.isArray(indicatorStudentsResponse.data?.data) ? 
          indicatorStudentsResponse.data.data : 
          (Array.isArray(indicatorStudentsResponse.data) ? indicatorStudentsResponse.data : []);
      }
      
      console.log('📊 Estudiantes con indicador:', indicatorStudents);
      
      // Crear un mapa de estudiantes con indicador para búsqueda rápida
      const indicatorMap = new Map();
      
      // Procesar los estudiantes con indicador
      indicatorStudents.forEach(student => {
        const studentId = String(student.id || student.user_id || student.student_id);
        if (studentId) {
          indicatorMap.set(studentId, {
            ...student,
            id: studentId,
            hasIndicator: true,
            has_indicator: 1,
            achieved: student.achieved || false,
            assigned_at: student.assigned_at || student.assignedAt || null,
            name: student.name || student.full_name || `Estudiante ${studentId}`
          });
        }
      });
      
      // Combinar los datos de los estudiantes
      const processedStudents = allStudents.map(student => {
        const studentId = String(student.id || student.user_id);
        const indicatorData = indicatorMap.get(studentId);
        
        if (indicatorData) {
          return {
            ...student,
            ...indicatorData,
            id: studentId,
            name: student.name || student.full_name || `Estudiante ${studentId}`,
            hasIndicator: true
          };
        }
        
        return {
          ...student,
          id: studentId,
          name: student.name || student.full_name || `Estudiante ${studentId}`,
          hasIndicator: false,
          has_indicator: 0,
          achieved: false,
          assigned_at: null
        };
      });
      
      console.log('👥 Estudiantes procesados:', processedStudents);
      
      // Actualizar el estado
      setStudents(prev => [
        // Opciones por defecto
        { 
          id: 'none', 
          name: 'No aplicar aún',
          grade: formData.grade,
          hasIndicator: false
        },
        { 
          id: 'all', 
          name: 'Todos los estudiantes del curso',
          grade: formData.grade,
          hasIndicator: false
        },
        // Estudiantes reales
        ...processedStudents
      ]);
      
      // Actualizar los estudiantes seleccionados
      const studentsWithIndicator = processedStudents.filter(s => s.hasIndicator);
      if (studentsWithIndicator.length > 0) {
        setFormData(prev => ({
          ...prev,
          student_ids: studentsWithIndicator.map(s => s.id)
        }));
      }
      
      return studentsWithIndicator;
    } catch (error) {
      console.error('❌ Error al cargar estudiantes con indicador:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      setStudentsError('No se pudieron cargar los estudiantes con el estado del indicador');
      return [];
    } finally {
      setStudentsLoading(false);
    }
  }, [id, teacherId, formData.grade]);

  // Verificar si un estudiante está seleccionado
  const isStudentSelected = (studentId) => {
    if (!formData.student_ids) return false;
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

      // Asegurarse de que student_ids sea un array
      const currentStudentIds = Array.isArray(formData.student_ids) ? formData.student_ids : [];
      
      // 1. Si se seleccionó 'todos', obtener los IDs de todos los estudiantes
      const studentIdsToProcess = currentStudentIds.includes('all') 
        ? realStudents.map(s => s.id)
        : currentStudentIds;
      
      console.log('📝 Procesando estudiantes:', studentIdsToProcess);
      
      // 3. Preparar datos para enviar
      const dataToSend = {
        description: formData.description,
        subject: formData.subject,
        phase: formData.phase,
        grade: formData.grade,
        teacher_id: teacherId,
        questionnaire_id: formData.questionnaire_id || null,
        student_ids: formData.student_ids
      };
      
      console.log('📤 Enviando datos al servidor:', dataToSend);
      
      // 4. Determinar si es una creación o actualización
      const url = id ? `/api/indicators/${id}` : '/api/indicators';
      const method = id ? 'put' : 'post';
      
      // 5. Realizar la petición
      const response = await axios[method](url, dataToSend, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        withCredentials: true
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
        const errorMessage = (error.response?.data?.message || '').toString().toLowerCase();
        const errorDetail = (error.response?.data?.error || '').toString().toLowerCase();
        const isTokenExpired = errorMessage.includes('expirado') || errorDetail.includes('expirado');
        
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
    
    if (isChecked) {
      // Si se está marcando el estudiante
      try {
        console.log(`✅ Marcando estudiante ${student.name} como seleccionado`);
        
        console.log(`📡 Asignando indicador ${id} al estudiante ${student.id}`);
        
        // Usar la instancia de api configurada
        const response = await api.post(
          `/api/indicators/${id}/students`,
          { 
            student_id: student.id,
            achieved: false
          }
        );
        
        console.log('✅ Respuesta de la API:', response.data);
        
        // Actualizar el estado local después de la asignación exitosa
        setStudents(prev => 
          prev.map(s => 
            s.id === student.id 
              ? { 
                  ...s, 
                  hasIndicator: true,
                  has_indicator: 1
                } 
              : s
          )
        );
        
        // Actualizar los IDs de estudiantes seleccionados
        setFormData(prev => ({
          ...prev,
          student_ids: [...new Set([
            ...(Array.isArray(prev.student_ids) ? prev.student_ids : []),
            student.id
          ])].filter(id => id !== 'all' && id !== 'none')
        }));
      } catch (error) {
        console.error('❌ Error al marcar estudiante:', error);
        setError('No se pudo marcar el estudiante. Por favor, intente nuevamente.');
      }
    } else {
      // Si se está desmarcando un estudiante
      try {
        // Si el estudiante tiene un indicador, pedir confirmación
        if (student.hasIndicator || student.has_indicator) {
          const confirmMessage = `¿Está seguro que desea eliminar este indicador del estudiante ${student.name}?`;
          
          if (!window.confirm(confirmMessage)) {
            console.log('❌ Usuario canceló la eliminación del estudiante');
            return;
          }
          
          console.log(`🗑️ Eliminando indicador ${id} del estudiante ${student.id}`);
          await api.delete(`/api/indicators/${id}/students/${student.id}`);
        }
        
        // Actualizar el estado local
        setStudents(prev => 
          prev.map(s => 
            s.id === student.id 
              ? { 
                  ...s, 
                  hasIndicator: false,
                  has_indicator: 0
                } 
              : s
          )
        );
        
        // Actualizar los IDs de estudiantes seleccionados
        setFormData(prev => ({
          ...prev,
          student_ids: (Array.isArray(prev.student_ids) ? prev.student_ids : [])
            .filter(id => id !== student.id && id !== 'all' && id !== 'none')
        }));
      } catch (error) {
        console.error('❌ Error al desmarcar estudiante:', error);
        setError('No se pudo desmarcar el estudiante. Por favor, intente nuevamente.');
      }
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
      
      // Usar la instancia de api configurada para eliminar la relación
      const response = await api.delete(
        `/api/indicators/${id}/students/${student.id}`,
        { validateStatus: (status) => status < 500 } // Aceptar códigos de estado menores a 500 como exitosos
      );
      
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
    if (studentsLoading) {
      return (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (studentsError) {
      return (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {studentsError}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (students.length === 0) {
      return (
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay estudiantes</h3>
          <p className="mt-1 text-sm text-gray-500">
            No se encontraron estudiantes para el grado seleccionado.
          </p>
        </div>
      );
    }

    // Usar los estudiantes ya filtrados y ordenados
    const filteredStudents = realStudents;

    if (filteredStudents.length === 0) {
      return (
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay estudiantes disponibles</h3>
          <p className="mt-1 text-sm text-gray-500">
            No se encontraron estudiantes que coincidan con los filtros actuales.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {filteredStudents.map(student => {
          const hasIndicator = student.hasIndicator === true || student.has_indicator === 1;
          const isSelected = formData.student_ids?.includes(String(student.id));
          
          return (
            <div 
              key={student.id} 
              className={`flex items-center p-3 transition-colors ${
                isSelected 
                  ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                  : hasIndicator 
                    ? 'bg-green-50 border-l-4 border-l-green-500' 
                    : 'hover:bg-gray-50 border-l-4 border-l-transparent'
              }`}
            >
              <div className="flex items-center w-full">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={isSelected || hasIndicator}
                    onChange={(e) => handleStudentToggle(student, e.target.checked)}
                    className={`w-5 h-5 rounded border ${
                      isSelected || hasIndicator
                        ? 'bg-blue-100 border-blue-600 text-blue-600 focus:ring-blue-200'
                        : 'border-gray-300 hover:border-blue-500 bg-white hover:bg-gray-50 focus:ring-blue-200'
                    } cursor-pointer transition-colors focus:ring-2 focus:ring-offset-1`}
                    disabled={isUpdating}
                    title={isSelected ? 'Deseleccionar estudiante' : 'Seleccionar estudiante'}
                  />
                </div>
                <label className="ml-3 flex-1 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {student.name || `Estudiante ${student.id}`}
                      </p>
                      {hasIndicator && !isSelected && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Asignado
                        </span>
                      )}
                      {isSelected && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Seleccionado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      Grado: {student.grade || 'No especificado'}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          );
        })}
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
          ) : realStudents.length === 0 ? (
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
