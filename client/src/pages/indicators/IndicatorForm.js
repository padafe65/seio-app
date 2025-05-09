// src/pages/indicators/IndicatorForm.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const IndicatorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  
  const [formData, setFormData] = useState({
    student_id: '',
    description: '',
    subject: '',
    phase: '1',
    achieved: false
  });
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    // Simulación de carga de estudiantes
    const fetchStudents = async () => {
      // Aquí normalmente harías una petición a tu API
      const mockStudents = [
        { id: 5, name: 'Pedro Hernandez' },
        { id: 8, name: 'Milán Santiago Tobón' },
        { id: 9, name: 'David Sebastian Ferreira M' },
        { id: 10, name: 'Paula Andrea Ferreira Mejia' },
        { id: 11, name: 'Marcos Andres' }
      ];
      
      setStudents(mockStudents);
    };
    
    fetchStudents();
    
    // Si estamos editando, cargar datos del indicador
    if (isEditing) {
      const fetchIndicator = async () => {
        try {
          // Simulación de datos
          const mockIndicator = {
            id: id,
            student_id: '10',
            description: 'Comprende y aplica conceptos de geometría básica',
            subject: 'Matemáticas',
            phase: '1',
            achieved: true
          };
          
          setFormData(mockIndicator);
          setLoading(false);
        } catch (error) {
          console.error('Error al cargar indicador:', error);
          setLoading(false);
        }
      };
      
      fetchIndicator();
    }
  }, [id, isEditing]);
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Aquí normalmente harías una petición a tu API
      console.log('Guardando indicador:', formData);
      
      // Simular una petición
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      navigate('/indicadores');
    } catch (error) {
      console.error('Error al guardar indicador:', error);
      setSubmitting(false);
    }
  };
  
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
    <div>
      <h4 className="mb-4">{isEditing ? 'Editar Indicador' : 'Nuevo Indicador'}</h4>
      
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="student_id" className="form-label">Estudiante</label>
              <select
                className="form-select"
                id="student_id"
                name="student_id"
                value={formData.student_id}
                onChange={handleChange}
                required
              >
                <option value="">Seleccionar Estudiante</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-3">
              <label htmlFor="description" className="form-label">Descripción del Indicador</label>
              <textarea
                className="form-control"
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                required
              ></textarea>
            </div>
            
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="subject" className="form-label">Asignatura</label>
                <input
                  type="text"
                  className="form-control"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="col-md-6 mb-3">
                <label htmlFor="phase" className="form-label">Fase</label>
                <select
                  className="form-select"
                  id="phase"
                  name="phase"
                  value={formData.phase}
                  onChange={handleChange}
                  required
                >
                  <option value="1">Fase 1</option>
                  <option value="2">Fase 2</option>
                  <option value="3">Fase 3</option>
                  <option value="4">Fase 4</option>
                </select>
              </div>
            </div>
            
            <div className="mb-3 form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="achieved"
                name="achieved"
                checked={formData.achieved}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="achieved">Logrado</label>
            </div>
            
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate('/indicadores')}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Guardando...
                  </>
                ) : (
                  'Guardar Indicador'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default IndicatorForm;
