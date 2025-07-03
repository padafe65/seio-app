// src/pages/students/StudentDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const StudentDetail = () => {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/students/${id}`);
        setStudent(response.data);
        console.log(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar estudiante:', error);
        setError('No se pudo cargar la información del estudiante');
        setLoading(false);
      }
    };
    
    fetchStudent();
  }, [id]);
  
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
      <div className="alert alert-warning">
        No se encontró el estudiante solicitado.
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
      
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">{student.name}</h5>
          <div className="row mt-4">
            <div className="col-md-6">
              <p><strong>Email de Usuario:</strong> {student.email}</p>
              <p><strong>Email de Contacto:</strong> {student.contact_email}</p>
              <p><strong>Teléfono de Usuario:</strong> {student.phone}</p>
              <p><strong>Teléfono de Contacto:</strong> {student.contact_phone}</p>
            </div>
            <div className="col-md-6">
              <p><strong>Edad:</strong> {student.age} años</p>
              <p><strong>Grado:</strong> {student.grade}°</p>
              <p><strong>Curso:</strong> {student.course_name}</p>
              <p><strong>Rol:</strong> {student.role}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetail;
