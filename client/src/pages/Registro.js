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
  const navigate = useNavigate();
  const { establishSession } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        ...user,
        role: 'estudiante'
      });
      
      const userId = response.data.user.id;
      const registeredUser = response.data.user;
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
        icon: profileImageUploadFailed ? 'warning' : 'success',
        title: profileImageUploadFailed ? 'Cuenta creada' : 'Atención',
        html: `<i><strong> ${user.name} </strong>, su registro fue exitoso. Ya está habilitado en la plataforma SEIO.</i>${profileImageUploadFailed ? '<p class="mt-2">No se pudo guardar la foto. Puedes agregarla más tarde desde tu perfil.</p>' : ''}`,
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
          placeholder="Contraseña" 
          onChange={handleChange} 
          className="form-control mb-2" 
          required 
        />

        <p className="text-muted mb-3">El registro público crea cuentas de estudiante. Las cuentas docentes son creadas por el superadministrador.</p>

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
