// VideoLogoSplash.js – Intro video when the app starts (Login/landing)
import React, { useState, useEffect } from 'react';

const VIDEO_SRC = '/videos/videologo.mp4';
const STORAGE_KEY = 'seio_video_splash_hide';

const VideoLogoSplash = ({ onComplete, videoSrc = VIDEO_SRC }) => {
  const [muted, setMuted] = useState(true); // Muted for autoplay (browser policy)

  useEffect(() => {
    const hide = sessionStorage.getItem(STORAGE_KEY);
    if (hide === '1') onComplete?.();
  }, [onComplete]);

  const handleEnded = () => {
    onComplete?.();
  };

  const handleSkip = () => {
    onComplete?.();
  };

  const handleError = () => {
    onComplete?.();
  };

  const handleDontShowAgain = (e) => {
    if (e.target.checked) {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  // If we already decided to hide, render nothing (parent will show Login)
  const hide = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === '1';
  if (hide) return null;

  return (
    <div
      className="video-splash-wrapper"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <video
        src={videoSrc}
        autoPlay
        muted={muted}
        playsInline
        onEnded={handleEnded}
        onError={handleError}
        style={{
          maxWidth: '100%',
          maxHeight: '85vh',
          objectFit: 'contain',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline-light btn-sm"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          >
            {muted ? '🔇 Sonido' : '🔊 Sonido'}
          </button>
          <button
            type="button"
            className="btn btn-light btn-sm"
            onClick={handleSkip}
          >
            Saltar
          </button>
        </div>
        <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
          <input
            type="checkbox"
            onChange={handleDontShowAgain}
            style={{ marginRight: '0.35rem' }}
          />
          No mostrar de nuevo esta sesión
        </label>
      </div>
    </div>
  );
};

export default VideoLogoSplash;
