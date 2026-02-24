import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { PlusCircle, Users, FileText, GraduationCap, Activity, Lock, MessageCircle, RefreshCw } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import UserAvatar from '../components/UserAvatar';
import SubscriptionForm from '../components/SubscriptionForm';

const Dashboard = () => {
  const { user, authToken, isAuthReady } = useAuth();
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [studentGrades, setStudentGrades] = useState([]);
  const [teacherQuestions, setTeacherQuestions] = useState([]); 
  const [teacherQuestionnaires, setTeacherQuestionnaires] = useState([]); 
  const [teacherSubject, setTeacherSubject] = useState(''); 
  const [teacherLicenses, setTeacherLicenses] = useState([]); 
  const [reportLogoUrl, setReportLogoUrl] = useState('');
  const [loading, setLoading] = useState(true); // Para controlar el estado de carga inicial
  const [studentFilters, setStudentFilters] = useState({
    name: '',
    email: '',
    course: '',
    grade: ''
  });

  // Lógica de validación de suscripción activa
  const isSubscriptionActive = teacherLicenses.some(lic => lic.license_status === 'active');
  
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthReady) return;
      
      const tokenInStorage = localStorage.getItem('authToken');
      if (!authToken || !tokenInStorage) {
        setLoading(false);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (user && user.role === 'docente') {
        try {
          // 1. Cargamos primero los datos del profesor y sus LICENCIAS
          const teacherDataResponse = await axiosClient.get(`/teachers/by-user/${user.id}`);
          const teacherData = teacherDataResponse.data?.data || teacherDataResponse.data;
          
          if (teacherData && teacherData.id) {
            setReportLogoUrl(teacherData.report_logo_url || '');
            
            const licensesResponse = await axiosClient.get(`/teacher-licenses/teacher/${teacherData.id}/licenses`);
            const licenses = licensesResponse.data?.data || [];
            setTeacherLicenses(licenses);

            // 2. Solo si hay una licencia activa, ejecutamos el resto de las peticiones originales
            const hasActive = licenses.some(lic => lic.license_status === 'active');
            
            if (hasActive) {
              // Manteniendo todas tus peticiones originales
              const [studentsRes, gradesRes, subjectRes, questionnairesRes, questionsRes] = await Promise.all([
                axiosClient.get(`/teacher/students/${user.id}`),
                axiosClient.get(`/teacher/student-grades/${user.id}`),
                axiosClient.get(`/teacher/subject/${user.id}`),
                axiosClient.get(`/questionnaires?created_by=${user.id}`),
                axiosClient.get(`/teacher/questions/${user.id}`)
              ]);

              setTeacherStudents(studentsRes.data);
              setStudentGrades(gradesRes.data);
              setTeacherSubject(subjectRes.data.subject || '');
              setTeacherQuestionnaires(questionnairesRes.data.slice(0, 5));
              setTeacherQuestions(questionsRes.data.slice(0, 5));
            }
          }
        } catch (error) {
          console.error('Error al cargar datos del docente:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, authToken, isAuthReady]);
  
  const formatGrade = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return parseFloat(value).toFixed(1);
  };

  const filteredTeacherStudents = teacherStudents.filter(student => {
    const matchesName = !studentFilters.name || (student.name || '').toLowerCase().includes(studentFilters.name.toLowerCase());
    const matchesEmail = !studentFilters.email || (student.email || '').toLowerCase().includes(studentFilters.email.toLowerCase());
    const matchesCourse = !studentFilters.course || (student.course_name || '').toLowerCase().includes(studentFilters.course.toLowerCase());
    const matchesGrade = !studentFilters.grade || (student.grade || '').toString() === studentFilters.grade || (student.grade || '').toString().includes(studentFilters.grade);
    return matchesName && matchesEmail && matchesCourse && matchesGrade;
  });

  const handleStudentFilterChange = (field, value) => {
    setStudentFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearStudentFilters = () => {
    setStudentFilters({ name: '', email: '', course: '', grade: '' });
  };

  // --- BLOQUE 1: PANTALLA DE CARGA ---
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <RefreshCw className="animate-spin text-primary mb-2" size={40} />
          <p>Cargando información de tu cuenta...</p>
        </div>
      </div>
    );
  }

  // --- BLOQUE 2: MURO DE PAGO (Si no hay licencia activa) ---
// ... (mantenemos todos los imports iguales)

// --- DENTRO DEL COMPONENTE DASHBOARD, EN EL BLOQUE DEL MURO DE PAGO ---

if (user && user.role === 'docente' && !isSubscriptionActive) {
    return (
      <div className="container-fluid bg-light min-vh-100 d-flex align-items-center justify-content-center p-4">
        <div className="card shadow-lg border-0" style={{ maxWidth: '800px', width: '100%' }}>
          <div className="card-body p-5 text-center">
            <Lock size={60} className="text-danger mb-3" />
            <h2 className="fw-bold mb-3">Acceso Restringido</h2>
            <p className="text-muted mb-4">
              Hola <strong>{user.name}</strong>, tu periodo de prueba o suscripción ha vencido. 
              Elige el plan que mejor se adapte a ti para seguir disfrutando de SEIO:
            </p>
            
            {/* Opciones de Plan */}
            <div className="row mb-4">
                <div className="col-md-6 mb-2">
                    <div className="border rounded p-3 bg-white shadow-sm">
                        <h6 className="fw-bold mb-1">Plan Mensual</h6>
                        <p className="small text-muted mb-0">Renovación cada 30 días</p>
                    </div>
                </div>
                <div className="col-md-6 mb-2">
                    <div className="border border-warning rounded p-3 bg-warning bg-opacity-10 shadow-sm">
                        <h6 className="fw-bold mb-1 text-dark">Plan Anual 🏆</h6>
                        <p className="small text-dark mb-0"><strong>¡Ahorra más!</strong> Pago único por 12 meses</p>
                    </div>
                </div>
            </div>

            <div className="bg-primary bg-opacity-10 p-3 rounded mb-4 border border-primary border-opacity-25">
                <p className="mb-0 text-primary fw-bold">
                    💰 Pago Nequi: 314 2999 274
                </p>
                <small className="text-primary">A nombre de: Vilma Mejia</small>
            </div>

            <div className="text-start bg-white border rounded p-4 mb-4 shadow-sm">
              <SubscriptionForm teacherId={user.teacher_id || user.id} />
            </div>

            <div className="d-grid gap-2">
              <a 
                href={`https://wa.me/573142999274?text=Hola,%20soy%20el%20docente%20${encodeURIComponent(user.name)}%20y%20quiero%20enviar%20mi%20comprobante%20de%20pago%20para%20la%20licencia%20SEIO.`}
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-success d-flex align-items-center justify-content-center gap-2 py-2 fw-bold"
              >
                <MessageCircle size={20} /> Enviar Comprobante por WhatsApp
              </a>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => window.location.reload()}>
                <RefreshCw size={14} className="me-1" /> Ya realicé el pago, actualizar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
// ... (el resto del código del dashboard sigue igual)

  // --- BLOQUE 3: DASHBOARD COMPLETO (Si hay licencia activa) ---
  return (
    <div className="dashboard-container position-relative">
      {reportLogoUrl && (
        <div 
          className="dashboard-watermark position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            backgroundImage: `url(${reportLogoUrl})`,
            backgroundSize: '400px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.03,
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
      )}
      <div className="p-6 space-y-6" style={{ position: 'relative', zIndex: 1 }}>
        
        {/* Sección de Licencias (Tu código original) */}
        {user.role === 'docente' && teacherLicenses.length > 0 && (
          <div className="card mb-4 border-primary shadow-sm">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <PlusCircle size={20} className="me-2" />
                Mis Licencias:
              </h5>
            </div>
            <div className="card-body">
              <div className="col-12 mb-4">
                <div className="d-flex align-items-center gap-3">
                  <UserAvatar user={user} size="lg" authToken={authToken} />
                  <div>
                    <h1 className="h3 mb-0 text-dark">Bienvenido Profesor, {user.name}</h1>
                    <small className="text-muted">{user.role === 'docente' ? 'Docente' : 'Usuario'}</small>
                  </div>
                </div>
              </div>
              {teacherLicenses.map((license, index) => {
                const getStatusBadge = (status) => {
                  const badges = {
                    active: { class: 'bg-success', text: 'Activa' },
                    suspended: { class: 'bg-warning text-dark', text: 'Suspendida' },
                    expired: { class: 'bg-danger', text: 'Expirada' }
                  };
                  const badge = badges[status] || { class: 'bg-secondary', text: status };
                  return <span className={`badge ${badge.class}`}>{badge.text}</span>;
                };

                const calculateDaysRemaining = (expirationDate) => {
                  if (!expirationDate) return 'Sin expiración';
                  const today = new Date();
                  const expiry = new Date(expirationDate);
                  const diffTime = expiry - today;
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays >= 0 ? `${diffDays} días restantes` : 'Expirada';
                };

                return (
                  <div key={license.id || index} className="mb-3 pb-3 border-bottom">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h6 className="mb-1"><strong>{license.institution}</strong></h6>
                        {getStatusBadge(license.license_status)}
                      </div>
                    </div>
                    <div className="row g-2 text-sm">
                      <div className="col-md-6">
                        <small className="text-muted">Fecha de inicio:</small>
                        <div><strong>{license.purchased_date ? new Date(license.purchased_date).toLocaleDateString('es-ES') : 'N/A'}</strong></div>
                      </div>
                      <div className="col-md-6">
                        <small className="text-muted">Fecha de vencimiento:</small>
                        <div><strong>{license.expiration_date ? new Date(license.expiration_date).toLocaleDateString('es-ES') : 'Sin expiración'}</strong></div>
                      </div>
                      {license.license_status === 'active' && license.expiration_date && (
                        <div className="col-12 mt-2">
                          <small className="text-muted">Días restantes:</small>
                          <div><strong className={calculateDaysRemaining(license.expiration_date).includes('Expirada') ? 'text-danger' : ''}>
                            {calculateDaysRemaining(license.expiration_date)}
                          </strong></div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Botones de acción (Tu código original) */}
        {user.role === 'docente' && (
          <div className="d-flex gap-3 mb-4 flex-wrap">
            <Link to="/crear-pregunta" className="btn btn-primary d-flex align-items-center gap-2 shadow-sm px-3">
              <PlusCircle size={20} /> Crear Nueva Pregunta
            </Link>
            <Link to="/mis-estudiantes" className="btn btn-info text-white d-flex align-items-center gap-2 shadow-sm px-3">
              <Users size={20} /> Ver Mis Estudiantes
            </Link>
            <Link to="/materias-categorias" className="btn btn-success d-flex align-items-center gap-2 shadow-sm px-3">
              <FileText size={20} /> Gestionar Materias y Categorías
            </Link>
            <Link to="/subir-guia" className="btn btn-warning d-flex align-items-center gap-2 shadow-sm px-3">
              <FileText size={20} /> Subir Guía de Estudio
            </Link>
            <Link to="/prueba-saber/resultados" className="btn btn-primary d-flex align-items-center gap-2 shadow-sm px-3">
              <GraduationCap size={20} /> Resultados Prueba Saber
            </Link>
            <Link to="/gestionar-sesiones" className="btn btn-secondary d-flex align-items-center gap-2 shadow-sm px-3">
              <Activity size={20} /> Gestionar Sesiones
            </Link>
          </div>
        )}

        {/* Mis Cuestionarios (Tu código original) */}
        {user.role === 'docente' && teacherQuestionnaires.length > 0 && (
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
              <h5 className="mb-0 fw-bold">Mis Cuestionarios {teacherSubject ? `(${teacherSubject})` : ''}</h5>
              <Link to="/cuestionarios/nuevo" className="btn btn-sm btn-primary">
                <PlusCircle size={16} className="me-1" /> Nuevo Cuestionario
              </Link>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Título</th>
                      <th>Categoría</th>
                      <th>Grado</th>
                      <th>Fase</th>
                      <th>Total</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherQuestionnaires.map(questionnaire => (
                      <tr key={questionnaire.id}>
                        <td>{questionnaire.title}</td>
                        <td className="small">{questionnaire.category?.split('_')[1] || questionnaire.category}</td>
                        <td>{questionnaire.grade}°</td>
                        <td>Fase {questionnaire.phase}</td>
                        <td><span className="badge bg-secondary">{questionnaire.question_count ?? 0}</span></td>
                        <td>
                          <div className="btn-group">
                            <Link to={`/cuestionarios/${questionnaire.id}/editar`} className="btn btn-sm btn-outline-primary">Editar</Link>
                            <Link to={`/progreso-estudiantes/${questionnaire.id}`} className="btn btn-sm btn-outline-success">Progreso</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Mis Estudiantes y Filtros (Tu código original) */}
        {user.role === 'docente' && teacherStudents.length > 0 && (
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
              <h5 className="mb-0 fw-bold">Mis Estudiantes</h5>
              <Link to="/mis-estudiantes" className="btn btn-sm btn-outline-primary">Ver Todos</Link>
            </div>
            <div className="card-body">
              {/* Tus Filtros */}
              <div className="row g-2 mb-3">
                <div className="col-md-3">
                  <input type="text" className="form-control form-control-sm" placeholder="Nombre" value={studentFilters.name} onChange={(e) => handleStudentFilterChange('name', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <input type="text" className="form-control form-control-sm" placeholder="Email" value={studentFilters.email} onChange={(e) => handleStudentFilterChange('email', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <input type="text" className="form-control form-control-sm" placeholder="Curso" value={studentFilters.course} onChange={(e) => handleStudentFilterChange('course', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <div className="d-flex gap-2">
                    <input type="text" className="form-control form-control-sm" placeholder="Grado" value={studentFilters.grade} onChange={(e) => handleStudentFilterChange('grade', e.target.value)} />
                    {Object.values(studentFilters).some(f => f) && <button className="btn btn-sm btn-outline-secondary" onClick={clearStudentFilters}>✕</button>}
                  </div>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Grado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeacherStudents.slice(0, 5).map(student => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td className="small text-muted">{student.email}</td>
                        <td>{student.grade}° - {student.course_name}</td>
                        <td>
                          <Link to={`/estudiantes/${student.id}/calificaciones`} className="btn btn-sm btn-primary">Ver Notas</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tabla de Calificaciones por Fase (Tu código original completo) */}
        {user.role === 'docente' && studentGrades.length > 0 && (
          <div className="card shadow-sm">
            <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
              <h5 className="mb-0 fw-bold">Calificaciones Detalladas por Fase</h5>
              <small className="text-muted">(M) Manual · (S) Sistema</small>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover table-bordered align-middle text-center">
                  <thead className="table-light">
                    <tr>
                      <th className="text-start">Estudiante</th>
                      <th>Curso</th>
                      <th>Fase 1</th>
                      <th>Fase 2</th>
                      <th>Fase 3</th>
                      <th>Fase 4</th>
                      <th className="table-primary">Promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentGrades.map((grade, index) => {
                      const phaseBadge = (phaseNum) => {
                        const manual = grade[`phase${phaseNum}_manual`];
                        const system = grade[`phase${phaseNum}_system`];
                        const val = formatGrade(grade[`phase${phaseNum}`]);
                        if (val === 'N/A') return <span className="text-muted">N/A</span>;
                        const tag = (manual != null && !isNaN(parseFloat(manual))) ? 'M' : ((system != null || grade[`phase${phaseNum}`] != null) ? 'S' : null);
                        return <>{val} {tag && <span className="badge bg-secondary" style={{fontSize: '10px'}}>{tag}</span>}</>;
                      };
                      return (
                        <tr key={grade.student_id || index}>
                          <td className="text-start fw-medium">{grade.student_name}</td>
                          <td className="small">{grade.course_name}</td>
                          <td>{phaseBadge(1)}</td>
                          <td>{phaseBadge(2)}</td>
                          <td>{phaseBadge(3)}</td>
                          <td>{phaseBadge(4)}</td>
                          <td className="fw-bold text-primary">{formatGrade(grade.average)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;