import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient'; // Usamos tu cliente configurado

export default function SubscriptionAdmin() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSubs = async () => {
    try {
      // Nota: Debes crear este endpoint en el backend que una 
      // las tablas subscriptions y payments
      const res = await axiosClient.get('/subscriptions/admin/all'); 
      setSubscriptions(res.data);
    } catch (err) {
      console.error("Error al cargar suscripciones", err);
    }
  };

  useEffect(() => {
    fetchSubs();
  }, []);

  const handleApprove = async (sub) => {
    if (!window.confirm(`¿Confirmas que recibiste el pago de ${sub.teacher_name}?`)) return;
    
    setLoading(true);
    try {
      await axiosClient.post('/subscriptions/approve', {
        payment_id: sub.payment_id,
        sub_id: sub.id,
        teacher_id: sub.teacher_id,
        plan_type: sub.plan_type
      });
      alert('¡Licencia activada con éxito!');
      fetchSubs(); // Recargamos la lista
    } catch (err) {
      alert('Error al aprobar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Gestión de Licencias y Pagos Manuales</h2>
      <div className="table-responsive">
        <table className="table table-hover border">
          <thead className="table-light">
            <tr>
              <th>Docente</th>
              <th>Plan</th>
              <th>Estado Sub.</th>
              <th>Comprobante</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map(sub => (
              <tr key={sub.id} className={sub.status === 'past_due' ? 'table-warning' : ''}>
                <td>
                  <b>{sub.teacher_name}</b><br/>
                  <small className="text-muted">{sub.institution}</small>
                </td>
                <td>{sub.plan_type === 'monthly' ? 'Mensual' : 'Anual'}</td>
                <td>
                  <span className={`badge ${sub.status === 'active' ? 'bg-success' : 'bg-danger'}`}>
                    {sub.status}
                  </span>
                </td>
                <td>
                  {sub.proof_image_url ? (
                    <a href={`${process.env.REACT_APP_API_URL}${sub.proof_image_url}`} target="_blank" rel="noreferrer">
                      Ver Pantallazo
                    </a>
                  ) : 'N/A'}
                </td>
                <td>
                  {sub.status !== 'active' && (
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => handleApprove(sub)}
                      disabled={loading}
                    >
                      Aprobar Nequi
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}