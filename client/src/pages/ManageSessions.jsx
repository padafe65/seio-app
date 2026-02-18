import React, { useEffect, useState } from 'react'; 
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { Trash2, AlertCircle, Users, Search, Edit3 } from 'lucide-react';

const ManageSessions = () => {
    const { user } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingSession, setEditingSession] = useState(null);

    const openEditModal = (session) => setEditingSession(session);
    const closeEditModal = () => setEditingSession(null);

    /*const fetchSessions = async () => {
        if (!user?.teacher_id) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await axiosClient.get(`/teacher/${user.teacher_id}/sessions`);
            setSessions(response.data?.data || []);
            setError(null);
        } catch (err) {
            console.error('Error cargando sesiones:', err);
            setError('Error al cargar las sesiones.');
        } finally {
            setLoading(false);
        }
    };*/

    const fetchSessions = async () => {
    try {
        setLoading(true);
        const response = await axiosClient.get('/teacher/sessions/all');
        setSessions(response.data?.data || []);
        setError(null);
    } catch (err) {
        console.error('Error cargando sesiones:', err);
        setError('Error al cargar las sesiones.');
    } finally {
        setLoading(false);
    }
};


    useEffect(() => {
        fetchSessions();
    }, [user]);

    const formatForDateTimeLocal = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
};


    const handleDeleteSession = async (sessionId) => {
        if (!window.confirm('¿Eliminar esta sesión de evaluación?')) return;
        try {
            await axiosClient.delete(`/quiz-sessions/${sessionId}`);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
        } catch (err) {
            console.error('Error eliminando sesión:', err);
            alert('Error al eliminar la sesión');
        }
    };

    const handleReopenSession = async (sessionId) => {
        if (!window.confirm('¿Reabrir esta sesión de evaluación?')) return;
        try {
            await axiosClient.patch(`/teacher/sessions/${sessionId}/reopen`);
            fetchSessions();
        } catch (err) {
            console.error('Error reabriendo sesión:', err);
            alert('Error al reabrir la sesión');
        }
    };

    // ============================================
    // EDICIÓN DE SESIÓN - CAMBIO DINÁMICO
    // ============================================
    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditingSession(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveEdit = async () => {
        if (!editingSession) return;

        try {
            await axiosClient.patch(`/teacher/sessions/${editingSession.id}`, editingSession);
            fetchSessions();
            closeEditModal();
        } catch (err) {
            console.error('Error actualizando sesión:', err);
            alert('Error al actualizar la sesión');
        }
    };

    const filteredSessions = sessions.filter(s =>
        s.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.questionnaire_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.status?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status) => {
        switch (status) {
            case 'submitted':
                return <span className="badge bg-success">Finalizado</span>;
            case 'in_progress':
                return <span className="badge bg-warning text-dark">En progreso</span>;
            case 'interrupted':
                return <span className="badge bg-danger">Interrumpido</span>;
            default:
                return <span className="badge bg-secondary">{status}</span>;
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center p-5">
                <div className="spinner-border text-primary" />
            </div>
        );
    }

    return (
        <div className="container-fluid p-4">
            <div className="mb-4">
                <h2 className="text-primary d-flex align-items-center">
                    <Users className="me-2" />
                    Gestión de Sesiones de Evaluación
                </h2>
                <p className="text-muted">Administre intentos y estados de los estudiantes.</p>
            </div>

            {error && (
                <div className="alert alert-danger d-flex align-items-center mb-4">
                    <AlertCircle className="me-2" />
                    {error}
                </div>
            )}

            {/* Buscador */}
            <div className="card shadow-sm mb-4">
                <div className="card-body">
                    <div className="input-group">
                        <span className="input-group-text bg-white border-end-0">
                            <Search size={18} className="text-muted" />
                        </span>
                        <input
                            type="text"
                            className="form-control border-start-0 ps-0"
                            placeholder="Buscar estudiante, cuestionario o estado..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Tabla */}
            <div className="card shadow-sm">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th>Estudiante</th>
                                    <th>Cuestionario</th>
                                    <th>Estado</th>
                                    <th>Intento</th>
                                    <th>Inicio</th>
                                    <th>Finalizó</th>
                                    <th className="text-end pe-4">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSessions.length > 0 ? (
                                    filteredSessions.map(sess => (
                                        <tr key={sess.id}>
                                            <td>{sess.student_name}</td>
                                            <td>{sess.questionnaire_title}</td>
                                            <td>{getStatusBadge(sess.status)}</td>
                                            <td>{sess.attempt_number}</td>
                                            <td>{new Date(sess.started_at).toLocaleString('es-ES')}</td>
                                            <td>{new Date(sess.expires_at).toLocaleString('es-ES')}</td>
                                            <td className="text-end pe-4">
                                                <button
                                                    className="btn btn-sm btn-outline-warning me-2"
                                                    onClick={() => handleReopenSession(sess.id)}
                                                >
                                                    Reabrir
                                                </button>

                                                <button
                                                    className="btn btn-sm btn-outline-primary me-2"
                                                    onClick={() => openEditModal(sess)}
                                                >
                                                    <Edit3 size={16} />
                                                </button>

                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => handleDeleteSession(sess.id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5 text-muted">
                                            No hay sesiones registradas.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal de edición */}
            {editingSession && (
                <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Editar Sesión</h5>
                                <button type="button" className="btn-close" onClick={closeEditModal}></button>
                            </div>
                            <div className="modal-body">
                                {[
                                    { label: 'Estudiante (ID)', name: 'student_id', type: 'number' },
                                    { label: 'Cuestionario (ID)', name: 'questionnaire_id', type: 'number' },
                                    { label: 'Intento', name: 'attempt_number', type: 'number' },
                                    { label: 'Año académico', name: 'academic_year', type: 'number' },
                                    { label: 'Estado', name: 'status', type: 'select', options: ['in_progress', 'submitted', 'interrupted'] },
                                    { label: 'Inicio', name: 'started_at', type: 'datetime-local' },
                                    { label: 'Finalizó', name: 'expires_at', type: 'datetime-local' },
                                    { label: 'Question IDs JSON', name: 'question_ids_json', type: 'textarea' },
                                    { label: 'Answers JSON', name: 'answers_json', type: 'textarea' },
                                    { label: 'Creado', name: 'created_at', type: 'readonly' },
                                    { label: 'Actualizado', name: 'updated_at', type: 'readonly' },
                                ].map(field => (
                                    <div className="mb-3" key={field.name}>
                                        <label className="form-label">{field.label}</label>
                                        {field.type === 'select' ? (
                                            <select
                                                className="form-select"
                                                name={field.name}
                                                value={editingSession[field.name]}
                                                onChange={handleEditChange}
                                            >
                                                {field.options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'textarea' ? (
                                            <textarea
                                                className="form-control"
                                                name={field.name}
                                                value={editingSession[field.name] || ''}
                                                onChange={handleEditChange}
                                            />
                                        ) : field.type === 'readonly' ? (
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={editingSession[field.name]}
                                                disabled
                                            />
                                        ) : (
                                            <input
                                                type={field.type}
                                                className="form-control"
                                                name={field.name}
                                                value={
                                                    field.type.includes('datetime')
                                                        ? formatForDateTimeLocal(editingSession[field.name])
                                                        : editingSession[field.name] || ''
                                                }

                                                onChange={handleEditChange}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeEditModal}>Cancelar</button>
                                <button type="button" className="btn btn-primary" onClick={handleSaveEdit}>Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ManageSessions;
