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
  const [teacherId, setTeacherId] = useState(localStorage.getItem('teacherId') || null);
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
      console.log(" Verificando token al iniciar...");
      
      // Si no hay token o está expirado, hacer logout
      if (!authToken || isTokenExpired(authToken)) {
        console.log(" Token inválido o expirado");
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
        console.log(" Token verificado correctamente");
        
        // Si el token es válido, restaurar usuario
        const storedUser = localStorage.getItem("user");
        if (storedUser && !user) {
          setUser(JSON.parse(storedUser));
          console.log(" Usuario restaurado desde localStorage");
        }
      } catch (error) {
        console.error(" Error al verificar token:", error);
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
      localStorage.removeItem('teacherId');
      localStorage.removeItem('user_id');
      localStorage.removeItem('temp_user_id');
      localStorage.removeItem('is_teacher_registration');
    }
  }, [authToken, userRole, user]);

  useEffect(() => {
    if (teacherId) {
      localStorage.setItem('teacherId', teacherId);
    } else {
      localStorage.removeItem('teacherId');
    }
  }, [teacherId]);

  const login = async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, credentials);
      setAuthToken(response.data.token);
      setUserRole(response.data.usuario.role);
      setUser(response.data.usuario);
      if (response.data.usuario.teacher_id) {
        setTeacherId(response.data.usuario.teacher_id);
      }
      console.log("✅ Usuario almacenado en AuthContext:", response.data.usuario);
      return response.data.usuario;
    } catch (error) {
      console.error('Error en login:', error);
      return false;
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUserRole(null);
    setUser(null);
    setTeacherId(null);
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
      teacherId,
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
