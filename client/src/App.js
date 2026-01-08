// App.js
import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Offcanvas } from 'react-bootstrap';
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
import CreateQuestionPage from './pages/CreateQuestionPage.js';
import StudentDashboardPage from './pages/StudentDashboardPage.js';
import TakeQuizPage from './pages/TakeQuizPage.js';
import ResultsPage from './pages/ResultsPage.js';
import ImprovementPage from './pages/ImprovementPage.js';
import SubjectCategoryForm from './pages/subjects/SubjectCategoryForm.js';
import PhaseEvaluation from './pages/phase-evaluation/PhaseEvaluation';
import EditarPreguntas from './components/EditarPreguntas.js';
import { useIdleTimer } from 'react-idle-timer';
import Swal from 'sweetalert2';

// Importar iconos de Lucide React
import { 
  Home, Users, FileText, BarChart2, 
  PlusCircle, CheckSquare, Award, Settings, Menu, BookOpen 
} from 'lucide-react';

// Nuevas páginas para CRUD
import StudentsList from './pages/students/StudentsList.js';
import StudentForm from './pages/students/StudentForm.js';
import StudentDetail from './pages/students/StudentDetail.js';
import IndicatorsList from './pages/indicators/IndicatorsList.js';
import IndicatorForm from './pages/indicators/IndicatorForm.js';
import ResultsList from './pages/results/ResultsList.js';
import ResultDetail from './pages/results/ResultDetail.js';
import QuestionnairesList from './pages/questionnaires/QuestionnairesList.js';
import QuestionnaireForm from './pages/questionnaires/QuestionnaireForm.js';
import TeacherStudentsList from './pages/students/TeacherStudentsList';
import StudentGrades from './pages/students/StudentGrades';
import StudentIndicators from './pages/indicators/StudentIndicators';
import ImprovementPlansList from './pages/improvement-plans/ImprovementPlansList.js';
import ImprovementPlanForm from './pages/improvement-plans/ImprovementPlanForm.js';
import ImprovementPlanDetail from './pages/improvement-plans/ImprovementPlanDetail.js';
import ImprovementPlanDetailEnhanced from './pages/improvement-plans/ImprovementPlanDetailEnhanced.js';
import TeacherCoursesManager from './pages/courses/TeacherCoursesManager';
import AutomaticImprovementPlansManager from './components/AutomaticImprovementPlansManager.js';

// Componente para el temporizador de inactividad
function IdleTimerContainer() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const idleTimerRef = useRef(null);
  
  // Tiempo de inactividad: 15 minutos (en milisegundos)
  const timeout = 1000 * 60 * 15;
  
  // Tiempo para mostrar advertencia: 1 minuto antes de logout
  const promptBeforeIdle = 1000 * 60;
  
  const onPrompt = () => {
    // Mostrar advertencia cuando quede 1 minuto
    Swal.fire({
      title: '¿Sigues ahí?',
      text: 'Tu sesión está a punto de expirar por inactividad.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Mantener sesión',
      cancelButtonText: 'Cerrar sesión',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#d33',
      timer: promptBeforeIdle,
      timerProgressBar: true
    }).then((result) => {
      if (result.isConfirmed) {
        // Usuario quiere continuar
        idleTimerRef.current.reset();
      } else {
        // Usuario eligió cerrar sesión o el tiempo expiró
        handleLogout();
      }
    });
  };
  
  const onIdle = () => {
    // Ejecutar logout cuando se alcanza el tiempo de inactividad
    handleLogout();
  };
  
  const handleLogout = () => {
    Swal.fire({
      title: 'Sesión expirada',
      text: 'Tu sesión ha expirado por inactividad.',
      icon: 'info',
      confirmButtonColor: '#3085d6',
      timer: 3000,
      timerProgressBar: true
    }).then(() => {
      logout();
      navigate('/');
    });
  };
  
  // eslint-disable-next-line no-unused-vars
  const idleTimer = useIdleTimer({
    ref: idleTimerRef,
    timeout,
    promptBeforeIdle,
    onPrompt,
    onIdle,
    debounce: 500
  });
  
  return null; // Este componente no renderiza nada visible
}

// Componente de ruta protegida
function ProtectedRoute({ children }) {
  const { authToken, isAuthReady, verifyToken } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  
  useEffect(() => {
    const checkToken = async () => {
      if (authToken) {
        await verifyToken();
      }
      setIsVerifying(false);
    };
    
    checkToken();
  }, [authToken, verifyToken]);
  
  if (isVerifying || !isAuthReady) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }
  
  if (!authToken) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <>
      <IdleTimerContainer />
      {children}
    </>
  );
}

// Componente para mostrar indicador de carga mientras se inicializa la autenticación
function AppContent() {
  const { user, authToken, verifyToken } = useAuth();
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  useEffect(() => {
    // Verificar autenticación al cargar la aplicación
    const checkAuth = async () => {
      if (authToken) {
        await verifyToken();
      }
      setIsAuthReady(true);
    };
    
    checkAuth();
  }, [authToken, verifyToken]);
  
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
    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);
    
    return (
      <div>
        {/* Botón para mostrar sidebar en móviles */}
        <button 
          className="btn btn-dark d-md-none position-fixed" 
          style={{ top: '70px', left: '10px', zIndex: 1030 }} 
          onClick={handleShow}
        >
          <Menu size={20} />
        </button>
        
        {/* Sidebar para pantallas medianas y grandes */}
        <div className="d-none d-md-block sidebar bg-dark text-white" style={{ width: '250px', height: '100vh', position: 'fixed', left: 0, top: '56px', overflowY: 'auto' }}>
          <div className="p-3">
            <h5 className="mb-3">Panel de Control</h5>
            <ul className="nav flex-column">
              <li className="nav-item mb-2">
                <Link to="/dashboard" className="nav-link text-white d-flex align-items-center">
                  <Home size={18} className="me-2" /> Dashboard
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/estudiantes" className="nav-link text-white d-flex align-items-center">
                  <Users size={18} className="me-2" /> Estudiantes
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/mis-estudiantes" className="nav-link text-white d-flex align-items-center">
                  <Users size={18} className="me-2" /> Mis Estudiantes
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/cuestionarios" className="nav-link text-white d-flex align-items-center">
                  <FileText size={18} className="me-2" /> Cuestionarios
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/indicadores" className="nav-link text-white d-flex align-items-center">
                  <CheckSquare size={18} className="me-2" /> Indicadores
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/resultados" className="nav-link text-white d-flex align-items-center">
                  <BarChart2 size={18} className="me-2" /> Resultados
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/planes-mejoramiento" className="nav-link text-white d-flex align-items-center">
                  <Award size={18} className="me-2" /> Planes de Mejoramiento
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/planes-automaticos" className="nav-link text-white d-flex align-items-center">
                  <Settings size={18} className="me-2" /> Sistema Automático
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/evaluacion-fase" className="nav-link text-white d-flex align-items-center">
                  <CheckSquare size={18} className="me-2" /> Evaluación de Fase
                </Link>
              </li>

              <li className="nav-item mb-2">
                <Link to="/mis-cursos" className="nav-link text-white d-flex align-items-center">
                  <BookOpen size={18} className="me-2" /> Mis Cursos
                </Link>
              </li>


              <li className="nav-item mb-2">
                <Link to="/crear-pregunta" className="nav-link bg-primary text-white d-flex align-items-center">
                  <PlusCircle size={18} className="me-2" /> Crear Pregunta
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Offcanvas para móviles */}
        <Offcanvas show={show} onHide={handleClose} className="bg-dark text-white">
          <Offcanvas.Header closeButton className="border-bottom">
            <Offcanvas.Title>Panel de Control</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <ul className="nav flex-column">
              <li className="nav-item mb-2">
                <Link to="/dashboard" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <Home size={18} className="me-2" /> Dashboard
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/estudiantes" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <Users size={18} className="me-2" /> Estudiantes
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/mis-estudiantes" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <Users size={18} className="me-2" /> Mis Estudiantes
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/cuestionarios" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <FileText size={18} className="me-2" /> Cuestionarios
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/indicadores" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <CheckSquare size={18} className="me-2" /> Indicadores
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/resultados" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <BarChart2 size={18} className="me-2" /> Resultados
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/planes-mejoramiento" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <Award size={18} className="me-2" /> Planes de Mejoramiento
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/planes-automaticos" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <Settings size={18} className="me-2" /> Sistema Automático
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/crear-pregunta" className="nav-link bg-primary text-white d-flex align-items-center" onClick={handleClose}>
                  <PlusCircle size={18} className="me-2" /> Crear Pregunta
                </Link>
              </li>
            </ul>
          </Offcanvas.Body>
        </Offcanvas>
        
        {/* Contenido principal */}
        <div style={{ 
          marginLeft: window.innerWidth >= 768 ? '250px' : '0', 
          width: window.innerWidth >= 768 ? 'calc(100% - 250px)' : '100%', 
          padding: '20px', 
          marginTop: '56px' 
        }}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/crear-pregunta" element={<CreateQuestionPage />} />
            <Route path="/preguntas/:id/editar" element={<EditarPreguntas />} />
            {/* Nueva ruta para gestionar materias y categorías */}
            <Route path="/materias-categorias" element={<SubjectCategoryForm />} />
            
            {/* Rutas para estudiantes */}
            <Route path="/estudiantes" element={<StudentsList />} />
            <Route path="/estudiantes/nuevo" element={<StudentForm />} />
            <Route path="/estudiantes/:id" element={<StudentDetail />} />
            <Route path="/estudiantes/:id/editar" element={<StudentForm />} />
            
            {/* Rutas para estudiantes del docente */}
            <Route path="/mis-estudiantes" element={<TeacherStudentsList />} />
            <Route path="/estudiantes/:id/calificaciones" element={<StudentGrades />} />
            
            {/* Rutas para indicadores */}
            <Route path="/indicadores" element={<IndicatorsList />} />
            <Route path="/indicadores/nuevo" element={<IndicatorForm />} />
            <Route path="/indicadores/:id/editar" element={<IndicatorForm />} />
            
            {/* Rutas para resultados */}
            <Route path="/resultados" element={<ResultsList />} />
            <Route path="/resultados/:id" element={<ResultDetail />} />
            
            {/* Rutas para planes de mejoramiento */}
            <Route path="/planes-mejoramiento" element={<ImprovementPlansList />} />
            <Route path="/planes-mejoramiento/nuevo" element={<ImprovementPlanForm />} />
            <Route path="/planes-mejoramiento/:id" element={<ImprovementPlanDetail />} />
            <Route path="/planes-mejoramiento/:id/editar" element={<ImprovementPlanForm />} />
            {/* Nueva ruta mejorada para planes de mejoramiento */}
            <Route path="/planes-mejoramiento/:id/detalle" element={<ImprovementPlanDetailEnhanced />} />
            {/* Sistema automático de planes de mejoramiento */}
            <Route path="/planes-automaticos" element={<AutomaticImprovementPlansManager />} />
            {/* Añadir la ruta dentro del componente TeacherDashboardLayout*/}
            <Route path="/mis-cursos" element={<TeacherCoursesManager />} />

            {/* Y luego añadir esta ruta dentro del componente Routes:*/}
            <Route path="/evaluacion-fase" element={<PhaseEvaluation />} />
            
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
    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);
    
    return (
      <div>
        {/* Botón para mostrar sidebar en móviles */}
        <button 
          className="btn btn-dark d-md-none position-fixed" 
          style={{ top: '70px', left: '10px', zIndex: 1030 }} 
          onClick={handleShow}
        >
          <Menu size={20} />
        </button>
        
        {/* Sidebar para pantallas medianas y grandes */}
        <div className="d-none d-md-block sidebar bg-dark text-white" style={{ width: '250px', height: '100vh', position: 'fixed', left: 0, top: '56px', overflowY: 'auto' }}>
          <div className="p-3">
            <h5 className="mb-3">Panel de Estudiante</h5>
            <ul className="nav flex-column">
              <li className="nav-item mb-2">
                <Link to="/student/dashboard" className="nav-link text-white d-flex align-items-center">
                  <Home size={18} className="me-2" /> Dashboard
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/take-quiz" className="nav-link text-white d-flex align-items-center">
                  <FileText size={18} className="me-2" /> Evaluaciones
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/results" className="nav-link text-white d-flex align-items-center">
                  <Award size={18} className="me-2" /> Resultados
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/indicators" className="nav-link text-white d-flex align-items-center">
                  <CheckSquare size={18} className="me-2" /> Indicadores
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/improvement" className="nav-link text-white d-flex align-items-center">
                  <BarChart2 size={18} className="me-2" /> Plan de Mejora
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Offcanvas para móviles */}
        <Offcanvas show={show} onHide={handleClose} className="bg-dark text-white">
          <Offcanvas.Header closeButton className="border-bottom">
            <Offcanvas.Title>Panel de Estudiante</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <ul className="nav flex-column">
              <li className="nav-item mb-2">
                <Link to="/student/dashboard" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <Home size={18} className="me-2" /> Dashboard
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/take-quiz" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <FileText size={18} className="me-2" /> Evaluaciones
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/results" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <Award size={18} className="me-2" /> Resultados
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/indicators" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <CheckSquare size={18} className="me-2" /> Indicadores
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link to="/student/improvement" className="nav-link text-white d-flex align-items-center" onClick={handleClose}>
                  <BarChart2 size={18} className="me-2" /> Plan de Mejora
                </Link>
              </li>
            </ul>
          </Offcanvas.Body>
        </Offcanvas>
        
        {/* Contenido principal */}
        <div style={{ 
          marginLeft: window.innerWidth >= 768 ? '250px' : '0', 
          width: window.innerWidth >= 768 ? 'calc(100% - 250px)' : '100%', 
          padding: '20px', 
          marginTop: '56px' 
        }}>
          <Routes>
            <Route path="/dashboard" element={<StudentDashboardPage />} />
            <Route path="/take-quiz" element={<TakeQuizPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/indicators" element={<StudentIndicators />} />
            <Route path="/improvement" element={<ImprovementPage />} />
            <Route path="/planes-mejoramiento/:id" element={<ImprovementPlanDetail />} />
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

        <Route path="/evaluacion-fase" element={
          <ProtectedRoute allowedRoles={['docente']}>
            <PhaseEvaluation />
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
// Asegúrate de que el archivo de estilos esté correctamente importado