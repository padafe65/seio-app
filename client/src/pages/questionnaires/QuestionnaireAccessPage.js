import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axiosClient';

const QuestionnaireAccessPage = () => {
  const { questionnaireId } = useParams();
  const [product, setProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [grants, setGrants] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const response = await api.get(`/questionnaire-imports/access/${questionnaireId}`);
    setProduct(response.data.data);
    setGrants(response.data.data.grants || []);
  };

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || 'No se pudo cargar el producto.'));
  }, [questionnaireId]);

  const searchUsers = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await api.get('/questionnaire-imports/access-users', { params: { search } });
      setUsers(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron buscar cuentas.');
    }
  };

  const grant = async (user) => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/questionnaire-imports/access/${questionnaireId}`, { user_id: user.id });
      setMessage(`Acceso autorizado para ${user.name}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo autorizar la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const revoke = async (userId) => {
    setLoading(true);
    setError('');
    try {
      await api.delete(`/questionnaire-imports/access/${questionnaireId}/${userId}`);
      setMessage('Se revocó el acceso.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo revocar el acceso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container py-4">
      <Link to="/cuestionarios/importar">← Volver a importaciones</Link>
      <h2 className="mt-3">Acceso al material</h2>
      <p className="text-muted">Solo el propietario y las cuentas autorizadas pueden consultar e iniciar este cuestionario.</p>
      {product && <div className="alert alert-info"><strong>{product.title}</strong> · ID {questionnaireId} · Propietario: {product.owner_name} ({product.owner_email})</div>}
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <section className="card mb-4">
        <div className="card-header fw-semibold">Autorizar una cuenta</div>
        <div className="card-body">
          <form className="d-flex gap-2" onSubmit={searchUsers}>
            <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busca por nombre, correo o ID" minLength={2} />
            <button className="btn btn-primary" disabled={search.trim().length < 2}>Buscar</button>
          </form>
          {users.length > 0 && <div className="list-group mt-3">{users.map((account) => (
            <div className="list-group-item d-flex justify-content-between align-items-center gap-3" key={account.id}>
              <span><strong>{account.name}</strong> · {account.email} · {account.role} · ID {account.id}</span>
              <button className="btn btn-sm btn-success" disabled={loading || grants.some((grantRow) => Number(grantRow.user_id) === Number(account.id) && grantRow.status === 'active')} onClick={() => grant(account)}>Autorizar</button>
            </div>
          ))}</div>}
        </div>
      </section>

      <section className="card">
        <div className="card-header fw-semibold">Cuentas autorizadas e historial</div>
        <div className="list-group list-group-flush">
          {grants.length === 0 && <div className="list-group-item text-muted">Aún no has autorizado cuentas.</div>}
          {grants.map((grantRow) => <div className="list-group-item d-flex justify-content-between align-items-center gap-3" key={grantRow.user_id}>
            <span><strong>{grantRow.name}</strong> · {grantRow.email} · ID {grantRow.user_id} · {grantRow.status === 'active' ? 'Activo' : 'Revocado'}</span>
            {grantRow.status === 'active' && <button className="btn btn-sm btn-outline-danger" disabled={loading} onClick={() => revoke(grantRow.user_id)}>Revocar</button>}
          </div>)}
        </div>
      </section>
    </main>
  );
};

export default QuestionnaireAccessPage;
