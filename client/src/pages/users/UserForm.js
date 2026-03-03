import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { ArrowLeft, Save } from 'lucide-react';

const UserForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState(null); // 🛠️ ADICIÓN: Estado para info del creador
  const [instituciones, setInstituciones] = useState([]);
const [formData, setFormData] = useState({
  name: '',
  email: '',
  phone: '',
  password: '',
  role: '',
  estado: 1,
  institution: '',
  course_name: '',
  grade: '',
  created_by: '' // <-- Centralizado aquí
});

// Este lo dejamos solo para mostrar el NOMBRE legible (ej: "Juan Perez")
const [creatorName, setCreatorName] = useState('');
  useEffect(() => {
    if (!isAuthReady) return;
    
    // Permitir acceso a super_administrador y administrador
    if (!user || (user.role !== 'super_administrador' && user.role !== 'administrador')) {
      navigate('/');
      return;
    }

    if (id) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [id, user, isAuthReady, navigate]);
  
  // Determinar roles permitidos según el nivel de acceso del usuario
  const getAllowedRoles = () => {
    if (!user) return [];
    
    if (user.role === 'super_administrador') {
      // Super administrador puede asignar todos los roles
      return ['estudiante', 'docente', 'administrador', 'super_administrador'];
    } else if (user.role === 'administrador') {
      // Administrador solo puede asignar estudiante y docente
      return ['estudiante', 'docente'];
    }
    
    return [];
  };

  const [studentContactData, setStudentContactData] = useState({
    contact_phone: '',
    contact_email: '',
    contact_name: ''
  });

  useEffect(() => {
  const loadInstitutions = async () => {
    try {
      const res = await axiosClient.get('/admin/institutions/list');
      setInstituciones(res.data.data || []);
    } catch (err) {
      console.error("Error cargando lista de instituciones", err);
    }
  };
  loadInstitutions();
}, []);

const fetchUser = async () => {
  try {
    setLoading(true);
    const response = await axiosClient.get(`/admin/users/${id}`);
    const userData = response.data.data || response.data;

    // 🛠️ AGREGADO: Capturamos la información legible del creador 
    // (Nombre y Rol para mostrar en la interfaz)
    if (userData.creator_name) {
      setCreatorInfo({
        name: userData.creator_name,
        role: userData.creator_role
      });
    }

    // ✨ LÓGICA EXISTENTE: Obtener el curso actual si es docente
    let courseInfo = { name: '', grade: '' };
    if (userData.role === 'docente') {
      try {
        const tIdRes = await axiosClient.get(`/teacher-courses/teacher-id/${id}`);
        const coursesRes = await axiosClient.get(`/teacher-courses/teacher/${tIdRes.data.teacherId}`);
        
        if (coursesRes.data && coursesRes.data.length > 0) {
          courseInfo.name = coursesRes.data[0].course_name;
          courseInfo.grade = coursesRes.data[0].grade;
        }
      } catch (e) {
        console.log("El docente aún no tiene cursos asignados");
      }
    }

    // 🛠️ ACTUALIZACIÓN DEL FORMULARIO:
    // Se mapean todos los campos de la tabla 'users' + la info de cursos
    setFormData({
      name: userData.name || '',
      email: userData.email || '',
      phone: userData.phone || '',
      password: '', // La contraseña siempre inicia vacía por seguridad
      role: userData.role || '',
      estado: userData.estado !== undefined ? userData.estado : 1,
      institution: userData.institution || '',
      course_name: courseInfo.name, 
      grade: courseInfo.grade,
      // 🛠️ AGREGADO: Guardamos el ID del creador en el estado del formulario
      created_by: userData.created_by || ''
    });

    // Carga de datos de contacto adicionales si es estudiante
    if (userData.role === 'estudiante' && id) {
      try {
        const studentResponse = await axiosClient.get(`/students/user/${id}`);
        if (studentResponse.data) {
          setStudentContactData({
            contact_phone: studentResponse.data.contact_phone || '',
            contact_email: studentResponse.data.contact_email || '',
            contact_name: studentResponse.data.contact_name || ''
          });
        }
      } catch (studentError) {
        console.log('ℹ️ No se encontraron datos adicionales de estudiante');
      }
    }
  } catch (error) {
    console.error('Error al cargar usuario:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo cargar el usuario',
      confirmButtonText: 'OK'
    }).then(() => navigate('/admin/users'));
  } finally {
    setLoading(false);
  }
};

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.name || !formData.email || !formData.role) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos obligatorios',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (!id && !formData.password) {
      Swal.fire({
        icon: 'warning',
        title: 'Contraseña requerida',
        text: 'La contraseña es obligatoria para nuevos usuarios',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (formData.password && formData.password.length < 6) {
      Swal.fire({
        icon: 'warning',
        title: 'Contraseña inválida',
        text: 'La contraseña debe tener al menos 6 caracteres',
        confirmButtonText: 'OK'
      });
      return;
    }

    try {
      setSaving(true);
      
      const dataToSend = { ...formData };
      // Si es edición y no se cambió la contraseña, no enviarla
      if (id && !dataToSend.password) {
        delete dataToSend.password;
      }

      if (id) {
        // Actualizar usuario existente
        await axiosClient.put(`/admin/users/${id}`, dataToSend);
        Swal.fire({
          icon: 'success',
          title: 'Usuario actualizado',
          text: 'El usuario se ha actualizado exitosamente',
          confirmButtonText: 'OK'
        });
        navigate('/admin/users');
      } else {
        // Crear nuevo usuario
        const response = await axiosClient.post('/admin/users', dataToSend);
        // El backend devuelve: { success: true, message: '...', data: { id: ..., ... } }
        const newUserId = response.data?.data?.id;
        
        // Si el rol es estudiante o docente, redirigir a formulario de completar datos
        if (formData.role === 'estudiante' || formData.role === 'docente') {
          // Guardar user_id en localStorage para que CompleteStudent/CompleteTeacher lo use
          if (newUserId) {
            localStorage.setItem('user_id', newUserId);
            // Marcar que viene de creación por admin (para redirigir correctamente después)
            localStorage.setItem('created_by_admin', 'true');
            
            Swal.fire({
              icon: 'success',
              title: 'Usuario creado',
              text: `Usuario creado exitosamente. Ahora completa los datos adicionales del ${formData.role}.`,
              confirmButtonText: 'Continuar',
              confirmButtonColor: '#3085d6'
            }).then(() => {
              // Redirigir según el rol
              if (formData.role === 'estudiante') {
                navigate('/CompleteStudent');
              } else if (formData.role === 'docente') {
                navigate('/CompleteTeacher');
              }
            });
          } else {
            Swal.fire({
              icon: 'success',
              title: 'Usuario creado',
              text: 'El usuario se ha creado exitosamente',
              confirmButtonText: 'OK'
            });
            navigate('/admin/users');
          }
        } else {
          // Para otros roles (admin, super_admin), solo mostrar mensaje y volver
          Swal.fire({
            icon: 'success',
            title: 'Usuario creado',
            text: 'El usuario se ha creado exitosamente',
            confirmButtonText: 'OK'
          });
          navigate('/admin/users');
        }
      }
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo guardar el usuario',
        confirmButtonText: 'OK'
      });
    } finally {
      setSaving(false);
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
    <div className="container-fluid py-4">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            {id ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
          </h5>
          <button
            className="btn btn-light btn-sm"
            onClick={() => navigate('/admin/users')}
          >
            <ArrowLeft size={18} className="me-1" />
            Volver
          </button>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="name" className="form-label">
                  Nombre Completo <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="email" className="form-label">
                  Correo Electrónico <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="phone" className="form-label">Teléfono</label>
                <input
                  type="text"
                  className="form-control"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Opcional"
                />
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="role" className="form-label">
                  Rol <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccione un rol</option>
                  {getAllowedRoles().map(role => (
                    <option key={role} value={role}>
                      {role === 'estudiante' ? 'Estudiante' :
                       role === 'docente' ? 'Docente' :
                       role === 'administrador' ? 'Administrador' :
                       role === 'super_administrador' ? 'Super Administrador' : role}
                    </option>
                  ))}
                </select>
                {user?.role === 'administrador' && (
                  <small className="form-text text-muted">
                    ⚠️ Como administrador solo puedes asignar roles de Estudiante o Docente
                  </small>
                )}
              </div>
            </div>

            {/* Mostrar datos de contacto del estudiante solo si es estudiante y se está editando */}
            {formData.role === 'estudiante' && id && (
              <div className="row mt-3">
                <div className="col-12">
                  <h6 className="text-muted mb-3">📋 Datos de Contacto del Acudiente (Estudiante)</h6>
                </div>
                <div className="col-md-6 mb-3">
                  <label htmlFor="contact_phone" className="form-label">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="contact_phone"
                    name="contact_phone"
                    value={studentContactData.contact_phone}
                    disabled
                    placeholder="No disponible"
                  />
                  <small className="form-text text-muted">
                    Teléfono del acudiente o contacto del estudiante
                  </small>
                </div>
                <div className="col-md-6 mb-3">
                  <label htmlFor="contact_email" className="form-label">
                    Correo de Contacto
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    id="contact_email"
                    name="contact_email"
                    value={studentContactData.contact_email}
                    disabled
                    placeholder="No disponible"
                  />
                  <small className="form-text text-muted">
                    Correo del acudiente o contacto del estudiante
                  </small>
                </div>
                <div className="col-12 mb-3">
                  <div className="alert alert-info mb-0">
                    <i className="bi bi-info-circle me-2"></i>
                    Para editar estos datos de contacto, ve a la sección de estudiantes y edita el perfil completo del estudiante.
                  </div>
                </div>
              </div>
            )}

            <div className="row align-items-end"> {/* align-items-end nivela el cuadro con el input */}
              <div className="col-md-6 mb-3">
                <label htmlFor="institution" className="form-label">
                  Institución <span className="text-muted">(Opcional)</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="institution"
                  name="institution"
                  value={formData.institution}
                  onChange={handleChange}
                  placeholder="Ej: Colegio La Chucua..."
                  list="institutions-list"
                />
                {/* ... datalist y small igual ... */}
              </div>

              {/* BLOQUE NUEVO: Mostrar info del creador al lado derecho */}
              {id && (formData.created_by || creatorInfo) && (
                <div className="col-md-6 mb-3">
                  <div className="p-2 border rounded bg-light shadow-sm" style={{ borderLeft: '4px solid #0d6efd', minHeight: '38px' }}>
                    <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>REGISTRO CREADO POR:</small>
                    <div className="d-flex align-items-center">
                      <strong className="text-primary" style={{ fontSize: '0.85rem' }}>
                        {creatorInfo?.name || `ID: ${formData.created_by}`}
                      </strong>
                      {creatorInfo?.role && (
                        <span className="badge bg-secondary ms-2 text-capitalize" style={{ fontSize: '0.7rem' }}>
                          {creatorInfo.role.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 👇 PEGA ESTO AQUÍ (NUEVO BLOQUE PARA DOCENTES) */}
            {formData.role === 'docente' && (
              <div className="row p-3 mb-3 border rounded bg-light mx-1 shadow-sm">
                <div className="col-12">
                  <h6 className="text-primary mb-3">📚 Configuración de Curso (Nuevo Docente)</h6>
                </div>
                <div className="col-md-6 mb-3">
                  <label htmlFor="course_name" className="form-label">Nombre del Curso <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    id="course_name"
                    name="course_name"
                    value={formData.course_name}
                    onChange={handleChange}
                    placeholder="Ej: 11A, Física I"
                    required={formData.role === 'docente'}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label htmlFor="grade" className="form-label">Grado / Nivel</label>
                  <input
                    type="text"
                    className="form-control"
                    id="grade"
                    name="grade"
                    value={formData.grade}
                    onChange={handleChange}
                    placeholder="Ej: 11, 7, Universitario"
                  />
                </div>
              </div>
            )}
            {/* 👆 HASTA AQUÍ EL BLOQUE NUEVO */}

            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="password" className="form-label">
                  Contraseña {id ? <span className="text-muted">(dejar vacío para no cambiar)</span> : <span className="text-danger">*</span>}
                </label>
                <input
                  type="password"
                  className="form-control"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={!id}
                  minLength={6}
                  placeholder={id ? "Dejar vacío para mantener la contraseña actual" : "Mínimo 6 caracteres"}
                />
              </div>

              {id && (
                <div className="col-md-6 mb-3">
                  <label htmlFor="estado" className="form-label">Estado</label>
                  <select
                    className="form-select"
                    id="estado"
                    name="estado"
                    value={formData.estado}
                    onChange={(e) => setFormData(prev => ({ ...prev, estado: parseInt(e.target.value) }))}
                  >
                    <option value={1}>Activo</option>
                    <option value={0}>Inactivo</option>
                  </select>
                </div>
              )}
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/admin/users')}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={18} className="me-2" />
                    {id ? 'Actualizar' : 'Crear'} Usuario
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserForm;

