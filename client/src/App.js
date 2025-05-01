// frontend-rifa/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import Navbar from './components/Navbar.js';
import Login from './pages/Login.js';
import Registro from './pages/Registro.js';
import Admin from './pages/Admin';
import './styles/styles.css';
import ResetPassword from './pages/ResetPassword.js';
import CompleteStudent from './components/CompleteStudent.js';
import CompleteTeacher from './components/CompleteTeacher.js';
import Dashboard from './pages/Dashboard.js';
import CreateQuestionForm from './components/CreateQuestionForm.js'; // o './pages/' según donde esté
import CreateQuestionPage from './pages/CreateQuestionPage.js'; // Ajusta según tu estructura
import StudentDashboardPage from '../src/pages/StudentDashboardPage.js';
import TakeQuizPage from '../src/pages/TakeQuizPage.js';
import ResultsPage from '../src/pages/ResultsPage.js';
import IndicatorsPage from '../src/pages/IndicatorsPage.js';
import ImprovementPage from '../src/pages/ImprovementPage.js';


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
            <Route path="/student/dashboard" element={<StudentDashboardPage />} />
            <Route path="/student/take-quiz" element={<TakeQuizPage />} />
            <Route path="/student/results" element={<ResultsPage />} />
            <Route path="/student/indicators" element={<IndicatorsPage />} />
            <Route path="/student/improvement" element={<ImprovementPage />} />


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
