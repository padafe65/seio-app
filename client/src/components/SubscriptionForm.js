import { useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function SubscriptionForm({ teacherId }) {
  const [method, setMethod] = useState('stripe'); // 'stripe' o 'nequi'
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (method === 'nequi') {
      // Flujo Nequi: Usamos FormData para enviar el archivo
      const formData = new FormData();
      formData.append('proof', file);
      formData.append('teacher_id', teacherId);
      formData.append('plan_type', 'monthly'); // o el que elijan
      formData.append('amount', 50000);
      
      try {
        await axiosClient.post('/subscriptions/notify-manual', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Comprobante enviado con éxito. Revisaremos tu pago pronto.');
      } catch (err) { alert('Error al enviar'); }
    } else {
      // Flujo Stripe (el que hicimos antes)
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded shadow">
      <h5>Método de pago</h5>
      <div className="mb-3">
        <input type="radio" name="method" onChange={() => setMethod('stripe')} checked={method === 'stripe'} /> Tarjeta (Stripe) <br/>
        <input type="radio" name="method" onChange={() => setMethod('nequi')} /> Nequi / Transferencia
      </div>

      {method === 'nequi' && (
        <div className="alert alert-info">
          <p>Envía <b>$50,000</b> al Nequi: <b>314 2999 274</b></p>
          <label>Sube el pantallazo:</label>
          <input type="file" className="form-control" onChange={(e) => setFile(e.target.files[0])} required />
        </div>
      )}

      <button className="btn btn-primary w-100 mt-3" disabled={loading}>
        {loading ? 'Procesando...' : 'Finalizar'}
      </button>
    </form>
  );
}