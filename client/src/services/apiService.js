import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
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

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh the token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );
        
        const { token } = response.data;
        localStorage.setItem('authToken', token);
        
        // Update the authorization header
        originalRequest.headers.Authorization = `Bearer ${token}`;
        
        // Retry the original request
        return api(originalRequest);
      } catch (error) {
        // If refresh token fails, log the user out
        if (error.response?.status === 401) {
          // Use the logout function from AuthContext
          const { logout } = useAuth();
          logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

// API methods
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => 
    api.post('/auth/reset-password', { token, newPassword }),
  refreshToken: () => api.post('/auth/refresh-token'),
};

export const studentAPI = {
  getAll: () => api.get('/students'),
  getById: (id) => api.get(`/students/${id}`),
  create: (studentData) => {
    const formData = new FormData();
    Object.keys(studentData).forEach(key => {
      formData.append(key, studentData[key]);
    });
    return api.post('/students', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  update: (id, studentData) => {
    const formData = new FormData();
    Object.keys(studentData).forEach(key => {
      formData.append(key, studentData[key]);
    });
    return api.patch(`/students/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  delete: (id) => api.delete(`/students/${id}`),
  getStats: (id) => api.get(`/students/${id}/stats`),
  getByTeacher: (teacherId) => api.get(`/students/teacher/${teacherId}`),
};

export const teacherAPI = {
  getAll: () => api.get('/teachers'),
  getById: (id) => api.get(`/teachers/${id}`),
  getStudents: (teacherId) => api.get(`/teachers/${teacherId}/students`),
};

export const courseAPI = {
  getAll: () => api.get('/courses'),
  getById: (id) => api.get(`/courses/${id}`),
  create: (courseData) => api.post('/courses', courseData),
  update: (id, courseData) => api.patch(`/courses/${id}`, courseData),
  delete: (id) => api.delete(`/courses/${id}`),
};

export const questionnaireAPI = {
  getAll: () => api.get('/questionnaires'),
  getById: (id) => api.get(`/questionnaires/${id}`),
  create: (questionnaireData) => api.post('/questionnaires', questionnaireData),
  update: (id, questionnaireData) => api.patch(`/questionnaires/${id}`, questionnaireData),
  delete: (id) => api.delete(`/questionnaires/${id}`),
  getQuestions: (questionnaireId) => api.get(`/questionnaires/${questionnaireId}/questions`),
};

export const questionAPI = {
  create: (questionData) => api.post('/questions', questionData),
  update: (id, questionData) => api.patch(`/questions/${id}`, questionData),
  delete: (id) => api.delete(`/questions/${id}`),
};

export const evaluationAPI = {
  submit: (evaluationData) => api.post('/evaluations', evaluationData),
  getResults: (studentId) => api.get(`/evaluations/results/${studentId}`),
  getImprovementPlan: (studentId) => api.get(`/improvement-plans/student/${studentId}`),
};

export default api;
