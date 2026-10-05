import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import ImageUploader from '../components/ImageUploader';
import { useAuth } from '../context/AuthContext';

const notiMySwal = withReactContent(Swal);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Registro = () => {
  const [user, setUser] = useState({ name: '', phone: '', email: '', password: '' });
  const [profileImage, setProfileImage] = useState(null);
  const [subjectType, setSubjectType] = useState('adult_student');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [guardian, setGuardian] = useState({ name: '', relationship: '', email: '' });
  const navigate = useNavigate();
  const { establishSession } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (user.password.length < 8 || !/[^\p{L}\p{N}]/u.test(user.password)) {
      notiMySwal.fire({ icon: 'error', title: 'Contraseña inválida', text: 'Debe tener al menos 8 caracteres e incluir al menos un carácter especial.' });
      return;
    }
    if (!legalAccepted || (subjectType === 'minor_student' && (!guardian.name.trim() || !guardian.relationship.trim()))) {
      notiMySwal.fire({ icon: 'warning', title: 'Autorización requerida', text: 'Lee la política y completa la información del representante legal si el estudiante es menor de edad.' });
      return;
    }
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        ...user,
        legalConsent: {
          accepted: legalAccepted,
          subjectType,
          accepterName: subjectType === 'minor_student' ? guardian.name : user.name,
          accepterRelationship: subjectType === 'minor_student' ? guardian.relationship : 'titular mayor de edad',
          guardianEmail: subjectType === 'minor_student' ? guardian.email : user.email
        },
        role: 'estudiante'
      });
      
      const userId = response.data.user.id;
      const registeredUser = response.data.user;
      const emailNotificationFailed = response.data.notificationStatus !== 'sent';
      establishSession(response.data.token, registeredUser);
      localStorage.setItem('user_id', userId);  // ✅ CORREGIDO: ahora guarda 'user_id' con guión bajo

      let profileImageUploadFailed = false;
      if (profileImage instanceof File) {
        const formData = new FormData();
        formData.append('profileImage', profileImage);
        try {
          const imageResponse = await fetch(`${API_URL}/api/admin/upload-profile-image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${response.data.token}` },
            body: formData
          });
          profileImageUploadFailed = !imageResponse.ok;
        } catch (imageError) {
          profileImageUploadFailed = true;
        }
      }

      notiMySwal.fire({
        icon: profileImageUploadFailed || emailNotificationFailed ? 'warning' : 'success',
        title: profileImageUploadFailed || emailNotificationFailed ? 'Cuenta creada' : 'Atención',
        html: `<i><strong> ${user.name} </strong>, su registro fue exitoso. Ya está habilitado en la plataforma SEIO.</i>${profileImageUploadFailed ? '<p class="mt-2">No se pudo guardar la foto. Puedes agregarla más tarde desde tu perfil.</p>' : ''}${emailNotificationFailed ? '<p class="mt-2">No se pudo confirmar el envío de todos los correos. El estado quedó registrado y el administrador puede revisarlo en el panel.</p>' : '<p class="mt-2">Enviamos la constancia a los correos correspondientes.</p>'}`,
        imageUrl: "img/ingreso.gif",
        imageWidth: 100,
        imageHeight: 100,
        confirmButtonColor: '#3085d6'
      }).then(() => {
        if (registeredUser.role === 'estudiante') {
          navigate('/CompleteStudent');
        } else {
          navigate('/');
        }
      });

    } catch (error) {
      console.error(error);

      const mensaje = error.response?.data?.message || 'Ocurrió un error inesperado.';
      notiMySwal.fire({
        icon: 'error',
        title: 'Error',
        html: `<i><strong> ${user.name} </strong>, ${mensaje}</i>`,
        imageUrl: "img/error.gif",
        imageWidth: 100,
        imageHeight: 100,
        confirmButtonColor: '#3085d6'
      });
    }
  };

  return (
    <div className="container mt-5">
      <h2>Registro de Usuario</h2>
      <form onSubmit={handleSubmit}>
        <input 
          type="text" 
          name="name" 
          placeholder="Nombre completo" 
          onChange={handleChange} 
          className="form-control mb-2" 
          required 
        />

        <input 
          type="text" 
          name="phone" 
          placeholder="Teléfono fijo o celular" 
          onChange={handleChange} 
          className="form-control mb-2" 
          required 
        />

        <input 
          type="email" 
          name="email" 
          placeholder="Correo Electrónico" 
          onChange={handleChange} 
          className="form-control mb-2" 
          required 
        />

        <input 
          type="password" 
          name="password" 
          placeholder="Mínimo 8 caracteres y un carácter especial"
          onChange={handleChange} 
          className="form-control mb-2" 
          minLength={8}
          required 
        />
        <small className="text-muted d-block mb-2">Usa al menos 8 caracteres e incluye un carácter especial, por ejemplo !, @ o #.</small>

        <p className="text-muted mb-3">El registro público crea cuentas de estudiante. Las cuentas docentes son creadas por el superadministrador.</p>

        <div className="border rounded p-3 mb-3">
          <label className="form-label fw-bold">¿El estudiante es mayor de 18 años?</label>
          <select className="form-select mb-3" value={subjectType} onChange={(e) => setSubjectType(e.target.value)}>
            <option value="adult_student">Sí, es mayor de edad</option>
            <option value="minor_student">No, es menor de edad</option>
          </select>
          {subjectType === 'minor_student' && <>
            <div className="alert alert-warning">El padre, madre o representante legal debe revisar y otorgar la autorización. Esta aceptación quedará registrada como realizada por la persona que completa este formulario.</div>
            <input className="form-control mb-2" placeholder="Nombre del padre, madre o representante legal" value={guardian.name} onChange={(e) => setGuardian({ ...guardian, name: e.target.value })} required />
            <input className="form-control mb-2" placeholder="Relación con el estudiante" value={guardian.relationship} onChange={(e) => setGuardian({ ...guardian, relationship: e.target.value })} required />
            <input type="email" className="form-control mb-2" placeholder="Correo del representante legal" value={guardian.email} onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} required />
          </>}
          <div className="form-check">
            <input id="legalAccepted" type="checkbox" className="form-check-input" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} />
            <label htmlFor="legalAccepted" className="form-check-label">Declaro que leí la <a href="/politica-tratamiento-datos.html" target="_blank" rel="noreferrer">Política de tratamiento de datos personales</a> y autorizo el tratamiento para las finalidades descritas.</label>
          </div>
        </div>

        <ImageUploader 
          onImageUpload={setProfileImage}
          currentImage={profileImage}
          deferUpload
        />

        <button type="submit" className="btn btn-success w-100">Registrar</button>
      </form>
    </div>
  );
};

export default Registro;
