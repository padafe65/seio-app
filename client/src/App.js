// App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import Navbar from './components/Navbar.js';
import Login from './pages/Login.js';
import Registro from './pages/Registro.js';
import Admin from './pages/Admin.js';
import './styles/styles.css';
import ResetPassword from './pages/ResetPassword.js';
import CompleteStudent from './components/CompleteStudent.js';
import CompleteTeacher from './components/CompleteTeacher.js';
import Dashboard from './pages/Dashboard.js';
import CreateQuestionForm from './components/CreateQuestionForm.js';
import CreateQuestionPage from './pages/CreateQuestionPage.js';
import StudentDashboardPage from './pages/StudentDashboardPage.js';
import TakeQuizPage from './pages/TakeQuizPage.js';
import ResultsPage from './pages/ResultsPage.js';
import IndicatorsPage from './pages/IndicatorsPage.js';
import ImprovementPage from './pages/ImprovementPage.js';

// Nuevas páginas para CRUD
import StudentsList from './pages/students/StudentsList.js';
import StudentForm from './pages/students/StudentForm.js';
import StudentDetail from './pages/students/StudentDetail.js';
import IndicatorsList from './pages/indicators/IndicatorsList.js';
import IndicatorForm from './pages/indicators/IndicatorForm.js';
import ResultsList from './pages/results/ResultsList.js';
import QuestionnairesList from './pages/questionnaires/QuestionnairesList.js';
import QuestionnaireForm from './pages/questionnaires/QuestionnaireForm.js';

// Componente de ruta protegida
function ProtectedRoute({ children }) {
  const { authToken } = useAuth();
  if (!authToken) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Componente para mostrar indicador de carga mientras se inicializa la autenticación
function AppContent() {
  const { user, authToken } = useAuth();
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  useEffect(() => {
    // Simular verificación de autenticación
    const checkAuth = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsAuthReady(true);
    };
    
    checkAuth();
  }, []);
  
  if (!isAuthReady) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Inicializando aplicación...</span>
        </div>
      </div>
    );
  }

  // Componente Layout para rutas protegidas con Sidebar para docentes
  function TeacherDashboardLayout() {
    return (
      <div className="d-flex">
        <div className="sidebar bg-dark text-white" style={{ width: '250px', height: '100vh', position: 'fixed', left: 0, top: '56px', overflowY: 'auto' }}>
          <div className="p-3">
            <h5 className="mb-3">Panel de Control</h5>
            <ul className="nav flex-column">
              <li className="nav-item mb-2">
                <a href="/dashboard" className="nav-link text-white">Dashboard</a>
              </li>
              <li className="nav-item mb-2">
                <a href="/estudiantes" className="nav-link text-white">Estudiantes</a>
              </li>
              <li className="nav-item mb-2">
                <a href="/cuestionarios" className="nav-link text-white">Cuestionarios</a>
              </li>
              <li className="nav-item mb-2">
                <a href="/indicadores" className="nav-link text-white">Indicadores</a>
              </li>
              <li className="nav-item mb-2">
                <a href="/resultados" className="nav-link text-white">Resultados</a>
              </li>
              <li className="nav-item mb-2">
                <a href="/crear-pregunta" className="nav-link bg-primary text-white">Crear Pregunta</a>
              </li>
            </ul>
          </div>
        </div>
        <div style={{ marginLeft: '250px', width: 'calc(100% - 250px)', padding: '20px', marginTop: '56px' }}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/crear-pregunta" element={<CreateQuestionPage />} />
            
            {/* Rutas para estudiantes */}
            <Route path="/estudiantes" element={<StudentsList />} />
            <Route path="/estudiantes/nuevo" element={<StudentForm />} />
            <Route path="/estudiantes/:id" element={<StudentDetail />} />
            <Route path="/estudiantes/:id/editar" element={<StudentForm />} />
            
            {/* Rutas para indicadores */}
            <Route path="/indicadores" element={<IndicatorsList />} />
            <Route path="/indicadores/nuevo" element={<IndicatorForm />} />
            <Route path="/indicadores/:id/editar" element={<IndicatorForm />} />
            
            {/* Rutas para resultados */}
            <Route path="/resultados" element={<ResultsList />} />

            {/* Rutas para cuestionarios */}
            <Route path="/cuestionarios" element={<QuestionnairesList />} />
            <Route path="/cuestionarios/nuevo" element={<QuestionnaireForm />} />
            <Route path="/cuestionarios/:id/editar" element={<QuestionnaireForm />} />
            <Route path="/cuestionarios/:id/preguntas" element={<CreateQuestionPage />} />
          </Routes>
        </div>
      </div>
    );
  }

  // Componente Layout para rutas de estudiante
  function StudentDashboardLayout() {
    return (
      <div className="d-flex">
        <div className="sidebar bg-dark text-white" style={{ width: '250px', height: '100vh', position: 'fixed', left: 0, top: '56px', overflowY: 'auto' }}>
          <div className="p-3">
            <h5 className="mb-3">Panel de Estudiante</h5>
            <ul className="nav flex-column">
              <li className="nav-item mb-2">
                <a href="/student/dashboard" className="nav-link text-white">Dashboard</a>
              </li>
              <li className="nav-item mb-2">
                <a href="/student/take-quiz" className="nav-link text-white">Evaluaciones</a>
              </li>
              <li className="nav-item mb-2">
                <a href="/student/results" className="nav-link text-white">Resultados</a>
              </li>
              <li className="nav-item mb-2">
                <a href="/student/indicators" className="nav-link text-white">Indicadores</a>
              </li>
              <li className="nav-item mb-2">
                <a href="/student/improvement" className="nav-link text-white">Plan de Mejora</a>
              </li>
            </ul>
          </div>
        </div>
        <div style={{ marginLeft: '250px', width: 'calc(100% - 250px)', padding: '20px', marginTop: '56px' }}>
          <Routes>
            <Route path="/dashboard" element={<StudentDashboardPage />} />
            <Route path="/take-quiz" element={<TakeQuizPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/indicators" element={<IndicatorsPage />} />
            <Route path="/improvement" element={<ImprovementPage />} />
          </Routes>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Navbar />
      <Routes>
        {/* Rutas públicas */}
        <Route path="/" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/CompleteStudent" element={<CompleteStudent />} />
        <Route path="/CompleteTeacher" element={<CompleteTeacher />} />
        
        {/* Rutas de admin */}
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        
        {/* Rutas de docente con sidebar */}
        <Route path="/*" element={
          <ProtectedRoute>
            {user && user.role === 'docente' ? <TeacherDashboardLayout /> : null}
          </ProtectedRoute>
        } />
        
        {/* Rutas de estudiante con sidebar */}
        <Route path="/student/*" element={
          <ProtectedRoute>
            {user && user.role === 'estudiante' ? <StudentDashboardLayout /> : null}
          </ProtectedRoute>
        } />
        
        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
