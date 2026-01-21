// src/pages/StudentGuidesPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import StudentGuidesPanel from '../components/educational-resources/StudentGuidesPanel';

const StudentGuidesPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (user && user.role === 'estudiante') {
        try {
          // Obtener datos del estudiante
          const studentResponse = await axiosClient.get(`/students/by-user/${user.id}`);
          setStudentData(studentResponse.data);
          setLoading(false);
        } catch (error) {
          console.error('Error al cargar datos del estudiante:', error);
          setLoading(false);
        }
      }
    };
    
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h3 mb-2">Guías de Estudio</h1>
              <p className="text-muted mb-0">
                Material de apoyo organizado por fase académica
              </p>
            </div>
            <Link to="/student/dashboard" className="btn btn-outline-secondary">
              Volver al Dashboard
            </Link>
          </div>
        </div>
      </div>
      
      {studentData?.id ? (
        <div className="row">
          <div className="col-12">
            <StudentGuidesPanel studentData={studentData} />
          </div>
        </div>
      ) : (
        <div className="row">
          <div className="col-12">
            <div className="alert alert-warning">
              No se pudo cargar la información del estudiante.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentGuidesPage;
