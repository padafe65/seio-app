// pages/improvement-plans/ImprovementPlansList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Eye, Edit, Trash2, Search, Filter, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ImprovementPlansList = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        let url;
        
        if (user.role === 'docente') {
          url = `${API_URL}/api/improvement-plans/teacher/${user.id}`;
        } else if (user.role === 'estudiante') {
          url = `${API_URL}/api/improvement-plans/student/${user.id}`;
        } else {
          url = `${API_URL}/api/improvement-plans`;
        }
        
        if (selectedStudent && user.role === 'docente') {
          url = `${API_URL}/api/improvement-plans/student/${selectedStudent}`;
        }
        
        const response = await axios.get(url);
        setPlans(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar planes de mejoramiento:', error);
        setError('No se pudieron cargar los planes de mejoramiento. Por favor, intenta de nuevo.');
        setLoading(false);
      }
    };
    
    const fetchStudents = async () => {
      if (user.role === 'docente') {
        try {
          // Obtener el teacher_id asociado con el user_id
          const teacherResponse = await axios.get(`${API_URL}/api/teachers/by-user/${user.id}`);
          if (teacherResponse.data && teacherResponse.data.id) {
            const studentsResponse = await axios.get(`${API_URL}/api/teachers/students/${user.id}`);
            setStudents(studentsResponse.data);
          }
        } catch (error) {
          console.error('Error al cargar estudiantes:', error);
        }
      }
    };
    
    fetchPlans();
    fetchStudents();
  }, [user, selectedStudent]);
  
  const handleDelete = async (id) => {
    try {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede revertir",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });
      
      if (result.isConfirmed) {
        await axios.delete(`${API_URL}/api/improvement-plans/${id}`);
        setPlans(plans.filter(plan => plan.id !== id));
        
        Swal.fire(
          'Eliminado',
          'El plan de mejoramiento ha sido eliminado.',
          'success'
        );
      }
    } catch (error) {
      console.error('Error al eliminar plan:', error);
      Swal.fire(
        'Error',
        'No se pudo eliminar el plan de mejoramiento.',
        'error'
      );
    }
  };
  
  const filteredPlans = plans.filter(plan => 
    plan.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO');
  };
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Planes de Mejoramiento</h4>
        {user.role === 'docente' && (
          <Link to="/planes-mejoramiento/nuevo" className="btn btn-primary d-flex align-items-center">
            <PlusCircle size={18} className="me-2" /> Nuevo Plan
          </Link>
        )}
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
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar planes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {user.role === 'docente' && (
              <div className="col-md-6">
                <div className="input-group">
                  <span className="input-group-text">
                    <Filter size={18} />
                  </span>
                  <select 
                    className="form-select"
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                  >
                    <option value="">Todos los estudiantes</option>
                    {students.map(student => (
                      <option key={student.user_id} value={student.user_id}>
                        {student.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
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
                    <th>Materia</th>
                    {user.role !== 'estudiante' && <th>Estudiante</th>}
                    {user.role !== 'docente' && <th>Docente</th>}
                    <th>Fecha Límite</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.length > 0 ? (
                    filteredPlans.map((plan) => (
                      <tr key={plan.id}>
                        <td>{plan.title}</td>
                        <td>{plan.subject}</td>
                        {user.role !== 'estudiante' && <td>{plan.student_name}</td>}
                        {user.role !== 'docente' && <td>{plan.teacher_name}</td>}
                        <td>{formatDate(plan.deadline)}</td>
                        <td>
                          {plan.completed ? (
                            <span className="badge bg-success">Completado</span>
                          ) : (
                            <span className="badge bg-warning">Pendiente</span>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="btn-group">
                            <Link 
                              to={`/planes-mejoramiento/${plan.id}`} 
                              className="btn btn-sm btn-outline-info"
                            >
                              <Eye size={16} className="me-1" /> Ver
                            </Link>
                            {user.role === 'docente' && (
                              <>
                                <Link 
                                  to={`/planes-mejoramiento/${plan.id}/editar`} 
                                  className="btn btn-sm btn-outline-primary"
                                >
                                  <Edit size={16} className="me-1" /> Editar
                                </Link>
                                <button 
                                  onClick={() => handleDelete(plan.id)}
                                  className="btn btn-sm btn-outline-danger"
                                >
                                  <Trash2 size={16} className="me-1" /> Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={user.role === 'estudiante' ? 5 : 6} className="text-center py-3">
                        No se encontraron planes de mejoramiento
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

export default ImprovementPlansList;
