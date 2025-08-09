// pages/results/ResultDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/axios';
import { ArrowLeft, X, Edit, Save, X as XIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const ResultDetail = () => {
  const { isAuthenticated, isAuthReady } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    student: {},
    attempt: {},
    questionnaire: {},
    result: {}
  });

  // Función para formatear la fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  };
  
  // Función para formatear el puntaje de manera segura
  const formatScore = (score) => {
    try {
      const numScore = parseFloat(score);
      return !isNaN(numScore) ? numScore.toFixed(2) : 'N/A';
    } catch (error) {
      return 'N/A';
    }
  };

  // Manejar cambios en los campos del formulario
  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };
  
  // Guardar los cambios
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Filtrar solo los campos que han cambiado
      const changesToSave = {};
      
      // Verificar cambios en cada sección
      ['student', 'attempt', 'questionnaire', 'result'].forEach(section => {
        const sectionChanges = {};
        Object.entries(formData[section] || {}).forEach(([key, value]) => {
          // Comparar con los valores originales
          const originalValue = 
            section === 'student' ? (result[`student_${key}`] || (result.student && result.student[key])) :
            section === 'attempt' ? (result.attempt ? result.attempt[key] : result[key]) :
            section === 'questionnaire' ? (result[`questionnaire_${key}`] || (result.questionnaire && result.questionnaire[key])) :
            result[key];
            
          if (value !== originalValue) {
            sectionChanges[key] = value;
          }
        });
        
        if (Object.keys(sectionChanges).length > 0) {
          changesToSave[section] = sectionChanges;
        }
      });
      
      // Si no hay cambios, no hacemos nada
      if (Object.keys(changesToSave).length === 0) {
        setIsEditing(false);
        toast.info('No se detectaron cambios para guardar');
        return;
      }
      
      // Enviar los cambios al servidor
      const response = await api.put(`/api/evaluation-results/${id}`, changesToSave);
      
      if (response.data.success) {
        setResult(response.data.data);
        toast.success('Cambios guardados exitosamente');
        setIsEditing(false);
      } else {
        throw new Error(response.data.message || 'Error al guardar los cambios');
      }
    } catch (error) {
      console.error('Error al guardar los cambios:', error);
      toast.error('Error al guardar los cambios: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };
  
  // Cancelar edición
  const handleCancel = () => {
    // Restaurar los valores originales
    if (result) {
      setFormData({
        student: {
          grade: result.student_grade || result.student?.grade || ''
        },
        attempt: {
          score: result.score || result.attempt?.score || '',
          attempt_number: result.attempt?.attempt_number || '',
          attempt_date: result.attempt?.attempt_date || result.attempt_date || ''
        },
        questionnaire: {
          title: result.questionnaire_title || result.questionnaire?.title || '',
          description: result.questionnaire_description || result.questionnaire?.description || '',
          phase: result.phase || result.questionnaire?.phase || ''
        },
        result: {
          status: result.status || '',
          comments: result.comments || ''
        }
      });
    }
    setIsEditing(false);
  };

  // Efecto para cargar los datos del resultado
  useEffect(() => {
    let isMounted = true;
    
    const fetchResultDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const resultResponse = await api.get(`/api/evaluation-results/${id}`);
        const responseData = resultResponse?.data;

        if (!responseData || responseData.success === false) {
          throw new Error(responseData?.message || 'No se pudo obtener el resultado de la evaluación');
        }

        const resultData = responseData.data || responseData;
        
        if (isMounted) {
          setResult(resultData);
          
          // Inicializar el formulario con los datos actuales
          setFormData({
            student: {
              grade: resultData.student_grade || resultData.student?.grade || ''
            },
            attempt: {
              score: resultData.score || resultData.attempt?.score || '',
              attempt_number: resultData.attempt?.attempt_number || '',
              attempt_date: resultData.attempt?.attempt_date || resultData.attempt_date || ''
            },
            questionnaire: {
              title: resultData.questionnaire_title || resultData.questionnaire?.title || '',
              description: resultData.questionnaire_description || resultData.questionnaire?.description || '',
              phase: resultData.phase || resultData.questionnaire?.phase || ''
            },
            result: {
              status: resultData.status || '',
              comments: resultData.comments || ''
            }
          });
          
          setLoading(false);
        }
      } catch (error) {
        console.error('Error al cargar el resultado:', error);
        
        if (isMounted) {
          let errorMessage = 'Ocurrió un error al cargar el resultado de la evaluación';
          let shouldRedirectToLogin = false;
          
          if (error.isNetworkError) {
            errorMessage = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
          } else if (error.isAuthError || error.response?.status === 401) {
            errorMessage = 'Tu sesión ha expirado. Serás redirigido para iniciar sesión nuevamente.';
            shouldRedirectToLogin = true;
          } else if (error.response?.data) {
            // Usar el mensaje de error del servidor si está disponible
            errorMessage = error.response.data.message || error.message || errorMessage;
          }
          
          console.log('⚠️ [ResultDetail] Mostrando mensaje de error al usuario:', errorMessage);
          setError(errorMessage);
          
          // Si es un error de autenticación, redirigir al login
          if (shouldRedirectToLogin) {
            console.log('🔄 [ResultDetail] Redirigiendo a login desde manejo de error...');
            if (window.location.pathname !== '/login') {
              navigate('/login', { 
                replace: true,
                state: { 
                  from: window.location.pathname,
                  error: errorMessage
                } 
              });
            }
            return;
          }
          
          setLoading(false);
        }
      }
    };
    
    console.log('🚀 [ResultDetail] Montando componente con ID:', id);
    
    // Ejecutar la carga de datos
    fetchResultDetail();
    
    // Función de limpieza
    return () => {
      console.log('🧹 [ResultDetail] Desmontando componente');
      isMounted = false; // Marcar como desmontado
    };
  }, [id, navigate, isAuthenticated, isAuthReady]); // Añadir dependencias para evitar advertencias de React
  
  // Activar modo edición
  const handleEdit = () => {
    setIsEditing(true);
  };


// Renderizado condicional basado en el estado
if (loading) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Volver a resultados
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Detalles del Resultado de Evaluación
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Información detallada del resultado de la evaluación
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mt-8"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mt-8"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

if (error) {
  // Determinar el tipo de error para mostrar un mensaje más específico
  const isAuthError = error.includes('sesión ha expirado') || error.includes('autenticación');
  const isNetworkError = error.includes('conexión') || error.includes('red');
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-4xl">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/results', { replace: true })}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Volver a resultados
          </button>
        </div>
        
        <div className={`${isAuthError ? 'bg-yellow-50 border-yellow-500' : 'bg-red-50 border-red-500'} border-l-4 p-4 mb-6`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {isAuthError ? (
                <svg className="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${isAuthError ? 'text-yellow-800' : 'text-red-800'}`}>
                {isAuthError ? 'Error de autenticación' : 'Error al cargar el resultado'}
              </h3>
              <div className="mt-2 text-sm text-gray-700">
                <p>{error}</p>
                {isNetworkError && (
                  <p className="mt-2">Por favor, verifica tu conexión a internet e inténtalo de nuevo.</p>
                )}
                {isAuthError && (
                  <p className="mt-2">Serás redirigido automáticamente para iniciar sesión.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 space-x-3">
          {!isAuthError && (
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Reintentar
            </button>
          )}
          <button
            onClick={() => navigate('/results', { replace: true })}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Volver a la lista de resultados
          </button>
        </div>
      </div>
    </div>
  );
}

// Si no hay resultado, mostrar mensaje de error
if (!result) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center text-red-500">
          <p>{error || 'No se encontró el resultado solicitado'}</p>
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Volver a resultados
        </button>
        
        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Editar
          </button>
        ) : (
          <div className="space-x-2">
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              disabled={saving}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                <>
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="container py-4">
        <div className="card">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Detalles del Resultado</h5>
            <div>
              {isEditing ? (
                <>
                  <button 
                    onClick={handleSave}
                    className="btn btn-success btn-sm me-2"
                    disabled={saving}
                  >
                    <Save size={16} className="me-1" />
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button 
                    onClick={handleCancel}
                    className="btn btn-secondary btn-sm"
                    disabled={saving}
                  >
                    <XIcon size={16} className="me-1" />
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="btn btn-light btn-sm me-2"
                  >
                    <Edit size={16} className="me-1" />
                    Editar
                  </button>
                  <button 
                    onClick={() => navigate('/results', { replace: true })}
                    className="btn btn-light btn-sm"
                  >
                    <ArrowLeft size={16} className="me-1" /> 
                    Volver
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="card-body">
            {result && (
              <>
                <h4>Información del Estudiante</h4>
                <div className="row mb-4">
                  <div className="col-md-6">
                    <p><strong>Nombre:</strong> {result.student?.name || result.student_name || 'N/A'}</p>
                    <p><strong>Email:</strong> {result.student?.contact_email || result.student_email || 'N/A'}</p>
                  </div>
                  <div className="col-md-6">
                    <p>
                      <strong>Grado:</strong>
                      {isEditing ? (
                        <input
                          type="text"
                          className="form-control form-control-sm d-inline-block w-auto ms-2"
                          value={formData.student.grade || ''}
                          onChange={(e) => handleInputChange('student', 'grade', e.target.value)}
                        />
                      ) : (
                        ` ${result.student_grade || result.student?.grade || 'N/A'}`
                      )}
                    </p>
                    <p><strong>Curso:</strong> {result.course_name || 'N/A'}</p>
                  </div>
                </div>
                
                <h4>Información del Cuestionario</h4>
                <div className="row mb-4">
                  <div className="col-md-6">
                    <p>
                      <strong>Título:</strong>
                      {isEditing ? (
                        <input
                          type="text"
                          className="form-control form-control-sm d-inline-block w-75 ms-2"
                          value={formData.questionnaire.title || ''}
                          onChange={(e) => handleInputChange('questionnaire', 'title', e.target.value)}
                        />
                      ) : (
                        ` ${result.questionnaire_title || result.questionnaire?.title || 'N/A'}`
                      )}
                    </p>
                    <p>
                      <strong>Fase:</strong>
                      {isEditing ? (
                        <select
                          className="form-select form-select-sm d-inline-block w-auto ms-2"
                          value={formData.questionnaire.phase || ''}
                          onChange={(e) => handleInputChange('questionnaire', 'phase', e.target.value)}
                        >
                          <option value="">Seleccionar fase</option>
                          <option value="Fase 1">Fase 1</option>
                          <option value="Fase 2">Fase 2</option>
                          <option value="Fase 3">Fase 3</option>
                        </select>
                      ) : (
                        ` ${result.phase || result.questionnaire?.phase || 'N/A'}`
                      )}
                    </p>
                    <p><strong>ID del Cuestionario:</strong> {result.questionnaire_id || 'N/A'}</p>
                  </div>
                  <div className="col-md-6">
                    <p>
                      <strong>Descripción:</strong>
                      {isEditing ? (
                        <textarea
                          className="form-control form-control-sm mt-1"
                          rows="2"
                          value={formData.questionnaire.description || ''}
                          onChange={(e) => handleInputChange('questionnaire', 'description', e.target.value)}
                        />
                      ) : (
                        ` ${result.questionnaire_description || result.questionnaire?.description || 'Sin descripción'}`
                      )}
                    </p>
                    <p>
                      <strong>Puntuación:</strong>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="5"
                          className="form-control form-control-sm d-inline-block w-auto ms-2"
                          value={formData.attempt.score || ''}
                          onChange={(e) => handleInputChange('attempt', 'score', parseFloat(e.target.value) || 0)}
                        />
                      ) : (
                        ` ${result.score !== undefined ? formatScore(result.score) : 'N/A'}`
                      )}
                    </p>
                  </div>
                </div>
                
                <h4>Resultados</h4>
                <div className="row">
                  <div className="col-md-6">
                    <p><strong>Mejor Puntaje:</strong> 
                      <span className={`badge ms-2 ${parseFloat(result.best_score) >= 3.5 ? 'bg-success' : 'bg-danger'}`}>
                        {formatScore(result.best_score)}
                      </span>
                    </p>
                    <p><strong>Fecha de Registro:</strong> {formatDate(result.recorded_at) || 'N/A'}</p>
                    {isEditing && (
                      <div className="mb-3">
                        <label className="form-label"><strong>Comentarios:</strong></label>
                        <textarea
                          className="form-control"
                          rows="3"
                          value={formData.result.comments || ''}
                          onChange={(e) => handleInputChange('result', 'comments', e.target.value)}
                        />
                      </div>
                    )}
                    {!isEditing && result.comments && (
                      <div className="mt-2">
                        <strong>Comentarios:</strong>
                        <div className="border rounded p-2 bg-light">
                          {result.comments}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <p>
                      <strong>Número de Intento:</strong>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          className="form-control form-control-sm d-inline-block w-auto ms-2"
                          value={formData.attempt.attempt_number || ''}
                          onChange={(e) => handleInputChange('attempt', 'attempt_number', parseInt(e.target.value) || 1)}
                        />
                      ) : (
                        ` ${result.attempt?.attempt_number ?? 'No disponible'}`
                      )}
                    </p>
                    <p>
                      <strong>Fecha del Intento:</strong>
                      {isEditing ? (
                        <input
                          type="datetime-local"
                          className="form-control form-control-sm d-inline-block w-auto ms-2"
                          value={formData.attempt.attempt_date ? new Date(formData.attempt.attempt_date).toISOString().slice(0, 16) : ''}
                          onChange={(e) => handleInputChange('attempt', 'attempt_date', e.target.value)}
                        />
                      ) : (
                        ` ${result.attempt?.attempt_date ? formatDate(result.attempt.attempt_date) : (result.attempt?.completed_at ? formatDate(result.attempt.completed_at) : 'No disponible')}`
                      )}
                    </p>
                    {isEditing && (
                      <div className="mt-3">
                        <label className="form-label"><strong>Estado:</strong></label>
                        <select
                          className="form-select form-select-sm"
                          value={formData.result.status || ''}
                          onChange={(e) => handleInputChange('result', 'status', e.target.value)}
                        >
                          <option value="">Seleccionar estado</option>
                          <option value="completado">Completado</option>
                          <option value="en_progreso">En progreso</option>
                          <option value="pendiente">Pendiente</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Sección de depuración temporal - Mostrar toda la estructura de result */}
                <div className="mt-4 p-3 bg-light rounded">
                  <h5>Datos de depuración (solo visible en desarrollo)</h5>
                  <pre className="bg-white p-2 rounded" style={{ fontSize: '0.8rem' }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
       </div>
      </div>
    </div>
  );
};

export default ResultDetail;
