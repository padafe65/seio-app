// src/pages/students/TeacherStudentsList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, Edit, Eye, Search } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const TeacherStudentsList = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    const fetchStudents = async () => {
      if (!user) {
        console.log('🔴 Usuario no autenticado');
        setLoading(false);
        return;
      }
      
      if (user.role !== 'docente') {
        console.log(`🔴 El usuario no es un docente (rol: ${user.role})`);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        console.log('🔑 Token obtenido:', token ? 'Token presente' : 'Token no encontrado');
        
        // Usar la ruta corregida
        const response = await axios.get(`${API_URL}/api/students/teacher/${user.teacher_id}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        });
        
        console.log('📊 Respuesta del servidor:', response.data);
        
        if (response.data && response.data.success) {
          setStudents(response.data.data || []);
          console.log(`✅ Se cargaron ${response.data.data?.length || 0} estudiantes`);
        } else {
          console.error('❌ La respuesta del servidor no tiene el formato esperado');
          setStudents([]);
        }
        
      } catch (error) {
        console.error('❌ Error al cargar estudiantes del docente:', error);
        
        if (error.response) {
          // El servidor respondió con un código de estado fuera del rango 2xx
          console.error('📌 Datos de la respuesta de error:', {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers
          });
          
          if (error.response.status === 401) {
            console.error('🔒 Error de autenticación. Por favor, inicia sesión nuevamente.');
            // Aquí podrías redirigir al login o mostrar un mensaje al usuario
          } else if (error.response.status === 403) {
            console.error('🚫 No tienes permiso para ver estos estudiantes');
          } else if (error.response.status === 404) {
            console.error('🔍 No se encontró el perfil de docente');
          } else {
            console.error(`⚠️ Error del servidor: ${error.response.status}`);
          }
        } else if (error.request) {
          // La solicitud fue hecha pero no se recibió respuesta
          console.error('🔌 No se pudo conectar con el servidor. Verifica tu conexión a internet.');
        } else {
          // Algo pasó en la configuración de la solicitud que provocó un error
          console.error('❌ Error al configurar la solicitud:', error.message);
        }
        
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStudents();
  }, [user]);
  
  const filteredStudents = students.filter(student => 
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade?.toString().includes(searchTerm) ||
    student.course_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Mis Estudiantes</h4>
        <Link to="/registro" className="btn btn-primary d-flex align-items-center">
          <PlusCircle size={18} className="me-2" /> Nuevo Estudiante
        </Link>
      </div>
      
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
                    <th>Tel_Estudiante</th>
                    <th>Teléfono_Contacto</th>
                    <th>Email_Contacto</th>
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
                        <td>{student.email}</td>
                        <td>{student.phone}</td>
                        <td>{student.contact_phone}</td>
                        <td>{student.contact_email}</td>
                        <td>{student.grade}°</td>
                        <td>{student.course_name}</td>
                        <td className="text-end">
                          <div className="btn-group">
                            <Link to={`/estudiantes/${student.id}`} className="btn btn-sm btn-outline-info">
                              <Eye size={16} />
                            </Link>
                            <Link to={`/estudiantes/${student.id}/editar`} className="btn btn-sm btn-outline-primary">
                              <Edit size={16} />
                            </Link>
                            <Link to={`/estudiantes/${student.id}/calificaciones`} className="btn btn-sm btn-outline-success">
                              Calificaciones
                            </Link>
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

export default TeacherStudentsList;
