// frontend-rifa/src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

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
      const response = await axios.post('http://localhost:5000/api/auth/login', credentials);
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
