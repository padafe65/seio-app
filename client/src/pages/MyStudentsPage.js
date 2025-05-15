import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Eye, Edit, Trash2, UserPlus } from 'lucide-react';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const MisEstudiantes = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // Usar la nueva ruta para obtener solo los estudiantes del profesor
        const response = await axios.get(`${API_URL}/api/teacher/students/${user.id}`);
        setStudents(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar estudiantes:', error);
        setLoading(false);
      }
    };

    if (user && user.id) {
      fetchStudents();
    }
  }, [user]);

  const handleDelete = (id, name) => {
    Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar al estudiante ${name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`${API_URL}/api/students/${id}`);
          setStudents(students.filter(student => student.id !== id));
          Swal.fire(
            'Eliminado',
            'El estudiante ha sido eliminado correctamente',
            'success'
          );
        } catch (error) {
          console.error('Error al eliminar estudiante:', error);
          Swal.fire(
            'Error',
            'No se pudo eliminar al estudiante',
            'error'
          );
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container my-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Mis Estudiantes</h2>
        <Link to="/estudiantes/nuevo" className="btn btn-primary d-flex align-items-center gap-2">
          <UserPlus size={20} />
          Registrar Estudiante
        </Link>
      </div>

      {students.length === 0 ? (
        <div className="alert alert-info">
          No tienes estudiantes asignados. Puedes registrar nuevos estudiantes o asignar estudiantes existentes.
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Grado</th>
                    <th>Curso</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>{student.contact_phone}</td>
                      <td>{student.grade}°</td>
                      <td>{student.course_name}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link to={`/estudiantes/${student.id}`} className="btn btn-sm btn-outline-info">
                            <Eye size={16} />
                          </Link>
                          <Link to={`/estudiantes/editar/${student.id}`} className="btn btn-sm btn-outline-primary">
                            <Edit size={16} />
                          </Link>
                          <button 
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(student.id, student.name)}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default MisEstudiantes;
