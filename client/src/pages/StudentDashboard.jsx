import React, { useEffect, useState } from 'react';
import axios from 'axios';

const StudentDashboard = ({ studentId }) => {
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAttempts = async () => {
            try {
                const res = await axios.get(`/api/quiz/attempts/all/${studentId}`);
                setAttempts(res.data.attempts);
            } catch (err) {
                setAttempts([]);
            } finally {
                setLoading(false);
            }
        };
        fetchAttempts();
    }, [studentId]);

    if (loading) return <p>Cargando intentos...</p>;

    return (
        <div>
            <h2>Intentos realizados</h2>
            <ul>
                {attempts.map((a) => (
                    <li key={a.questionnaire_id}>
                        Cuestionario #{a.questionnaire_id}: {a.attempt_count} intentos, {a.expired_count} expirados
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default StudentDashboard;
