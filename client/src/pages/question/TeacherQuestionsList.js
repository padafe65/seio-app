// Crear un nuevo archivo en src/pages/questions/TeacherQuestionsList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, Search } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const TeacherQuestionsList = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherSubject, setTeacherSubject] = useState('');
  
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        // Obtener la materia del docente
        const subjectResponse = await axios.get(`${API_URL}/api/teacher/subject/${user.id}`);
        setTeacherSubject(subjectResponse.data.subject || '');
        
        // Obtener preguntas del docente
        const response = await axios.get(`${API_URL}/api/teacher/questions/${user.id}`);
        setQuestions(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error al cargar preguntas:', err);
        setError('Error al cargar las preguntas');
        setLoading(false);
      }
    };
    
    fetchQuestions();
  }, [user.id]);
  
  // Filtrar preguntas según el término de búsqueda
  const filteredQuestions = questions.filter(question => 
    question.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    question.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    question.questionnaire_title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="alert alert-danger">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        {error}
      </div>
    );
  }
  
  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Mis Preguntas - {teacherSubject}</h5>
          <div>
            <Link to="/crear-pregunta" className="btn btn-light btn-sm">
              <PlusCircle size={16} className="me-1" /> Nueva Pregunta
            </Link>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <div className="input-group">
              <span className="input-group-text">
                <Search size={18} />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar preguntas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          {filteredQuestions.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Pregunta</th>
                    <th>Categoría</th>
                    <th>Cuestionario</th>
                    <th>Grado</th>
                    <th>Fase</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map(question => (
                    <tr key={question.id}>
                      <td>{question.question_text.substring(0, 50)}...</td>
                      <td>{question.category.split('_')[1] || question.category}</td>
                      <td>{question.questionnaire_title}</td>
                      <td>{question.grade}°</td>
                      <td>Fase {question.phase}</td>
                      <td>
                        <Link to={`/preguntas/${question.id}/editar`} className="btn btn-sm btn-outline-primary me-2">
                          Editar
                        </Link>
                        <button 
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteQuestion(question.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="alert alert-info">
              No se encontraron preguntas. {searchTerm ? 'Intenta con otra búsqueda.' : 'Crea tu primera pregunta.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherQuestionsList;
