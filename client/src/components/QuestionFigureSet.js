import React, { useEffect, useState } from 'react';
import api from '../api/axiosClient';
import AuthenticatedQuestionImage from './AuthenticatedQuestionImage';

export default function QuestionFigureSet({ questionId, fallbackSrc, alt = 'Figura de la pregunta', className = '', style }) {
  const [assets, setAssets] = useState(null);
  useEffect(() => {
    let active = true;
    if (!questionId) return undefined;
    api.get(`/questionnaire-imports/published-question-assets/${questionId}`)
      .then(({ data }) => { if (active) setAssets(data?.data || []); })
      .catch(() => { if (active) setAssets([]); });
    return () => { active = false; };
  }, [questionId]);

  const figures = assets?.length ? assets : null;
  if (figures) return <div className="d-flex flex-wrap justify-content-center gap-2">{figures.map((asset) => <AuthenticatedQuestionImage key={asset.id} src={asset.url} alt={asset.name || alt} className={className} style={style} />)}</div>;
  return <AuthenticatedQuestionImage src={fallbackSrc} alt={alt} className={className} style={style} />;
}
