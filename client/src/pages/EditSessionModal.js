import { useState } from 'react';
import axiosClient from './axiosClient';

const EditSessionModal = ({ session, onClose, onUpdated }) => {
  const [form, setForm] = useState({
    status: session.status,
    expires_at: session.expires_at || '',
    answers_json: session.answers_json || '',
    question_ids_json: session.question_ids_json || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.patch(`/teacher/sessions/${session.id}`, form);
      onUpdated();
      onClose();
    } catch (err) {
      console.error('Error actualizando sesión', err);
      alert('Error actualizando sesión');
    }
  };

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <label>
          Status:
          <input name="status" value={form.status} onChange={handleChange} />
        </label>
        <label>
          Expires At:
          <input name="expires_at" type="datetime-local" value={form.expires_at} onChange={handleChange} />
        </label>
        <label>
          Question IDs JSON:
          <textarea name="question_ids_json" value={form.question_ids_json} onChange={handleChange} />
        </label>
        <label>
          Answers JSON:
          <textarea name="answers_json" value={form.answers_json} onChange={handleChange} />
        </label>
        <button type="submit">Guardar</button>
        <button type="button" onClick={onClose}>Cancelar</button>
      </form>
    </div>
  );
};

export default EditSessionModal;
