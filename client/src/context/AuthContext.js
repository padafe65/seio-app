// frontend-rifa/src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || null);
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || null);
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  useEffect(() => {
    console.log("🔄 Cargando usuario desde localStorage...");
    const storedUser = localStorage.getItem("user");
    if (storedUser && !user) {
      setUser(JSON.parse(storedUser));
      console.log("✅ Usuario restaurado desde localStorage:", JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (authToken) {
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userRole', userRole);
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem("user");
    }
  }, [authToken, userRole, user]);

  const login = async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, credentials);
      setAuthToken(response.data.token);
      setUserRole(response.data.role);
      setUser(response.data.usuario); // Asegúrate que tu API devuelve "usuario"
      console.log("✅ Usuario almacenado en AuthContext:", response.data.usuario);
      return true;
    } catch (error) {
      console.error('Error en login:', error);
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
  };

  return (
    <AuthContext.Provider value={{ authToken, userRole, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
