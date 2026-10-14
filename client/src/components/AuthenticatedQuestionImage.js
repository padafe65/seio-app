import React, { useEffect, useState } from 'react';
import api from '../api/axiosClient';

export default function AuthenticatedQuestionImage({ src, alt = '', className = '', style }) {
  const [displaySrc, setDisplaySrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl;
    let active = true;
    setFailed(false);
    if (!src) return undefined;
    if (!src.startsWith('/questionnaire-imports/assets/')) {
      const base = api.defaults.baseURL.replace(/\/api\/?$/, '');
      setDisplaySrc(/^https?:\/\//i.test(src) ? src : `${base}${src}`);
      return undefined;
    }
    api.get(src, { responseType: 'blob' }).then(({ data }) => {
      objectUrl = URL.createObjectURL(data);
      if (active) setDisplaySrc(objectUrl);
    }).catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!src || failed || !displaySrc) return null;
  return <img src={displaySrc} alt={alt} className={className} style={style} onError={() => setFailed(true)} />;
}
