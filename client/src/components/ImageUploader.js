// client/src/components/ImageUploader.js
import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import Swal from 'sweetalert2';

const ImageUploader = ({ onImageUpload, currentImage = null, deferUpload = false }) => {
  const [preview, setPreview] = useState(currentImage);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Solo JPG, PNG o WEBP',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Máximo 5MB',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (event) => setPreview(event.target.result);
    reader.readAsDataURL(file);

    if (deferUpload) {
      onImageUpload?.(file);
      return;
    }

    // Subir archivo
    setLoading(true);
    const formData = new FormData();
    formData.append('profileImage', file);

    try {
      const token = localStorage.getItem('authToken');
      const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
      
      const response = await fetch(`${API_URL}/api/admin/upload-profile-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        Swal.fire({
          icon: 'success',
          title: 'Éxito',
          text: 'Foto de perfil actualizada correctamente',
          confirmButtonColor: '#198754'
        });
        if (onImageUpload) {
          onImageUpload(data.data.profileImage);
        }
      } else {
        const errorData = await response.json();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorData.message || 'No se pudo subir la imagen',
          confirmButtonColor: '#3085d6'
        });
      }
    } catch (error) {
      console.error('Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al subir la imagen',
        confirmButtonColor: '#3085d6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    document.getElementById('imageInput')?.value && (document.getElementById('imageInput').value = '');
  };

  return (
    <div className="mb-3">
      <label className="form-label fw-bold">📷 Foto de Perfil (Opcional)</label>
      <div className="border-2 border-dashed rounded p-4 text-center bg-light" style={{ borderColor: '#dee2e6', cursor: 'pointer' }}>
        {preview ? (
          <div className="position-relative d-inline-block">
            <img 
              src={preview} 
              alt="Preview" 
              style={{ 
                width: '150px', 
                height: '150px', 
                borderRadius: '50%', 
                objectFit: 'cover',
                border: '3px solid #dee2e6'
              }} 
            />
            <button 
              type="button" 
              className="btn btn-sm btn-danger position-absolute" 
              style={{ top: '-10px', right: '-10px' }}
              onClick={handleRemove}
              disabled={loading}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div>
            <Upload size={40} className="text-muted mb-2" />
            <p className="text-muted mb-2">Arrastra tu foto o haz clic aquí</p>
          </div>
        )}
        <input 
          id="imageInput"
          type="file" 
          accept="image/*" 
          onChange={handleFileChange}
          className="form-control form-control-sm mt-2"
          disabled={loading}
        />
        {loading && (
          <div className="mt-2">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="text-primary small mt-2">Subiendo imagen...</p>
          </div>
        )}
      </div>
      <small className="text-muted d-block mt-2">
        ℹ️ Máximo 5MB. Formatos: JPG, PNG, WEBP
      </small>
    </div>
  );
};

export default ImageUploader;
