// frontend-rifa/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Admin from './pages/Admin';
import './styles/styles.css';
import ResetPassword from './pages/ResetPassword';
import CompleteStudent from './components/CompleteStudent';
import CompleteTeacher from './components/CompleteTeacher';
import Dashboard from './pages/Dashboard';
import CreateQuestionForm from './components/CreateQuestionForm.js'; // o './pages/' según donde esté
import CreateQuestionPage from './pages/CreateQuestionPage.js'; // Ajusta según tu estructura


// Componente de ruta protegida
function ProtectedRoute({ children }) {
  const { authToken } = useAuth();
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
            <Route path="/CompleteStudent" element={<CompleteStudent />} />
            <Route path="/CompleteTeacher" element={<CompleteTeacher />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/crear-pregunta" element={<CreateQuestionPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/crear-pregunta"
              element={
                <ProtectedRoute>
                  <CreateQuestionForm />
                </ProtectedRoute>
              }
            />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
