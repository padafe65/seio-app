// src/components/IdleTimerContainer.js
import React, { useRef } from 'react';
import { useIdleTimer } from 'react-idle-timer';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const IdleTimerContainer = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const idleTimerRef = useRef(null);
  
  // Tiempo de inactividad: 15 minutos (en milisegundos)
  const timeout = 1000 * 60 * 15;
  
  // Tiempo para mostrar advertencia: 1 minuto antes de logout
  const promptBeforeIdle = 1000 * 60;
  
  const onPrompt = () => {
    // Mostrar advertencia cuando quede 1 minuto
    MySwal.fire({
      title: '¿Sigues ahí?',
      text: 'Tu sesión está a punto de expirar por inactividad.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Mantener sesión',
      cancelButtonText: 'Cerrar sesión',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#d33',
      timer: promptBeforeIdle,
      timerProgressBar: true
    }).then((result) => {
      if (result.isConfirmed) {
        // Usuario quiere continuar
        idleTimerRef.current.reset();
      } else {
        // Usuario eligió cerrar sesión o el tiempo expiró
        handleLogout();
      }
    });
  };
  
  const onIdle = () => {
    // Ejecutar logout cuando se alcanza el tiempo de inactividad
    handleLogout();
  };
  
  const handleLogout = () => {
    MySwal.fire({
      title: 'Sesión expirada',
      text: 'Tu sesión ha expirado por inactividad.',
      icon: 'info',
      confirmButtonColor: '#3085d6',
      timer: 3000,
      timerProgressBar: true
    }).then(() => {
      logout();
      navigate('/login');
    });
  };
  
  const idleTimer = useIdleTimer({
    ref: idleTimerRef,
    timeout,
    promptBeforeIdle,
    onPrompt,
    onIdle,
    debounce: 500
  });
  
  return null; // Este componente no renderiza nada visible
};

export default IdleTimerContainer;
