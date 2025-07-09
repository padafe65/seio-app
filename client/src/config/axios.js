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
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas de error
export const setupResponseInterceptor = (navigate) => {
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        // Manejar errores específicos de autenticación
        if (error.response.status === 401) {
          // Token expirado o inválido
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          localStorage.removeItem('userRole');
          localStorage.removeItem('teacherId');
          
          // Redirigir al login
          if (navigate) {
            navigate('/login', { 
              state: { 
                message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
                from: window.location.pathname 
              } 
            });
          }
        }
      }
      return Promise.reject(error);
    }
  );
};

export default api;
