// pages/prueba-saber/TeacherPruebaSaberPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { Edit, Trash2, Filter, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

const TeacherPruebaSaberPage = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    level: '',
    institution: ''
  });

  useEffect(() => {
    fetchPruebaSaberQuestions();
  }, [filters]);

  const fetchPruebaSaberQuestions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.level) params.append('level', filters.level);
      if (filters.institution) params.append('institution_id', filters.institution);
      
      const response = await axiosClient.get(`/questions/prueba-saber?${params.toString()}`);
      setQuestions(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar preguntas Prueba Saber:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las preguntas Prueba Saber'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, questionText) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar esta pregunta tipo Prueba Saber?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await axiosClient.delete(`/questions/${id}`);
        Swal.fire('Eliminada', 'La pregunta ha sido eliminada exitosamente', 'success');
        fetchPruebaSaberQuestions();
      } catch (error) {
        console.error('Error al eliminar pregunta:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.message || 'No se pudo eliminar la pregunta'
        });
      }
    }
  };

  // Agrupar preguntas por nivel
  const questionsByLevel = questions.reduce((acc, question) => {
    const level = question.prueba_saber_level || 'Sin nivel';
    if (!acc[level]) acc[level] = [];
    acc[level].push(question);
    return acc;
  }, {});

  const levels = [3, 5, 9, 11];

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
    <div className="container py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
        <h2 className="mb-3 mb-md-0">
          <GraduationCap className="me-2" size={28} />
          Mis Preguntas Tipo Prueba Saber
        </h2>
        <Link to="/crear-pregunta" className="btn btn-primary w-100 w-md-auto">
          <GraduationCap size={18} className="me-2" />
          Crear Nueva Pregunta
        </Link>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">
            <Filter size={18} className="me-2" />
            Filtros
          </h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Nivel de Prueba Saber</label>
              <select
                className="form-select"
                value={filters.level}
                onChange={(e) => setFilters({ ...filters, level: e.target.value })}
              >
                <option value="">Todos los niveles</option>
                <option value="3">Grado 3°</option>
                <option value="5">Grado 5°</option>
                <option value="9">Grado 9°</option>
                <option value="11">Grado 11°</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title">Total</h5>
              <h3 className="text-primary">{questions.length}</h3>
            </div>
          </div>
        </div>
        {levels.map(level => {
          const count = questions.filter(q => q.prueba_saber_level === level).length;
          return (
            <div key={level} className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Grado {level}°</h5>
                  <h3 className="text-info">{count}</h3>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista de preguntas agrupadas por nivel */}
      {questions.length === 0 ? (
        <div className="alert alert-info">
          <h5>No tienes preguntas tipo Prueba Saber aún</h5>
          <p>Comienza a crear preguntas tipo Prueba Saber haciendo clic en "Crear Nueva Pregunta".</p>
          <p className="mb-0">
            <small>Recuerda marcar la casilla "Pregunta tipo Prueba Saber" y seleccionar el nivel al crear la pregunta.</small>
          </p>
        </div>
      ) : (
        <div>
          {levels.map(level => {
            const levelQuestions = questionsByLevel[level] || [];
            if (levelQuestions.length === 0 && filters.level) return null;
            
            return (
              <div key={level} className="card mb-4">
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">Grado {level}° - {levelQuestions.length} preguntas</h5>
                </div>
                <div className="card-body">
                  {levelQuestions.length === 0 ? (
                    <p className="text-muted">No hay preguntas para este nivel</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Pregunta</th>
                            <th>Cuestionario</th>
                            <th>Materia</th>
                            <th>Categoría</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {levelQuestions.map((question) => (
                            <tr key={question.id}>
                              <td>{question.id}</td>
                              <td>
                                <div style={{ maxWidth: '400px' }}>
                                  {question.question_text?.substring(0, 100)}...
                                </div>
                              </td>
                              <td>
                                <small className="badge bg-info">
                                  {question.questionnaire_title || 'Sin cuestionario'}
                                </small>
                              </td>
                              <td>
                                <small className="badge bg-secondary">
                                  {question.questionnaire_subject || 'N/A'}
                                </small>
                              </td>
                              <td>
                                <small>{question.category || 'N/A'}</small>
                              </td>
                              <td>
                                <div className="btn-group">
                                  <Link
                                    to={`/preguntas/${question.id}/editar`}
                                    className="btn btn-sm btn-outline-primary"
                                    title="Editar"
                                  >
                                    <Edit size={16} />
                                  </Link>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDelete(question.id, question.question_text)}
                                    title="Eliminar"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeacherPruebaSaberPage;
