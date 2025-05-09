// pages/students/StudentsList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Eye, Edit, Trash2, Search } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const StudentsList = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/students`);
        setStudents(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar estudiantes:', error);
        setError('No se pudieron cargar los estudiantes. Por favor, intenta de nuevo.');
        setLoading(false);
      }
    };
    
    fetchStudents();
  }, []);
  
  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este estudiante?')) {
      try {
        await axios.delete(`${API_URL}/api/students/${id}`);
        setStudents(students.filter(student => student.id !== id));
        alert('Estudiante eliminado correctamente');
      } catch (error) {
        console.error('Error al eliminar estudiante:', error);
        alert('Error al eliminar estudiante: ' + (error.response?.data?.message || error.message));
      }
    }
  };
  
  const filteredStudents = students.filter(student => 
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(student.grade)?.includes(searchTerm.toLowerCase())
  );
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Gestión de Estudiantes</h4>
        <Link to="/estudiantes/nuevo" className="btn btn-primary d-flex align-items-center">
          <PlusCircle size={18} className="me-2" /> Nuevo Estudiante
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
          <div className="input-group mb-3">
            <span className="input-group-text">
              <Search size={18} />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar estudiantes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Grado</th>
                    <th>Curso</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>{student.contact_email}</td>
                        <td>{student.contact_phone}</td>
                        <td>{student.grade}</td>
                        <td>{student.course_name}</td>
                        <td className="text-end">
                          <div className="btn-group">
                            <Link 
                              to={`/estudiantes/${student.id}`} 
                              state={{ viewMode: true }}
                              className="btn btn-sm btn-outline-info"
                            >
                              <Eye size={16} className="me-1" /> Ver
                            </Link>
                            <Link 
                              to={`/estudiantes/${student.id}/editar`} 
                              className="btn btn-sm btn-outline-primary"
                            >
                              <Edit size={16} className="me-1" /> Editar
                            </Link>
                            <button 
                              onClick={() => handleDelete(student.id)}
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
                      <td colSpan="6" className="text-center py-3">
                        No se encontraron estudiantes
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

export default StudentsList;
