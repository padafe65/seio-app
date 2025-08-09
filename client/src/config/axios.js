import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Crear una instancia de Axios
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token de autenticación a cada solicitud
api.interceptors.request.use(
  async (config) => {
    console.log('🔑 [Axios] Configurando solicitud a:', config.url);
    
    // No modificar la solicitud si es una solicitud de autenticación
    if (config.url && (config.url.includes('/api/auth/') || config.url.includes('/login'))) {
      console.log('🔐 [Axios] Solicitando autenticación, omitiendo token');
      return config;
    }
    
    const token = localStorage.getItem('authToken');
    
    if (token) {
      try {
        // Verificar si el token está a punto de expirar (en los próximos 5 minutos)
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const now = Date.now() / 1000; // Tiempo actual en segundos
        
        console.log('🔑 [Axios] Token expira en:', (tokenPayload.exp - now).toFixed(0), 'segundos');
        
        // Si el token expira en menos de 5 minutos, intentar renovarlo
        if (tokenPayload.exp && (tokenPayload.exp - now) < 300) {
          console.log('🔄 [Axios] El token está a punto de expirar, intentando renovar...');
          // No hacemos nada aquí, dejamos que el interceptor de respuesta maneje la renovación
        }
        
        // Agregar el token al encabezado
        config.headers.Authorization = `Bearer ${token}`;
        console.log('🔑 [Axios] Token agregado a la solicitud');
        
      } catch (e) {
        console.error('❌ [Axios] Error al verificar el token:', e);
        // Si hay un error al verificar el token, lo eliminamos para forzar un nuevo inicio de sesión
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        // Redirigir al login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?error=session_expired';
        }
        
        return Promise.reject(new Error('Token inválido'));
      }
    } else {
      console.warn('⚠️ [Axios] No se encontró token de autenticación');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?error=no_token';
      }
      return Promise.reject(new Error('No autenticado'));
    }
    
    // Agregar encabezados comunes
    config.headers['Content-Type'] = 'application/json';
    config.headers['Accept'] = 'application/json';
    
    return config;
  },
  (error) => {
    console.error('Error en la solicitud:', error);
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas de error
export const setupResponseInterceptor = (navigate) => {
  console.log('🔄 Configurando interceptor de respuestas de Axios');
  
  // Eliminar cualquier interceptor existente para evitar duplicados
  if (api.interceptors.response.handlers) {
    console.log('🧹 Limpiando interceptores de respuesta existentes');
    api.interceptors.response.handlers = [];
  }
  
  return api.interceptors.response.use(
    (response) => {
      // Si la respuesta es exitosa, simplemente la retornamos
      console.log('✅ [Axios] Respuesta exitosa:', {
        url: response.config.url,
        status: response.status,
        data: response.data ? 'Datos recibidos' : 'Sin datos'
      });
      return response;
    },
    async (error) => {
      // Si no hay respuesta del servidor, podría ser un error de red
      if (!error.response) {
        console.error('❌ [Axios] Error de red:', error.message);
        return Promise.reject({
          isNetworkError: true,
          message: 'No se pudo conectar al servidor. Verifica tu conexión a internet.'
        });
      }

      const originalRequest = error.config;
      console.error('❌ [Axios] Error en la respuesta:', {
        url: originalRequest.url,
        status: error.response.status,
        statusText: error.response.statusText,
        method: originalRequest.method.toUpperCase(),
        isRetry: !!originalRequest._retry
      });
      
      // Si el error es 401 (No autorizado) y no es una solicitud de renovación de token
      if (error.response.status === 401 && !originalRequest._retry) {
        // Si es una solicitud a la API de autenticación, no intentar renovar
        if (originalRequest.url.includes('/api/auth/')) {
          console.log('🔐 [Axios] Error de autenticación en endpoint de autenticación');
          
          // Limpiar credenciales locales
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          
          // Redirigir al login si no estamos ya en esa página
          if (window.location.pathname !== '/login') {
            console.log('🔄 [Axios] Redirigiendo a /login desde interceptor');
            navigate('/login', { 
              replace: true, 
              state: { 
                from: window.location.pathname,
                error: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
              } 
            });
          }
          
          return Promise.reject({
            isAuthError: true,
            message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
          });
        }
        
        // Marcar como reintentado
        originalRequest._retry = true;
        
        try {
          // Intentar renovar el token si es posible
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            console.log('🔄 [Axios] Intentando renovar el token de acceso...');
            
            // Usar axios directamente para evitar el interceptor
            const response = await axios({
              method: 'post',
              url: `${API_URL}/api/auth/refresh-token`,
              data: { refreshToken },
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              // Evitar redirecciones automáticas
              maxRedirects: 0,
              validateStatus: null
            });
            
            console.log('🔄 [Axios] Respuesta de renovación de token:', {
              status: response.status,
              data: response.data ? 'Datos recibidos' : 'Sin datos'
            });
            
            if (response.status === 200 && response.data.token) {
              const { token, user } = response.data;
              console.log('✅ [Axios] Token renovado exitosamente');
              
              // Actualizar el token en el almacenamiento local
              localStorage.setItem('authToken', token);
              if (user) {
                localStorage.setItem('user', JSON.stringify(user));
              }
              
              // Actualizar el encabezado de autorización
              originalRequest.headers.Authorization = `Bearer ${token}`;
              
              console.log('🔄 [Axios] Reintentando solicitud original:', originalRequest.url);
              // Reintentar la solicitud original con el nuevo token
              return api(originalRequest);
            } else {
              console.warn('⚠️ [Axios] No se pudo renovar el token:', response.data?.message || 'Error desconocido');
              throw new Error('No se pudo renovar la sesión');
            }
          }
        } catch (refreshError) {
          console.error('❌ [Axios] Error al renovar el token:', refreshError);
          
          // Limpiar credenciales locales
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          
          // Redirigir al login si no estamos ya en esa página
          if (window.location.pathname !== '/login') {
            console.log('🔄 [Axios] Redirigiendo a /login desde error de renovación de token');
            navigate('/login', { 
              replace: true, 
              state: { 
                from: window.location.pathname,
                error: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
              } 
            });
          }
          
          return Promise.reject({
            isAuthError: true,
            message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
          });
        }
        
        // Si llegamos aquí, no se pudo renovar el token o no hay refreshToken
        console.log('No se pudo renovar el token, cerrando sesión...');
        
        // Limpiar datos de autenticación
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        localStorage.removeItem('teacherId');
        
        // Redirigir al login solo si no estamos ya en la página de login
        if (navigate && window.location.pathname !== '/login') {
          console.log('Redirigiendo a la página de login...');
          navigate('/login', { 
            state: { 
              message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
              from: window.location.pathname 
            },
            replace: true
          });
        }
      }
      
      // Manejar otros códigos de error
      switch (error.response.status) {
        case 403:
          console.warn('⛔ [Axios] Acceso denegado (403) para:', originalRequest.url);
          error.message = 'No tienes permiso para acceder a este recurso.';
          error.isForbidden = true;
          break;
          
        case 404:
          console.warn('🔍 [Axios] Recurso no encontrado (404):', originalRequest.url);
          error.message = 'El recurso solicitado no fue encontrado.';
          error.isNotFound = true;
          break;
          
        case 500:
          console.error('💥 [Axios] Error interno del servidor (500)');
          error.message = 'Ocurrió un error en el servidor. Por favor, inténtalo de nuevo más tarde.';
          error.isServerError = true;
          break;
          
        default:
          console.error(`⚠️ [Axios] Error ${error.response.status}:`, error.message);
          error.message = error.response.data?.message || `Error en la solicitud: ${error.response.status} ${error.response.statusText}`;
      }
      
      // Agregar información adicional al error
      error.responseData = error.response.data;
      error.requestUrl = originalRequest.url;
      error.requestMethod = originalRequest.method;
      
      // Para errores de autenticación que no se manejaron antes
      if (error.response.status === 401) {
        error.isAuthError = true;
        error.message = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
        
        // Limpiar credenciales locales
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        // Redirigir al login si no estamos ya en esa página
        if (window.location.pathname !== '/login') {
          console.log('🔄 [Axios] Redirigiendo a /login desde manejo de error 401');
          navigate('/login', { 
            replace: true, 
            state: { 
              from: window.location.pathname,
              error: error.message
            } 
          });
        }
      }

      // Rechazar la promesa con el error mejorado
      return Promise.reject(error);
    }
  );
};

export default api;
