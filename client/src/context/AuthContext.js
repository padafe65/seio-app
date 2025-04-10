// frontend-rifa/src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const AuthContext = createContext();

const login = async (datos) => {
  try {
    console.log("API_URL:", API_URL);
    const res = await axios.post(`${API_URL}/api/auth/login`, datos, { withCredentials: true });
    // ...
  } catch (error) {
    console.error("Error en login:", error);
  }
};


export const AuthProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || null);
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || null);
  const [usuario, setUsuario] = useState(() => {
    const storedUser = localStorage.getItem("usuario");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  useEffect(() => {
    console.log("🔄 Cargando usuario desde localStorage...");
    const storedUser = localStorage.getItem("usuario");
    if (storedUser && !usuario) {
        setUsuario(JSON.parse(storedUser));
        console.log("✅ Usuario restaurado desde localStorage:", JSON.parse(storedUser));
    }
}, []);

  useEffect(() => {
    if (authToken) {
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userRole', userRole);
      localStorage.setItem("usuario", JSON.stringify(usuario)); // Guardamos el usuario
    } else {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem("usuario");
    }
  }, [authToken, userRole, usuario]);

  const login = async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, credentials);
      setAuthToken(response.data.token);
      setUserRole(response.data.role);
      setUsuario(response.data.usuario); // Guardamos el usuario
      console.log("✅ Usuario almacenado en AuthContext:", response.data.usuario); // VERIFICAR SI SE ESTÁ GUARDANDO
      return true;
    } catch (error) {
      console.error('Error en login:', error);
      return false;
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUserRole(null);
    setUsuario(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("usuario");
  };

  return (
    <AuthContext.Provider value={{ authToken, userRole, usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);