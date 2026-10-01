// src/api/axiosClient.js
import axios from "axios";

const configuredApiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
const API_URL = configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '');

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
    // Compatibilidad con pantallas que aún incluyen /api en el endpoint.
    if (config.url && /^\/api(?:\/|$)/.test(config.url)) {
      config.url = config.url.replace(/^\/api/, '') || '/';
    }
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

      // 🔒 Suscripción vencida
      if (
        error.response.status === 403 &&
        (
          error.response.data?.code === 'SUBSCRIPTION_EXPIRED' ||
          error.response.data?.code === 'NO_SUBSCRIPTION'
        )
      ) {
        if (window.location.pathname !== '/subscription-expired') {
          window.location.href = '/subscription-expired';
        }
      }

      // 🔐 Token inválido
      if (error.response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');

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
