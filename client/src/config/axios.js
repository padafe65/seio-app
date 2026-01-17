import axios from 'axios';

// Asegurar que baseURL siempre termine con /api
const getBaseURL = () => {
  const envURL = process.env.REACT_APP_API_URL;
  if (envURL) {
    // Si ya tiene /api, dejarlo así; si no, agregarlo
    return envURL.endsWith('/api') ? envURL : `${envURL}/api`;
  }
  return 'http://localhost:5000/api';
};

const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Debug: Verificar el baseURL configurado
console.log('🔧 [axios] baseURL configurado:', axiosInstance.defaults.baseURL);

// Add a request interceptor to include the auth token
axiosInstance.interceptors.request.use(
  (config) => {
    // Intentar obtener token de 'authToken' primero (estándar del sistema), luego 'token'
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Debug: Log la URL completa que se está construyendo
    const fullUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
    console.log('🌐 [axios] Petición:', config.method?.toUpperCase(), fullUrl);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle common errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle common HTTP errors
      if (error.response.status === 401) {
        // Handle unauthorized access
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
