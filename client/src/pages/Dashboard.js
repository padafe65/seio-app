import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { PlusCircle, Users, FileText } from 'lucide-react';
import axiosClient from '../api/axiosClient';

const Dashboard = () => {
  const { user, authToken, isAuthReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [studentGrades, setStudentGrades] = useState([]);
  const [teacherQuestions, setTeacherQuestions] = useState([]); // Nuevo estado para preguntas del docente
  const [teacherQuestionnaires, setTeacherQuestionnaires] = useState([]); // Nuevo estado para cuestionarios del docente
  const [teacherSubject, setTeacherSubject] = useState(''); // Nuevo estado para la materia del docente
  const [studentFilters, setStudentFilters] = useState({
    name: '',
    email: '',
    course: '',
    grade: ''
  });
  const [stats, setStats] = useState({
    completedSubjects: 5,
    pendingActivities: 2,
    completedPhases: 3
  });
  
  useEffect(() => {
    const fetchData = async () => {
      // Esperar a que la autenticación esté lista y que haya un token disponible
      if (!isAuthReady) {
        return; // Aún no está lista la autenticación, esperar
      }
      
      // Verificar que el token esté tanto en el estado como en localStorage
      const tokenInStorage = localStorage.getItem('authToken');
      if (!authToken || !tokenInStorage) {
        setLoading(false);
        return; // No hay token, no intentar cargar datos
      }
      
      // Pequeño delay para asegurar que el token esté completamente disponible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (user && user.role === 'docente') {
        try {
          // Obtener estudiantes del docente
          const studentsResponse = await axiosClient.get(`/teacher/students/${user.id}`);
          setTeacherStudents(studentsResponse.data);
          
          // Obtener calificaciones de los estudiantes
          const gradesResponse = await axiosClient.get(`/teacher/student-grades/${user.id}`);
          setStudentGrades(gradesResponse.data);
          
          // Obtener la materia del docente
          const subjectResponse = await axiosClient.get(`/teacher/subject/${user.id}`);
          const subject = subjectResponse.data.subject || '';
          setTeacherSubject(subject);
          
          // Obtener cuestionarios creados por este docente
          try {
            const questionnairesResponse = await axiosClient.get(`/questionnaires?created_by=${user.id}`);
            setTeacherQuestionnaires(questionnairesResponse.data.slice(0, 5)); // Mostrar solo los primeros 5
            console.log('Cuestionarios del docente:', questionnairesResponse.data);
          } catch (error) {
            console.error('Error al cargar cuestionarios del docente:', error);
          }
          
          // Obtener preguntas relacionadas con la materia del docente o creadas por él
          try {
            // Usa la nueva ruta específica para preguntas del docente
            const questionsResponse = await axiosClient.get(`/teacher/questions/${user.id}`);
            setTeacherQuestions(questionsResponse.data.slice(0, 5));
          } catch (error) {
            console.error('Error al cargar preguntas del docente:', error);
          }

        } catch (error) {
          console.error('Error al cargar datos del docente:', error);
        }
      }
      setLoading(false);
    };
    
    fetchData();
  }, [user, authToken, isAuthReady]);
  
  // Función auxiliar para formatear calificaciones
  const formatGrade = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return parseFloat(value).toFixed(1);
  };

  // Filtrar estudiantes en el dashboard
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
  
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Bienvenida */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {user.role === 'estudiante' ? `Hola, ${user.name}` : `Hola, Profesor(a) ${user.name}`}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {user.role === 'estudiante' 
            ? 'Aquí puedes ver tu progreso académico.' 
            : `Aquí puedes gestionar y revisar el progreso de tus alumnos. ${teacherSubject ? `Materia: ${teacherSubject}` : ''}`}
        </p>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-gray-500 text-sm">Materias Completadas</div>
          <div className="text-2xl font-bold text-gray-800">{stats.completedSubjects}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-gray-500 text-sm">Actividades Pendientes</div>
          <div className="text-2xl font-bold text-gray-800">{stats.pendingActivities}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-gray-500 text-sm">Fases Completadas</div>
          <div className="text-2xl font-bold text-gray-800">{stats.completedPhases}</div>
        </div>
      </div>

      {/* Botones de acción para docentes */}
      {user.role === 'docente' && (
        <div className="d-flex gap-3 mb-4">
          <Link to="/crear-pregunta" className="btn btn-primary d-flex align-items-center gap-2">
            <PlusCircle size={20} />
            Crear Nueva Pregunta
          </Link>
          <Link to="/mis-estudiantes" className="btn btn-info d-flex align-items-center gap-2">
            <Users size={20} />
            Ver Mis Estudiantes
          </Link>
          <Link to="/materias-categorias" className="btn btn-success d-flex align-items-center gap-2">
            <FileText size={20} />
            Gestionar Materias y Categorías
          </Link>
        </div>
      )}

      {/* Mis Cuestionarios - Nueva sección */}
      {user.role === 'docente' && teacherQuestionnaires.length > 0 && (
        <div className="card mb-4">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Mis Cuestionarios {teacherSubject ? `(${teacherSubject})` : ''}</h5>
            <Link to="/cuestionarios/nuevo" className="btn btn-sm btn-primary">
              <PlusCircle size={16} className="me-1" /> Nuevo Cuestionario
            </Link>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Categoría</th>
                    <th>Grado</th>
                    <th>Fase</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherQuestionnaires.map(questionnaire => (
                    <tr key={questionnaire.id}>
                      <td>{questionnaire.title}</td>
                      <td>{questionnaire.category?.split('_')[1] || questionnaire.category}</td>
                      <td>{questionnaire.grade}°</td>
                      <td>Fase {questionnaire.phase}</td>
                      <td>
                        <Link to={`/cuestionarios/${questionnaire.id}/editar`} className="btn btn-sm btn-outline-primary me-2">
                          Editar
                        </Link>
                        <Link to={`/cuestionarios/${questionnaire.id}/preguntas`} className="btn btn-sm btn-outline-info">
                          Ver Preguntas
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teacherQuestionnaires.length > 5 && (
                <div className="text-center mt-3">
                  <Link to="/cuestionarios" className="btn btn-outline-primary">
                    Ver todos mis cuestionarios
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lista de estudiantes del docente */}
      {user.role === 'docente' && teacherStudents.length > 0 && (
        <div className="card mb-4">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Mis Estudiantes</h5>
            <Link to="/mis-estudiantes" className="btn btn-sm btn-outline-primary">
              Ver Todos
            </Link>
          </div>
          <div className="card-body">
            {/* Filtros para estudiantes */}
            <div className="row g-2 mb-3">
              <div className="col-md-3">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Filtrar por nombre"
                  value={studentFilters.name}
                  onChange={(e) => handleStudentFilterChange('name', e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Filtrar por email"
                  value={studentFilters.email}
                  onChange={(e) => handleStudentFilterChange('email', e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Filtrar por curso"
                  value={studentFilters.course}
                  onChange={(e) => handleStudentFilterChange('course', e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Filtrar por grado"
                    value={studentFilters.grade}
                    onChange={(e) => handleStudentFilterChange('grade', e.target.value)}
                  />
                  {(Object.values(studentFilters).some(f => f)) && (
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={clearStudentFilters}
                      title="Limpiar filtros"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Grado</th>
                    <th>Curso</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeacherStudents.slice(0, 5).map(student => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>{student.grade}°</td>
                      <td>{student.course_name}</td>
                      <td>
                        <Link to={`/estudiantes/${student.id}`} className="btn btn-sm btn-outline-info me-2">
                          Ver Detalles
                        </Link>
                        <Link to={`/estudiantes/${student.id}/calificaciones`} className="btn btn-sm btn-outline-primary">
                          Calificaciones
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTeacherStudents.length === 0 && Object.values(studentFilters).some(f => f) && (
                <div className="text-center py-3 text-muted">
                  No se encontraron estudiantes con los filtros aplicados
                </div>
              )}
              {teacherStudents.length > 5 && (
                <div className="text-center mt-3">
                  <Link to="/mis-estudiantes" className="btn btn-outline-primary">
                    Ver todos los estudiantes ({teacherStudents.length})
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mis Preguntas - Nueva sección */}
{user.role === 'docente' && teacherQuestions.length > 0 && (
  <div className="card mb-4">
    <div className="card-header bg-white d-flex justify-content-between align-items-center">
      <h5 className="mb-0">Mis Preguntas {teacherSubject ? `(${teacherSubject})` : ''}</h5>
      <Link to="/crear-pregunta" className="btn btn-sm btn-primary">
        <PlusCircle size={16} className="me-1" /> Nueva Pregunta
      </Link>
    </div>
    <div className="card-body">
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Pregunta</th>
              <th>Materia</th>
              <th>Categoría</th>
              <th>Cuestionario</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {teacherQuestions.map(question => (
              <tr key={question.id}>
                <td>{question.question_text?.substring(0, 50)}...</td>
                <td>
                  <span className="badge bg-secondary">
                    {question.subject || question.category?.split('_')[0] || 'N/A'}
                  </span>
                </td>
                <td>{question.category || 'N/A'}</td>
                <td>
                  <span className="badge bg-info text-white">
                    {question.questionnaire_title || 'Sin cuestionario'}
                  </span>
                </td>
                <td>
                  <Link to={`/preguntas/${question.id}/editar`} className="btn btn-sm btn-outline-primary me-2">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {teacherQuestions.length > 5 && (
          <div className="text-center mt-3">
            <Link to="/mis-preguntas" className="btn btn-outline-primary">
              Ver todas mis preguntas
            </Link>
          </div>
        )}
      </div>
    </div>
  </div>
)}


      {/* Tabla de calificaciones por fase */}
      {user.role === 'docente' && studentGrades.length > 0 && (
        <div className="card">
          <div className="card-header bg-white">
            <h5 className="mb-0">Calificaciones por Fase</h5>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Curso</th>
                    <th>Fase 1</th>
                    <th>Fase 2</th>
                    <th>Fase 3</th>
                    <th>Fase 4</th>
                    <th>Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {studentGrades.map((grade, index) => (
                    <tr key={index}>
                      <td>{grade.student_name}</td>
                      <td>{grade.course_name}</td>
                      <td>{formatGrade(grade.phase1)}</td>
                      <td>{formatGrade(grade.phase2)}</td>
                      <td>{formatGrade(grade.phase3)}</td>
                      <td>{formatGrade(grade.phase4)}</td>
                      <td>{formatGrade(grade.average)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
