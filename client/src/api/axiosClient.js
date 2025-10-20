// src/api/axiosClient.js
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const axiosClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Interceptor para añadir el token a las peticiones
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
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
try {
  axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        // Manejar errores específicos de autenticación
        if (error.response.status === 401) {
          // Si el token es inválido o ha expirado
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          localStorage.removeItem('userRole');
          
          // Redirigir al login si no estamos ya en esa página
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      }
      return Promise.reject(error);
    }
  );
} catch (e) {
  console.error('Error al configurar interceptor de respuesta:', e);
}

export default axiosClient;
