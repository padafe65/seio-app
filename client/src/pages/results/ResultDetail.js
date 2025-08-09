// pages/results/ResultDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/axios';
import { ArrowLeft, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const ResultDetail = () => {
  const { isAuthenticated, isAuthReady } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [editableResult, setEditableResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Efecto para cargar los datos del resultado
  useEffect(() => {
    // Si la autenticación aún no está lista, esperar
    if (isAuthReady === false) {
      console.log('⏳ [ResultDetail] Esperando verificación de autenticación...');
      return;
    }
    
    // Si no está autenticado, redirigir al login
    if (!isAuthenticated) {
      console.log('🔐 [ResultDetail] Usuario no autenticado, redirigiendo a login...');
      
      // Verificar si ya estamos en la página de login para evitar bucles
      if (window.location.pathname !== '/login') {
        navigate('/login', { 
          replace: true,
          state: { 
            from: window.location.pathname,
            error: 'Por favor inicia sesión para continuar'
          } 
        });
      }
      return;
    }

    // Si no hay ID, mostrar error
    if (!id) {
      setError('No se proporcionó un ID de resultado válido');
      setLoading(false);
      return;
    }
    
    // Bandera para evitar actualizaciones después de desmontar
    let isMounted = true;
    
    const fetchResultDetail = async () => {
      try {
        if (isMounted) {
          setLoading(true);
          setError(null);
          console.log('🔍 [ResultDetail] Iniciando carga de resultado con ID:', id);
        }
        
        // Obtener el resultado con manejo de errores mejorado
        const resultResponse = await api.get(`/api/evaluation-results/${id}`)
          .catch(err => {
            console.error('❌ [ResultDetail] Error en la respuesta de la API:', {
              status: err.response?.status,
              statusText: err.response?.statusText,
              data: err.response?.data
            });
            
            // Si el error es 401, ya se manejará en el interceptor
            if (err.response?.status === 401) {
              throw new Error('No autorizado. Redirigiendo a inicio de sesión...');
            }
            
            throw err;
          });
        
        if (!isMounted) return;
        
        const responseData = resultResponse?.data;
        if (!responseData || responseData.success === false) {
          throw new Error(responseData?.message || 'No se pudo obtener el resultado de la evaluación');
        }
        
        console.log('✅ [ResultDetail] Resultado cargado correctamente:', responseData);
        
        const resultData = responseData.data || responseData;
        
        if (isMounted) {
          setResult(resultData);
          setLoading(false);
        }
      } catch (err) {
        console.error('❌ [ResultDetail] Error al cargar el resultado:', err);
        
        // Verificar si el componente sigue montado
        if (!isMounted) return;
        
        // Manejar diferentes tipos de errores
        let errorMessage = 'Ocurrió un error al cargar el resultado de la evaluación';
        let shouldRedirectToLogin = false;
        
        if (err.isNetworkError) {
          errorMessage = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
        } else if (err.isAuthError || err.response?.status === 401) {
          errorMessage = 'Tu sesión ha expirado. Serás redirigido para iniciar sesión nuevamente.';
          shouldRedirectToLogin = true;
        } else if (err.response?.data) {
          // Usar el mensaje de error del servidor si está disponible
          errorMessage = err.response.data.message || err.message || errorMessage;
        }
        
        console.log('⚠️ [ResultDetail] Mostrando mensaje de error al usuario:', errorMessage);
        
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
        
        // Establecer el mensaje de error
        setError(errorMessage);
        setLoading(false);
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

  // Activar modo edición
  const handleEdit = () => {
    setEditableResult({ ...result });
    setIsEditing(true);
  };

  // Cancelar edición
  const handleCancel = () => {
    setEditableResult(null);
    setIsEditing(false);
  };

  // Guardar cambios
  const handleSave = async () => {
    if (!editableResult) return;
    
    try {
      setIsSaving(true);
      
      // Preparar datos para enviar
      const updateData = {
        status: editableResult.status,
        score: editableResult.score,
        correct_answers: editableResult.correct_answers,
        incorrect_answers: editableResult.incorrect_answers,
        comments: editableResult.comments || ''
      };

      const response = await api.put(`/api/evaluation-results/${id}`, updateData);
      
      if (response.data.success) {
        setResult(response.data.data);
        setIsEditing(false);
        toast.success('Resultado actualizado exitosamente');
      } else {
        throw new Error(response.data.message || 'Error al actualizar el resultado');
      }
    } catch (error) {
      console.error('Error al guardar cambios:', error);
      toast.error(error.response?.data?.message || 'Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
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
              disabled={isSaving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              disabled={isSaving}
            >
              {isSaving ? (
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
            <button 
              onClick={() => navigate('/results', { replace: true })}
              className="btn btn-light btn-sm d-flex align-items-center"
            >
              <ArrowLeft size={16} className="me-1" /> Volver
            </button>
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
                    <p><strong>Grado:</strong> {result.student?.grade || 'N/A'}</p>
                    <p><strong>Curso:</strong> {result.course_name || 'N/A'}</p>
                  </div>
                </div>
                
                <h4>Información del Cuestionario</h4>
                <div className="row mb-4">
                  <div className="col-md-6">
                    <p><strong>Título:</strong> {result.questionnaire_title || result.questionnaire?.title || 'N/A'}</p>
                    <p><strong>Fase:</strong> {result.phase || result.questionnaire?.phase || 'N/A'}</p>
                    <p><strong>ID del Cuestionario:</strong> {result.questionnaire_id || 'N/A'}</p>
                  </div>
                  <div className="col-md-6">
                    <p><strong>Descripción:</strong> {result.questionnaire_description || result.questionnaire?.description || 'Sin descripción'}</p>
                    <p><strong>Puntuación:</strong> {result.score !== undefined ? formatScore(result.score) : 'N/A'}</p>
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
                  </div>
                  <div className="col-md-6">
                    <p><strong>Número de Intento:</strong> {result.attempt?.attempt_number ?? 'No disponible'}</p>
                    <p><strong>Fecha del Intento:</strong> {result.attempt?.attempt_date ? formatDate(result.attempt.attempt_date) : (result.attempt?.completed_at ? formatDate(result.attempt.completed_at) : 'No disponible')}</p>
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
