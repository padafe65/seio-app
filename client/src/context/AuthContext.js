// frontend-rifa/src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || null);
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || null);
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Verificar si el token ha expirado
  const isTokenExpired = (token) => {
    if (!token) return true;
    
    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  };

  // Función para verificar token (exportada para uso externo)
  const verifyToken = async () => {
    console.log("🔄 Verificando token desde función externa...");
    
    if (!authToken) {
      console.log("❌ No hay token para verificar");
      return false;
    }
    
    if (isTokenExpired(authToken)) {
      console.log("❌ Token expirado");
      logout();
      return false;
    }
    
    try {
      const config = {
        headers: { Authorization: `Bearer ${authToken}` }
      };
      
      await axios.get(`${API_URL}/api/auth/verify`, config);
      console.log("✅ Token verificado correctamente");
      return true;
    } catch (error) {
      console.error("❌ Error al verificar token:", error);
      logout();
      return false;
    }
  };

  // Verificar token al cargar la aplicación
  useEffect(() => {
    const checkTokenOnLoad = async () => {
      console.log("🔄 Verificando token al iniciar...");
      
      // Si no hay token o está expirado, hacer logout
      if (!authToken || isTokenExpired(authToken)) {
        console.log("❌ Token inválido o expirado");
        logout();
        setIsAuthReady(true);
        return;
      }
      
      // Verificar token con el backend
      try {
        const config = {
          headers: { Authorization: `Bearer ${authToken}` }
        };
        
        await axios.get(`${API_URL}/api/auth/verify`, config);
        console.log("✅ Token verificado correctamente");
        
        // Si el token es válido, restaurar usuario
        const storedUser = localStorage.getItem("user");
        if (storedUser && !user) {
          setUser(JSON.parse(storedUser));
          console.log("✅ Usuario restaurado desde localStorage");
        }
      } catch (error) {
        console.error("❌ Error al verificar token:", error);
        logout();
      } finally {
        setIsAuthReady(true);
      }
    };
    
    checkTokenOnLoad();
  }, [authToken, user]);

  useEffect(() => {
    if (authToken) {
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userRole', userRole);
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem("user");
      localStorage.removeItem('user_id');
      localStorage.removeItem('temp_user_id');
      localStorage.removeItem('is_teacher_registration');
    }
  }, [authToken, userRole, user]);

  const login = async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, credentials);
      console.log('📄 Respuesta del servidor:', response.data);
      
      // Extraer token y datos del usuario de la respuesta
      // Manejar tanto 'user' como 'usuario' para compatibilidad
      const { token, user: userData, usuario: userDataAlt } = response.data;
      
      // Usar userData si está disponible, de lo contrario usar userDataAlt (usuario)
      const userDataFinal = userData || userDataAlt;
      
      // Si no hay token o datos de usuario, mostrar error
      if (!token || !userDataFinal) {
        console.error('❌ Formato de respuesta inesperado:', response.data);
        return false;
      }
      
      // Para depuración
      console.log('Datos del usuario recibidos:', userDataFinal);
      
      // Crear objeto de usuario con los datos necesarios
      const userToStore = {
        id: userDataFinal.id,
        name: userDataFinal.name,
        email: userDataFinal.email,
        role: userDataFinal.role,
        phone: userDataFinal.phone || null,
        estado: userDataFinal.estado || 1
      };
      
      // Si es docente, asegurarnos de que tenga un teacher_id
      if (userDataFinal.role === 'docente') {
        // Buscar el teacher_id en varios lugares posibles de la respuesta
        const teacherId = userDataFinal.teacher_id || 
                         response.data.teacher_id || 
                         (response.data.user && response.data.user.teacher_id) ||
                         (response.data.usuario && response.data.usuario.teacher_id);
        
        if (teacherId) {
          userToStore.teacher_id = teacherId;
          console.log('✅ ID del docente obtenido:', userToStore.teacher_id);
        } else {
          console.warn('⚠️ No se encontró el ID del docente, intentando obtenerlo del backend...');
          try {
            // Intentar obtener el ID del docente desde el endpoint específico
            const teacherResponse = await axios.get(
              `${API_URL}/api/teachers/by-user/${userDataFinal.id}`, 
              { 
                headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                } 
              }
            );
            
            // El endpoint devuelve { success: true, data: { id: ... } } o directamente { id: ... }
            const teacherId = teacherResponse.data?.data?.id || teacherResponse.data?.id;
            if (teacherId) {
              userToStore.teacher_id = teacherId;
              console.log('✅ ID del docente obtenido del endpoint específico:', userToStore.teacher_id);
            } else {
              // Si no existe, intentar crearlo
              console.warn('⚠️ No se encontró el registro del docente, intentando crearlo...');
              const createResponse = await axios.post(
                `${API_URL}/api/teacher/create-for-user/${userDataFinal.id}`,
                {},
                { 
                  headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  } 
                }
              );
              
              // El endpoint devuelve { success: true, teacher_id: ... }
              if (createResponse.data && createResponse.data.success && createResponse.data.teacher_id) {
                userToStore.teacher_id = createResponse.data.teacher_id;
                console.log('✅ Nuevo registro de docente creado con ID:', userToStore.teacher_id);
              } else {
                console.error('❌ Formato de respuesta inesperado:', createResponse.data);
                throw new Error('No se pudo crear el registro del docente');
              }
            }
          } catch (error) {
            console.error('❌ Error al obtener/crear el ID del docente:', error);
            // Aún así permitir el inicio de sesión, pero marcar que no hay teacher_id
            userToStore.teacher_id = null;
          }
        }
      }
      
      // Guardar el token y los datos del usuario
      setAuthToken(token);
      setUserRole(userToStore.role);
      setUser(userToStore);
      
      // Guardar en localStorage para persistencia
      localStorage.setItem('user', JSON.stringify(userToStore));
      
      console.log('✅ Usuario autenticado:', userToStore);
      return userToStore;
    } catch (error) {
      console.error('❌ Error en login:', error);
      if (error.response) {
        console.error('📌 Detalles del error:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      }
      return false;
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUserRole(null);
    setUser(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("user");
    localStorage.removeItem('user_id');
    localStorage.removeItem('temp_user_id');
    localStorage.removeItem('is_teacher_registration');
  };

  return (
    <AuthContext.Provider value={{ 
      authToken, 
      userRole, 
      user, 
      login, 
      logout, 
      isAuthReady,
      verifyToken // Exportando la función verifyToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
