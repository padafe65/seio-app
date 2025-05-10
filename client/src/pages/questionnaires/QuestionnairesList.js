// pages/questionnaires/QuestionnairesList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Edit, Trash2, Search, List } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const QuestionnairesList = () => {
  const { user } = useAuth();
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [error, setError] = useState(null);
  
  useEffect(() => {
  const fetchQuestionnaires = async () => {
    try {
      setLoading(true);
      
      // Construir la URL con los filtros
      let url = `${API_URL}/api/questionnaires?created_by=${user.id}`;
      if (filterPhase !== 'all') url += `&phase=${filterPhase}`;
      if (filterGrade !== 'all') url += `&grade=${filterGrade}`;
      
      const response = await axios.get(url);
      setQuestionnaires(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar cuestionarios:', error);
      setError('No se pudieron cargar los cuestionarios. Por favor, intenta de nuevo.');
      setQuestionnaires([]);
      setLoading(false);
    }
  };
  
  fetchQuestionnaires();
}, [user.id, filterPhase, filterGrade]);

  
  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este cuestionario? Esta acción también eliminará todas las preguntas asociadas.')) {
      try {
        await axios.delete(`${API_URL}/api/questionnaires/${id}`);
        setQuestionnaires(questionnaires.filter(q => q.id !== id));
        alert('Cuestionario eliminado correctamente');
      } catch (error) {
        console.error('Error al eliminar cuestionario:', error);
        alert('Error al eliminar cuestionario: ' + (error.response?.data?.message || error.message));
      }
    }
  };
  
  const filteredQuestionnaires = questionnaires.filter(q => {
    // Filtro por búsqueda
    const matchesSearch = 
      q.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.course_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro por fase
    const matchesPhase = filterPhase === 'all' || q.phase === parseInt(filterPhase);
    
    // Filtro por grado
    const matchesGrade = filterGrade === 'all' || q.grade === parseInt(filterGrade);
    
    return matchesSearch && matchesPhase && matchesGrade;
  });
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Gestión de Cuestionarios</h4>
        <Link to="/cuestionarios/nuevo" className="btn btn-primary d-flex align-items-center">
          <PlusCircle size={18} className="me-2" /> Nuevo Cuestionario
        </Link>
      </div>
      
      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      )}
      
      <div className="card mb-4">
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar cuestionarios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <select 
                className="form-select"
                value={filterPhase}
                onChange={(e) => setFilterPhase(e.target.value)}
              >
                <option value="all">Todas las fases</option>
                <option value="1">Fase 1</option>
                <option value="2">Fase 2</option>
                <option value="3">Fase 3</option>
                <option value="4">Fase 4</option>
              </select>
            </div>
            <div className="col-md-4">
              <select 
                className="form-select"
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
              >
                <option value="all">Todos los grados</option>
                <option value="7">7°</option>
                <option value="8">8°</option>
                <option value="9">9°</option>
                <option value="10">10°</option>
                <option value="11">11°</option>
              </select>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Categoría</th>
                    <th>Grado</th>
                    <th>Fase</th>
                    <th>Curso</th>
                    <th>Preguntas</th>
                    <th>Creado por</th>
                    <th>Fecha</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestionnaires.length > 0 ? (
                    filteredQuestionnaires.map((questionnaire) => (
                      <tr key={questionnaire.id}>
                        <td>{questionnaire.title}</td>
                        <td>{questionnaire.category.replace('_', ' - ')}</td>
                        <td>{questionnaire.grade}°</td>
                        <td>
                          <span className={`badge bg-${getPhaseColor(questionnaire.phase)}`}>
                            Fase {questionnaire.phase}
                          </span>
                        </td>
                        <td>{questionnaire.course_name}</td>
                        <td>
                          <span className={`badge bg-${getQuestionCountColor(questionnaire.question_count)}`}>
                            {questionnaire.question_count}
                          </span>
                        </td>
                        <td>{questionnaire.created_by_name}</td>
                        <td>{new Date(questionnaire.created_at).toLocaleDateString()}</td>
                        <td className="text-end">
                          <div className="btn-group">
                            <Link 
                              to={`/cuestionarios/${questionnaire.id}/preguntas`} 
                              className="btn btn-sm btn-outline-info"
                            >
                              <List size={16} className="me-1" /> Preguntas
                            </Link>
                            <Link 
                              to={`/cuestionarios/${questionnaire.id}/editar`} 
                              className="btn btn-sm btn-outline-primary"
                            >
                              <Edit size={16} className="me-1" /> Editar
                            </Link>
                            <button 
                              onClick={() => handleDelete(questionnaire.id)}
                              className="btn btn-sm btn-outline-danger"
                            >
                              <Trash2 size={16} className="me-1" /> Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="text-center py-3">
                        No se encontraron cuestionarios
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Funciones auxiliares para determinar colores
const getPhaseColor = (phase) => {
  switch (phase) {
    case 1: return 'primary';
    case 2: return 'success';
    case 3: return 'warning';
    case 4: return 'danger';
    default: return 'secondary';
  }
};

const getQuestionCountColor = (count) => {
  if (count === 0) return 'danger';
  if (count < 5) return 'warning';
  return 'success';
};

export default QuestionnairesList;
