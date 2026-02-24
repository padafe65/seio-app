import React from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const WhatsAppSupport = () => {
  const { user } = useAuth();

  if (!user) return null;

  const phone = process.env.REACT_APP_WHATSAPP_NUMBER;

  const messagesByRole = {
    estudiante: "Hola soy estudiante y necesito ayuda en SEIO App",
    docente: "Hola soy docente y necesito soporte en SEIO App",
    administrador: "Hola soy administrador y necesito asistencia en SEIO App",
    super_administrador: "Hola soy super administrador y necesito soporte técnico"
  };

  const message = encodeURIComponent(
    messagesByRole[user.role] || "Hola necesito información sobre SEIO App"
  );

  return (
    <li className="nav-item">
      <a
        className="nav-link d-flex align-items-center text-success"
        href={`https://wa.me/${phone}?text=${message}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageCircle size={18} className="me-1" />
        Soporte
      </a>
    </li>
  );
};

export default WhatsAppSupport;