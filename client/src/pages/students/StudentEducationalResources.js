// pages/students/StudentEducationalResources.js
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import LearningResourcesSection from '../../components/educational-resources/LearningResourcesSection';
import { useState, useEffect } from 'react';

const StudentEducationalResources = () => {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState(null);
  const [grade, setGrade] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (user && user.role === 'estudiante') {
        try {
          const response = await axiosClient.get(`/students/by-user/${user.id}`);
          if (response.data && response.data.id) {
            setStudentId(response.data.id);
            setGrade(response.data.grade);
          }
        } catch (error) {
          console.error('Error al cargar datos del estudiante:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchStudentData();
  }, [user]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!studentId) {
    return (
      <div className="alert alert-warning">
        No se encontraron datos del estudiante. Por favor, completa tu registro.
      </div>
    );
  }

  return (
    <div>
      <LearningResourcesSection studentId={studentId} grade={grade} />
    </div>
  );
};

export default StudentEducationalResources;
