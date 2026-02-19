// client/src/components/UserAvatar.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UserAvatar = ({ user, size = 'md', authToken = null }) => {
  const [freshUser, setFreshUser] = useState(user);
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  // Obtener datos frescos del servidor si es necesario
  useEffect(() => {
    if (authToken && user?.id && !user?.profile_image) {
      const fetchFreshData = async () => {
        try {
          const response = await axios.get(`${API_URL}/api/admin/me`, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          if (response.data && response.data.data) {
            setFreshUser(response.data.data);
          }
        } catch (error) {
          console.warn('⚠️ No se pudieron obtener datos frescos del servidor:', error.message);
          setFreshUser(user);
        }
      };
      fetchFreshData();
    } else {
      setFreshUser(user);
    }
  }, [user, authToken, API_URL]);

  const sizeMap = {
    xs: '30px',
    sm: '40px',
    md: '60px',
    lg: '100px',
    xl: '120px'
  };

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase() || 'U';
  };

  // Colores diferentes según el ID del usuario para avatares únicos
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
  const colorIndex = (freshUser?.id || 0) % colors.length;

  const profileImage = freshUser?.profile_image;
  const initials = getInitials(freshUser?.name);

  // Si tiene imagen de perfil, mostrarla
  if (profileImage) {
    return (
      <img 
        src={`${API_URL}${profileImage}`}
        alt={freshUser?.name || 'Perfil'}
        style={{
          width: sizeMap[size],
          height: sizeMap[size],
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid #dee2e6',
          cursor: 'pointer',
          transition: 'transform 0.2s ease-in-out'
        }}
        title={freshUser?.name}
        onError={(e) => {
          // Fallback a avatar con iniciales si la imagen falla
          e.target.style.display = 'none';
          e.target.nextSibling?.style.setProperty('display', 'flex');
        }}
      />
    );
  }

  // Avatar por defecto con iniciales y color
  return (
    <div
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        borderRadius: '50%',
        backgroundColor: colors[colorIndex],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        fontSize: size === 'xs' ? '10px' : size === 'sm' ? '12px' : size === 'md' ? '16px' : size === 'lg' ? '20px' : '24px',
        border: '2px solid #dee2e6',
        cursor: 'pointer',
        transition: 'transform 0.2s ease-in-out',
        userSelect: 'none'
      }}
      title={freshUser?.name || 'Usuario'}
      className="user-avatar"
    >
      {initials}
    </div>
  );
};

export default UserAvatar;
