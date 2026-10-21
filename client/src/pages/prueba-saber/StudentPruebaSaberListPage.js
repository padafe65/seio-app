import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { BookOpen, Clock, GraduationCap } from 'lucide-react';
import Swal from 'sweetalert2';

export default function StudentPruebaSaberListPage() {
  const [applications, setApplications] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axiosClient.get('/prueba-saber/applications')
      .then((response) => { setApplications(response.data?.data || []); setCoverage(response.data?.coverage || null); })
      .catch((error) => console.error('No se cargaron las pruebas Preicfes', error))
      .finally(() => setLoading(false));
  }, []);

  const openApplication = async (application) => {
    if (!application.attempt) {
      try { await axiosClient.post(`/prueba-saber/applications/${application.id}/start`); }
      catch (error) { window.alert(error.response?.data?.message || 'No se pudo iniciar la prueba.'); return; }
    }
    navigate(`/student/prueba-saber/application/${application.id}`);
  };

  const redeemCode = async (event) => {
    event.preventDefault(); setRedeeming(true);
    try {
      const response = await axiosClient.post('/prueba-saber/enrollment-codes/redeem', { code });
      const apps = await axiosClient.get('/prueba-saber/applications');
      setApplications(apps.data?.data || []); setCoverage(apps.data?.coverage || null); setCode('');
      await Swal.fire('Matrícula completada', response.data?.message || 'Ya tienes acceso a tu curso Preicfes.', 'success');
    } catch (error) { Swal.fire('No se pudo usar el código', error.response?.data?.message || 'Verifica el código e inténtalo de nuevo.', 'error'); }
    finally { setRedeeming(false); }
  };

  if (loading) return <div className="container py-5 text-center">Cargando pruebas Preicfes...</div>;
  return <main className="container py-4">
    <div className="mb-4">
      <h2><GraduationCap className="me-2" />Pruebas Saber - Preicfes</h2>
      <p className="text-muted">Resultados informativos del curso; no afectan tus notas de fase.</p>
      {coverage && <div className="alert alert-info">Preguntas cubiertas: <strong>{coverage.completed_questions} de {coverage.assigned_questions}</strong>.</div>}
      <form className="card card-body mb-4" onSubmit={redeemCode}><label htmlFor="preicfes-code" className="form-label">¿Tienes un código de matrícula?</label><div className="input-group"><input id="preicfes-code" className="form-control text-uppercase" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 12))} placeholder="Ingresa el código de 12 caracteres" maxLength={12} required /><button className="btn btn-outline-primary" disabled={redeeming || code.length !== 12}>{redeeming ? 'Validando…' : 'Matricularme'}</button></div><small className="text-muted mt-2">La matrícula Preicfes se agrega aparte y conserva tu institución escolar de origen.</small></form>
    </div>
    {applications.length === 0 ? <div className="alert alert-info">Aun no hay aplicaciones asignadas a tu matricula Preicfes CRECER.</div> : <div className="row">
      {applications.map((application) => <div className="col-md-6 col-lg-4 mb-3" key={application.id}>
        <article className="card h-100"><div className="card-body">
          <span className="badge bg-secondary mb-2">{application.subject} - {application.institution || 'CRECER'}</span>
          <h5>{application.title}</h5><p className="text-muted">{application.course_name}</p>
          <p><BookOpen size={17} className="me-2" />{JSON.parse(application.question_ids_json || '[]').length} preguntas</p>
          {application.time_limit_minutes && <p><Clock size={17} className="me-2" />{application.time_limit_minutes} minutos</p>}
          {application.attempt ? <div className="alert alert-success">Nota informativa: <strong>{application.attempt.score}/5.0</strong><br />{application.attempt.correct_count} correctas de {application.attempt.total_questions}</div> : <p className="text-muted">Pendiente</p>}
        </div><div className="card-footer bg-white"><button className="btn btn-primary w-100" onClick={() => openApplication(application)}>{application.attempt ? 'Ver resultado' : 'Presentar prueba'}</button></div></article>
      </div>)}
    </div>}
  </main>;
}
