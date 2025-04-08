// frontend-rifa/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Rifa from './pages/Rifa';
import Admin from './pages/Admin';
import './styles/styles.css';
import ResetPassword from './pages/ResetPassword';

// Componente de ruta protegida
function ProtectedRoute({ children }) {
  const { authToken } = useAuth();
  // Si no hay token, redirige al login
  if (!authToken) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <div className="container">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            <Route
              path="/rifa"
              element={
                <ProtectedRoute>
                  <Rifa />
                </ProtectedRoute>
              }
            />
            <Route path="/admin" element={
                  <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
