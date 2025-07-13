import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { PlusCircle, Users, FileText } from 'lucide-react';
import api from '../config/axios';

const Dashboard = () => {
  const { user, teacherId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [studentGrades, setStudentGrades] = useState([]);
  const [teacherQuestions, setTeacherQuestions] = useState([]); // Nuevo estado para preguntas del docente
  const [teacherQuestionnaires, setTeacherQuestionnaires] = useState([]); // Nuevo estado para cuestionarios del docente
  const [teacherSubject, setTeacherSubject] = useState(''); // Nuevo estado para la materia del docente
  const [stats, setStats] = useState({
    completedSubjects: 5,
    pendingActivities: 2,
    completedPhases: 3
  });
  
  useEffect(() => {
    const fetchData = async () => {
      if (!user || user.role !== 'docente' || !teacherId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No se encontró el token de autenticación');
        }

        const config = {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        };

        // Obtener estudiantes del docente
        const studentsResponse = await api.get(`/api/students/teacher/${teacherId}`, config);
        setTeacherStudents(studentsResponse.data);
        
        // Obtener calificaciones de los estudiantes
        const gradesResponse = await api.get(`/api/teachers/students`, config);
        setStudentGrades(gradesResponse.data);
        
        // Obtener los cursos del docente
        const coursesResponse = await api.get(`/api/teacher-courses/teacher/${teacherId}`, config);
        
        if (coursesResponse.data && coursesResponse.data.length > 0) {
          // Por ahora, tomamos el primer curso como la "materia" principal
          setTeacherSubject(coursesResponse.data[0].course_name || 'Sin curso asignado');
        }
        
        // Obtener cuestionarios del docente
        try {
          const questionnairesResponse = await api.get('/api/questionnaires', config);
          
          // Filtrar en el frontend si es necesario (aunque el backend ya debería filtrar)
          const filteredQuestionnaires = Array.isArray(questionnairesResponse.data) 
            ? questionnairesResponse.data 
            : (questionnairesResponse.data?.data || []);
            
          setTeacherQuestionnaires(filteredQuestionnaires.slice(0, 5));
          console.log('Cuestionarios del docente:', filteredQuestionnaires);
        } catch (error) {
          console.error('Error al cargar cuestionarios del docente:', error);
        }
        
        // Obtener preguntas del docente
        try {
          const questionsResponse = await api.get('/api/questions', config);
          
          // Filtrar en el frontend si es necesario (aunque el backend ya debería filtrar)
          const filteredQuestions = Array.isArray(questionsResponse.data)
            ? questionsResponse.data
            : (questionsResponse.data?.data || []);
            
          setTeacherQuestions(filteredQuestions.slice(0, 5));
        } catch (error) {
          console.error('Error al cargar preguntas del docente:', error);
        }
      } catch (error) {
        console.error('Error al cargar datos del docente:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, teacherId]);
  
  // Función auxiliar para formatear calificaciones
  const formatGrade = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return parseFloat(value).toFixed(1);
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
          <div className="card-header bg-white">
            <h5 className="mb-0">Mis Estudiantes</h5>
          </div>
          <div className="card-body">
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
                  {teacherStudents.slice(0, 5).map(student => (
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
              {teacherStudents.length > 5 && (
                <div className="text-center mt-3">
                  <Link to="/mis-estudiantes" className="btn btn-outline-primary">
                    Ver todos los estudiantes
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
                    <th>Categoría</th>
                    <th>Cuestionario</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherQuestions.map(question => (
                    <tr key={question.id}>
                      <td>{question.question_text?.substring(0, 50)}...</td>
                      <td>{question.category?.split('_')[1] || question.category}</td>
                      <td>{question.questionnaire_title || 'N/A'}</td>
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
