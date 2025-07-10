// src/pages/students/StudentDetail.js
import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

// Usar la URL base correcta para la API
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authToken, user, verifyToken } = useAuth();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchStudent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔄 Iniciando solicitud para estudiante ID:', id);
        
        // Verificar autenticación
        if (!authToken) {
          console.error('❌ Error: No hay token de autenticación');
          setError('No estás autenticado. Serás redirigido al inicio de sesión...');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }
        
        // Verificar si el token es válido
        const isTokenValid = await verifyToken();
        if (!isTokenValid) {
          console.error('❌ Error: Token inválido o expirado');
          setError('Tu sesión ha expirado. Serás redirigido al inicio de sesión...');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        // 2. Verificar que la URL de la API sea correcta
        const url = `${API_URL}/api/students/${id}`;
        console.log('🌐 URL de la API:', url);
        
        // 3. Realizar la petición con el token
        console.log('🔍 Realizando petición...');
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          // Aceptar códigos de estado de error para manejarlos manualmente
          validateStatus: (status) => status < 500
        });
        
        console.log('📊 Respuesta del servidor:', {
          status: response.status,
          data: response.data
        });
        
        // 4. Manejar la respuesta
        if (response.status === 200 && response.data?.success) {
          console.log('✅ Datos del estudiante cargados correctamente');
          setStudent(response.data.data);
        } else if (response.status === 401) {
          // Token inválido o expirado
          console.error('❌ Error 401: Token inválido o expirado');
          localStorage.removeItem('token');
          setError('Tu sesión ha expirado. Serás redirigido al inicio de sesión...');
          setTimeout(() => navigate('/login'), 2000);
        } else if (response.status === 403) {
          // No autorizado
          console.error('❌ Error 403: No tienes permiso para ver este estudiante');
          setError('No tienes permiso para ver este estudiante.');
        } else {
          // Otros errores
          const errorMsg = response.data?.message || 'Error al cargar los datos del estudiante';
          console.error('❌ Error en la respuesta:', errorMsg);
          setError(errorMsg);
        }
      } catch (error) {
        console.error('Error al cargar estudiante:', error);
        if (error.response) {
          // El servidor respondió con un estado de error
          if (error.response.status === 403) {
            setError('No tienes permiso para ver este estudiante');
          } else if (error.response.status === 404) {
            setError('Estudiante no encontrado');
          } else {
            setError('Error al cargar la información del estudiante');
          }
        } else if (error.request) {
          // La petición fue hecha pero no hubo respuesta
          setError('No se pudo conectar con el servidor');
        } else {
          // Algo pasó en la configuración de la petición
          setError('Error al realizar la petición');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchStudent();
  }, [id, authToken, navigate, verifyToken]);
  
  if (loading) {
    return (
      <div className="text-center py-5">
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
  
  if (!student) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error || 'No se encontró el estudiante solicitado.'}
        </div>
        <Link to="/mis-estudiantes" className="btn btn-outline-secondary mt-3">
          Volver a la lista
        </Link>
      </div>
    );
  }
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Detalles del Estudiante</h4>
        <div>
          <Link to={`/estudiantes/${id}/editar`} className="btn btn-primary me-2">
            Editar
          </Link>
          <Link to="/mis-estudiantes" className="btn btn-outline-secondary">
            Volver
          </Link>
        </div>
      </div>
      
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-4">
            <div>
              <h4 className="card-title mb-1">{student.name}</h4>
              <p className="text-muted mb-0">ID: {student.id}</p>
            </div>
            <span className={`badge bg-${student.role === 'estudiante' ? 'success' : 'primary'} fs-6`}>
              {student.role === 'estudiante' ? 'Estudiante' : student.role}
            </span>
          </div>
          
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <h6 className="text-muted mb-1">Información de Contacto</h6>
                <div className="d-flex align-items-center mb-2">
                  <i className="bi bi-envelope me-2"></i>
                  <span>{student.email || 'No especificado'}</span>
                </div>
                <div className="d-flex align-items-center">
                  <i className="bi bi-telephone me-2"></i>
                  <span>{student.phone || 'No especificado'}</span>
                </div>
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="mb-3">
                <h6 className="text-muted mb-1">Información Académica</h6>
                <div className="d-flex align-items-center mb-2">
                  <i className="bi bi-mortarboard me-2"></i>
                  <span>{student.course_name || 'Curso no asignado'}</span>
                </div>
                <div className="d-flex align-items-center">
                  <i className="bi bi-calendar-check me-2"></i>
                  <span>Registrado el: {new Date(student.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4">
        <h5 className="mb-3">Actividad Reciente</h5>
        <div className="card">
          <div className="card-body">
            <p className="text-muted mb-0">
              <i className="bi bi-info-circle me-2"></i>
              Próximamente: Historial de cuestionarios realizados
            </p>
          </div>
        </div>
      </div>
      
      {/* Sección de Información Adicional */}
      <div className="card mt-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Información Adicional</h5>
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <h6 className="text-muted mb-1">Datos Personales</h6>
                <div className="d-flex align-items-center mb-2">
                  <i className="bi bi-calendar3 me-2"></i>
                  <span><strong>Edad:</strong> {student.age || 'No especificada'} años</span>
                </div>
                <div className="d-flex align-items-center">
                  <i className="bi bi-mortarboard me-2"></i>
                  <span><strong>Grado:</strong> {student.grade ? `${student.grade}°` : 'No especificado'}</span>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="mb-3">
                <h6 className="text-muted mb-1">Estado</h6>
                <div className="d-flex align-items-center">
                  <i className="bi bi-person-badge me-2"></i>
                  <span><strong>Estado:</strong> {student.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetail;
