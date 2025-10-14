// src/pages/indicators/IndicatorForm.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
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
    category: '',
    phase: '', // Cambiado a cadena vacía para mostrar 'Seleccione una fase' por defecto
    grade: '',
    questionnaire_id: '', // Cambiado de questionnaireid a questionnaire_id para mantener consistencia
    students: [],       // lista de estudiantes (objetos con datos)
    studentids: [],     // lista de IDs de estudiantes seleccionados (asegurar que sea array)
    teacherid: null,
    // otros campos relevantes que tengas en el formulario pueden agregarse aquí
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
  const [categories, setCategories] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
 
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
        
        // Siempre establecer manualEntry como false si hay cuestionarios disponibles
        if (questionnairesData.length > 0) {
          setManualEntry(false);
          
          // Ya no seleccionamos automáticamente el primer cuestionario
          // El usuario deberá seleccionar uno manualmente
          console.log(`📊 Se cargaron ${questionnairesData.length} cuestionarios`);
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
      
      // 8. Actualizar los IDs de estudiantes seleccionados segun asignación actual
      if (assignedStudents.length > 0) {
        setFormData(prev => ({
          ...prev,
          studentids: assignedStudents.map(s => s.id)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          studentids: []
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
      studentids: [] // Reiniciar la selección de estudiantes al cambiar el grado
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
            
            // Si solo hay un estudiante, seleccionarlo automáticamente solo en creación
            if (!isEditing && students.length === 1 && students[0].id !== 'all' && students[0].id !== 'none') {
              setFormData(prev => ({
                ...prev,
                studentids: [students[0].id]
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
          (indicatorData.studentids === 'all' ? ['all'] : []);
        
        console.log('👥 Estudiantes asignados al indicador:', assignedStudents);
        console.log('🆔 IDs de estudiantes asignados:', assignedStudentIds);
        
        // Actualizar el estado del formulario con los datos del indicador
        const formDataUpdate = {
          description: indicatorData.description || '',
          subject: indicatorData.subject || '',
          category: indicatorData.category || '',
          phase: indicatorData.phase?.toString() || '1',
          grade: indicatorData.grade?.toString() || '',
          studentids: assignedStudentIds,
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
                console.log('🏷️ Marcando estudiantes con indicador asignado...');
                setStudents(prevStudents => 
                  prevStudents.map(student => ({
                    ...student,
                    hasIndicator: assignedStudentIds.includes('all') || 
                                assignedStudentIds.includes(String(student.id)) || 
                                false
                  }))
                );
                
                // Sincronizar siempre studentids con lo que viene del backend
                setFormData(prev => ({
                  ...prev,
                  studentids: assignedStudentIds
                }));
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
          
// Cargar datos iniciales del indicador
if (indicatorData) {
  const formDataUpdate = {
    description: indicatorData.description || '',
    subject: indicatorData.subject || '',
    category: indicatorData.category || '',
    phase: indicatorData.phase?.toString() || '1',
    grade: indicatorData.grade?.toString() || '',
    questionnaire_id: indicatorData.questionnaire_id || '',
    students: indicatorData.students || []
  };

  setFormData(formDataUpdate);
  console.log('📝 Formulario actualizado:', formDataUpdate);

  if (indicatorData.teacher_id) {
    setTeacherId(indicatorData.teacher_id);
    console.log('👨‍🏫 ID del docente actualizado:', indicatorData.teacher_id);
  }

  // Detectar estudiantes asignados sin duplicados para seleccionar en el formulario
  if (indicatorData.students && indicatorData.students.length > 0) {
    const uniqueStudents = [];
    const seen = new Set();

    for (const student of indicatorData.students) {
      const studentId = student.id || student.student_id;
      if (!seen.has(studentId)) {
        seen.add(studentId);
        uniqueStudents.push(String(studentId));  // IDs como string
      }
    }

    setFormData(prev => ({
      ...prev,
      studentids: uniqueStudents
    }));
    console.log('👥 Estudiantes asignados cargados:', uniqueStudents);
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
        category: selectedQuestionnaire.category || prev.category || '',
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

  // Cargar categorías por materia seleccionada
  useEffect(() => {
    const loadCategories = async () => {
      try {
        if (!formData.subject) {
          setCategories([]);
          return;
        }
        const res = await axios.get(`/api/subject-categories/${encodeURIComponent(formData.subject)}`);
        const rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        let mapped = rows.map(r => r.category || r.category_name || r?.category)?.filter(Boolean);
        
        // Si estamos editando y el indicador tiene una categoría que no está en la lista, agregarla
        if (isEditing && formData.category && !mapped.includes(formData.category)) {
          mapped = [formData.category, ...mapped];
        }
        
        setCategories(mapped);
      } catch (e) {
        console.warn('No se pudieron cargar categorías para la materia', formData.subject);
        // Si hay error pero el indicador tiene categoría, al menos mostrarla
        if (isEditing && formData.category) {
          setCategories([formData.category]);
        } else {
          setCategories([]);
        }
      }
    };
    
    // Cargar categorías siempre que haya materia
    if (formData.subject) {
      loadCategories();
    }
  }, [formData.subject, formData.category, isEditing]);

  const handleStudentChange = (e) => {
    const selectedStudentId = e.target.value;    
    // Manejar opciones especiales: 'none' o 'all'
    if (selectedStudentId === 'none' || selectedStudentId === 'all') {
      setFormData(prev => ({
        ...prev,
        studentids: selectedStudentId === 'all' ? ['all'] : []
      }));
      return;
    }
    
    // Si es un estudiante individual, agregar o quitar de la selección
    setFormData(prev => {
      const currentIds = [...prev.studentids];
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
        studentids: currentIds
      };
    });
    
    console.log('✅ Estado actualizado con estudiantes:', formData.studentids);
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
          studentids: studentsWithIndicator.map(s => s.id)
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
        // Asegurarse de que studentids sea un array
        const currentStudentIds = Array.isArray(prev.studentids) ? prev.studentids : [];
        
        return {
          ...prev,
          studentids: [...new Set([...currentStudentIds, ...uniqueStudentIds])] // Combinar y eliminar duplicados
        };
      });
    } else {
      // Deseleccionar todos los estudiantes
      setFormData(prev => ({
        ...prev,
        studentids: []
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
          studentids: studentsWithIndicator.map(s => s.id)
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

  const isStudentSelected = (studentId) => {
    if (!Array.isArray(formData.studentids)) return false;
    return formData.studentids.includes(studentId) || formData.studentids.includes('all');
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      console.log('📤 Iniciando envío del formulario...');
      
      // 1. Obtener token y verificar autenticación
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No se encontró el token de autenticación. Por favor, inicia sesión nuevamente.');
      }
      
      // 2. Verificar que el usuario tenga teacher_id
      if (!user || !user.teacher_id) {
        throw new Error('No se pudo verificar la información del docente. Por favor, inicia sesión nuevamente.');
      }
  
      // 2.1 Confirmar si se están removiendo asociaciones al actualizar
      if (isEditing) {
        // Construir set de asignados actuales en UI
        const selectedNow = new Set(
          (Array.isArray(formData.studentids) ? formData.studentids : [])
            .filter(id => id !== 'all' && id !== 'none')
            .map(String)
        );

        // Construir set de asignados según backend (hasIndicator)
        const currentlyAssigned = new Set(
          (Array.isArray(students) ? students : [])
            .filter(s => s && s.id && s.id !== 'all' && s.id !== 'none' && (s.hasIndicator === true || s.has_indicator === 1))
            .map(s => String(s.id))
        );

        // Detectar removidos (estaban asignados y ya no están seleccionados)
        const removed = [...currentlyAssigned].filter(id => !selectedNow.has(id));

        if (removed.length > 0) {
          const { isConfirmed } = await Swal.fire({
            icon: 'warning',
            title: 'Confirmar actualización',
            html: `Se eliminará la asociación del indicador con <b>${removed.length}</b> estudiante(s).<br/>¿Deseas continuar?`,
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar'
          });
          if (!isConfirmed) {
            // Restaurar selección anterior basada en el estado del backend
            setFormData(prev => ({
              ...prev,
              studentids: [...currentlyAssigned]
            }));
            setLoading(false);
            return; // Cancelar envío
          }
        }
      }

      // 3. Preparar datos para enviar
      const payload = {
        ...formData,
        teacher_id: user.teacher_id,
        student_ids: Array.isArray(formData.studentids) 
          ? formData.studentids.filter(id => id !== 'all' && id !== 'none')
          : [],
        questionnaire_id: formData.questionnaire_id || null,
        category: formData.category || null
      };
  
      console.log('📝 Datos a enviar:', payload);
      
      // 4. Configurar headers con el token
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        withCredentials: true
      };
  
      // 5. Determinar si es una creación o actualización
      let response;
      if (id) {
        // Actualización de indicador existente
        console.log('🔄 Actualizando indicador existente...');
        response = await api.put(`/api/indicators/${id}`, payload, config);
      } else {
        // Creación de nuevo indicador
        console.log('🆕 Creando nuevo indicador...');
        response = await api.post('/api/indicators', payload, config);
      }
  
      if (!response.data?.success) {
        throw new Error(response.data?.message || `Error al ${id ? 'actualizar' : 'crear'} el indicador`);
      }
      
      console.log(`✅ Indicador ${id ? 'actualizado' : 'creado'} correctamente:`, response.data);
      
      // 6. Si es una creación, redirigir al listado
      if (!id) {
        // Mostrar mensaje de éxito
        setSuccess('¡Indicador creado exitosamente!');
        
        // Redirigir después de un breve retraso para que el usuario vea el mensaje
        setTimeout(() => {
          // Limpiar el estado antes de redirigir
          setSuccess('');
          // Redirigir al listado de indicadores (usar /indicadores en lugar de /indicators)
          navigate('/indicadores', { replace: true });
        }, 1500);
        
        // No hacer return aquí para evitar interrumpir el flujo
        return;
      }
      
      // 7. Si es una actualización, forzar recarga de datos
      await fetchIndicator();
      
      // 8. Actualizar manualmente la lista de estudiantes
      if (formData.grade && teacherId) {
        await fetchStudents(teacherId, formData.grade);
      }

      // 8. Mostrar mensaje de éxito
      console.log('🎉 Indicador actualizado correctamente');
      setSuccess('Los cambios se guardaron correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('❌ Error al guardar los cambios:', error);
      
      let errorMessage = 'Ocurrió un error al guardar los cambios';
      
      if (error.response) {
        console.error('❌ Detalles del error:', error.response.data);
        
        if (error.response.status === 401) {
          errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          navigate('/login');
        } else if (error.response.status === 403) {
          errorMessage = 'No tienes permisos para modificar este indicador. Verifica que seas el propietario.';
          
          if (error.response.data?.message) {
            errorMessage += ` (${error.response.data.message})`;
          }
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.request) {
        errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a Internet.';
      } else {
        errorMessage = error.message || 'Error desconocido al guardar los cambios';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  
  const renderStudentSelectionInfo = () => {
    return (
      <div>
        <span className="block mt-1 text-blue-600">
          {Array.isArray(formData.studentids)
            ? students
                .filter(s => Array.isArray(formData.studentids) && formData.studentids.includes(s.id))
                .map(s => s.name)
                .join(', ')
            : ''}
        </span>
        <p className="text-sm text-gray-500 mt-1">
          {Array.isArray(formData.studentids) && formData.studentids.includes('all')
            ? 'El indicador se aplicará a todos los estudiantes del grado.'
            : Array.isArray(formData.studentids) && formData.studentids.length > 0
            ? `Se aplicará a ${formData.studentids.length} estudiante(s) seleccionado(s).`
            : 'No se aplicará a ningún estudiante por ahora.'}
        </p>
      </div>
    );
  };
  

  // Función para manejar el cambio de estado de un estudiante
  const handleStudentToggle = (studentId) => {
    setFormData(prev => {
      // Siempre asegura array
      const currentStudentIds = Array.isArray(prev.studentids) ? prev.studentids : [];
      const index = currentStudentIds.indexOf(studentId);
      let updatedStudentIds;
  
      if (index === -1) {
        updatedStudentIds = [...currentStudentIds, studentId];
      } else {
        updatedStudentIds = [...currentStudentIds];
        updatedStudentIds.splice(index, 1);
      }
  
      return {
        ...prev,
        studentids: updatedStudentIds
      };
    });
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
          const updatedStudentIds = prev.studentids.filter(id => id !== student.id && id !== 'all');
          console.log('🔄 IDs de estudiantes actualizados en el formulario:', updatedStudentIds);
          return {
            ...prev,
            studentids: updatedStudentIds
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
          {/* ... contenido ... */}
        </div>
      );
    }
  
    if (students.length === 0) {
      return (
        <div className="text-center py-8">
          {/* ... contenido ... */}
        </div>
      );
    }
  
    // Filtrar estudiantes por término de búsqueda
    const filteredStudents = realStudents.filter(student => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const nameMatch = student.name?.toLowerCase().includes(term);
      const emailMatch = student.email?.toLowerCase().includes(term);
      const idMatch = String(student.id).toLowerCase().includes(term);
      return nameMatch || emailMatch || idMatch;
    });
  
    if (filteredStudents.length === 0) {
      return (
        <div className="text-center py-8">
          {/* ... contenido ... */}
        </div>
      );
    }
  
    return (
      <div className="space-y-4">
        {/* Barra de búsqueda */}
        <div className="input-group mb-3">
          {/* ... contenido ... */}
        </div>
        
        {/* Lista de estudiantes */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {filteredStudents.map(student => {
            const hasIndicator = student.hasIndicator === true || student.has_indicator === 1;
            // Protección aquí
            const isSelected = Array.isArray(formData.studentids) && formData.studentids.includes(String(student.id));
            
            return (
              <div key={student.id} className={`flex items-center p-3 transition-colors ${
                isSelected 
                  ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                  : hasIndicator 
                    ? 'bg-green-50 border-l-4 border-l-green-500' 
                    : 'hover:bg-gray-50 border-l-4 border-l-transparent'
              }`}>
                <div className="flex items-center w-full">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleStudentToggle(student.id)}
                      className={`w-5 h-5 rounded border ${
                        isSelected
                          ? 'bg-blue-100 border-blue-600 text-blue-600 focus:ring-blue-200'
                          : 'border-gray-300 hover:border-blue-500 bg-white hover:bg-gray-50 focus:ring-blue-200'
                      } cursor-pointer transition-colors focus:ring-2 focus:ring-offset-1`}
                      disabled={isUpdating}
                      title={isSelected ? 'Deseleccionar estudiante' : 'Seleccionar estudiante'}
                    />
                  </div>
                  <label className="ml-3 flex-1 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {student.name || `Estudiante ${student.id}`}
                        {student.grade && ` - Grado ${student.grade}`}
                      </p>
                      {student.email && (
                        <p className="text-sm text-gray-500">{student.email}</p>
                      )}
                    </div>
                    {hasIndicator && !isSelected && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Ya tiene indicador
                      </span>
                    )}
                  </label>
                </div>
              </div>
            );
          })}
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
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="questionnaire_id">
              Asociar a cuestionario (opcional)
            </label>
            <div className="space-y-4">
              <select
                id="questionnaire_id"
                name="questionnaire_id"
                value={formData.questionnaire_id || ''}
                onChange={handleQuestionnaireChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                disabled={loading || questionnaires.length === 0}
              >
                <option value="">Seleccione un cuestionario (opcional)</option>
                {questionnaires.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} - Grado {q.grade}°
                  </option>
                ))}
              </select>

              {formData.questionnaire_data && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
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
            readOnly={false}
            required
          />
          {teacherSubject && (
            <div className="form-text">Materia asignada: {teacherSubject}</div>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="category" className="form-label">Categoría</label>
          <select
            id="category"
            name="category"
            className="form-select"
            value={formData.category || ''}
            onChange={handleChange}
            disabled={!formData.subject}
          >
            <option value="">Seleccione una categoría</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {!formData.subject && (
            <div className="form-text">Seleccione primero la materia para cargar categorías</div>
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
          {realStudents.length > 0 && (
            <div className="d-flex gap-2 mb-3">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => toggleSelectAllStudents(true)}
                disabled={loading}
              >
                Seleccionar todo el curso
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => toggleSelectAllStudents(false)}
                disabled={loading}
              >
                Deseleccionar todo
              </button>
            </div>
          )}
          
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