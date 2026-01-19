// pages/messages/MessagesPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { Mail, Send, Inbox, Trash2, Eye, EyeOff, Search, User, Clock } from 'lucide-react';

const MessagesPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'sent', 'compose'
  const [inboxMessages, setInboxMessages] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Formulario de nuevo mensaje
  const [newMessage, setNewMessage] = useState({
    receiver_id: '',
    subject: '',
    message: '',
    message_type: 'general'
  });
  
  useEffect(() => {
    if (user) {
      fetchInbox();
      fetchSentMessages();
      fetchUnreadCount();
      fetchRecipients();
    }
  }, [user]);
  
  const fetchInbox = async () => {
    try {
      const response = await axiosClient.get('/messages/inbox');
      setInboxMessages(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar bandeja de entrada:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSentMessages = async () => {
    try {
      const response = await axiosClient.get('/messages/sent');
      setSentMessages(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar mensajes enviados:', error);
    }
  };
  
  const fetchUnreadCount = async () => {
    try {
      const response = await axiosClient.get('/messages/unread-count');
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Error al obtener contador de no leídos:', error);
    }
  };
  
  const fetchRecipients = async () => {
    try {
      const response = await axiosClient.get('/messages/recipients');
      setRecipients(response.data.data || []);
    } catch (error) {
      console.error('Error al obtener destinatarios:', error);
    }
  };
  
  const handleViewMessage = async (messageId) => {
    try {
      const response = await axiosClient.get(`/messages/${messageId}`);
      setSelectedMessage(response.data.data);
      
      // Si es un mensaje no leído de la bandeja de entrada, actualizar
      if (activeTab === 'inbox') {
        await fetchInbox();
        await fetchUnreadCount();
      }
    } catch (error) {
      console.error('Error al obtener mensaje:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el mensaje'
      });
    }
  };
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.receiver_id || !newMessage.subject || !newMessage.message) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos'
      });
      return;
    }
    
    try {
      await axiosClient.post('/messages', newMessage);
      
      Swal.fire({
        icon: 'success',
        title: 'Mensaje enviado',
        text: 'Tu mensaje ha sido enviado correctamente',
        timer: 2000,
        showConfirmButton: false
      });
      
      // Limpiar formulario
      setNewMessage({
        receiver_id: '',
        subject: '',
        message: '',
        message_type: 'general'
      });
      
      // Actualizar mensajes enviados
      await fetchSentMessages();
      
      // Cambiar a pestaña de enviados
      setActiveTab('sent');
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo enviar el mensaje'
      });
    }
  };
  
  const handleDeleteMessage = async (messageId) => {
    const result = await Swal.fire({
      title: '¿Eliminar mensaje?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      try {
        await axiosClient.delete(`/messages/${messageId}`);
        
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'El mensaje ha sido eliminado',
          timer: 1500,
          showConfirmButton: false
        });
        
        // Actualizar listas
        await fetchInbox();
        await fetchSentMessages();
        await fetchUnreadCount();
        setSelectedMessage(null);
        
      } catch (error) {
        console.error('Error al eliminar mensaje:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo eliminar el mensaje'
        });
      }
    }
  };
  
  const handleMarkAsRead = async (messageId) => {
    try {
      await axiosClient.put(`/messages/${messageId}/read`);
      await fetchInbox();
      await fetchUnreadCount();
      
      if (selectedMessage && selectedMessage.id === messageId) {
        setSelectedMessage({ ...selectedMessage, read_status: true });
      }
    } catch (error) {
      console.error('Error al marcar como leído:', error);
    }
  };
  
  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'super_administrador': return 'bg-danger';
      case 'administrador': return 'bg-warning';
      case 'docente': return 'bg-primary';
      case 'estudiante': return 'bg-info';
      default: return 'bg-secondary';
    }
  };
  
  const getRoleText = (role) => {
    switch (role) {
      case 'super_administrador': return 'Super Admin';
      case 'administrador': return 'Admin';
      case 'docente': return 'Docente';
      case 'estudiante': return 'Estudiante';
      default: return role;
    }
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const filteredInbox = inboxMessages.filter(msg =>
    msg.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.sender_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.message?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredSent = sentMessages.filter(msg =>
    msg.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.receiver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.message?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const displayMessages = activeTab === 'inbox' ? filteredInbox : filteredSent;
  
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container py-4">
      <div className="row">
        <div className="col-12">
          <h2 className="mb-4">
            <Mail className="me-2" size={28} />
            Mensajería
          </h2>
          
          {/* Tabs */}
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'inbox' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('inbox');
                  setSelectedMessage(null);
                }}
              >
                <Inbox size={18} className="me-1" />
                Bandeja de Entrada
                {unreadCount > 0 && (
                  <span className="badge bg-danger ms-2">{unreadCount}</span>
                )}
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'sent' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('sent');
                  setSelectedMessage(null);
                }}
              >
                <Send size={18} className="me-1" />
                Enviados
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'compose' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('compose');
                  setSelectedMessage(null);
                }}
              >
                <Send size={18} className="me-1" />
                Nuevo Mensaje
              </button>
            </li>
          </ul>
          
          {/* Contenido según la pestaña activa */}
          {activeTab === 'compose' ? (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Redactar Mensaje</h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleSendMessage}>
                  <div className="mb-3">
                    <label htmlFor="receiver_id" className="form-label">Para:</label>
                    <select
                      id="receiver_id"
                      className="form-select"
                      value={newMessage.receiver_id}
                      onChange={(e) => setNewMessage({ ...newMessage, receiver_id: e.target.value })}
                      required
                    >
                      <option value="">Selecciona un destinatario</option>
                      {recipients.map(recipient => (
                        <option key={recipient.id} value={recipient.id}>
                          {recipient.name} ({getRoleText(recipient.role)})
                          {recipient.subject && ` - ${recipient.subject}`}
                          {recipient.grade && ` - Grado ${recipient.grade}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="subject" className="form-label">Asunto:</label>
                    <input
                      type="text"
                      id="subject"
                      className="form-control"
                      value={newMessage.subject}
                      onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="message_type" className="form-label">Tipo:</label>
                    <select
                      id="message_type"
                      className="form-select"
                      value={newMessage.message_type}
                      onChange={(e) => setNewMessage({ ...newMessage, message_type: e.target.value })}
                    >
                      <option value="general">General</option>
                      <option value="academico">Académico</option>
                      <option value="notificacion">Notificación</option>
                      <option value="solicitud">Solicitud</option>
                    </select>
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="message" className="form-label">Mensaje:</label>
                    <textarea
                      id="message"
                      className="form-control"
                      rows="8"
                      value={newMessage.message}
                      onChange={(e) => setNewMessage({ ...newMessage, message: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary">
                      <Send size={18} className="me-1" />
                      Enviar Mensaje
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setNewMessage({
                          receiver_id: '',
                          subject: '',
                          message: '',
                          message_type: 'general'
                        });
                      }}
                    >
                      Limpiar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="row">
              {/* Lista de mensajes */}
              <div className={`col-md-4 ${selectedMessage ? 'd-none d-md-block' : ''}`}>
                <div className="card">
                  <div className="card-header">
                    <div className="input-group">
                      <span className="input-group-text"><Search size={18} /></span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar mensajes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="list-group list-group-flush" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {displayMessages.length === 0 ? (
                      <div className="list-group-item text-center text-muted py-5">
                        No hay mensajes
                      </div>
                    ) : (
                      displayMessages.map((message) => (
                        <button
                          key={message.id}
                          className={`list-group-item list-group-item-action ${
                            selectedMessage?.id === message.id ? 'active' : ''
                          } ${!message.read_status && activeTab === 'inbox' ? 'fw-bold' : ''}`}
                          onClick={() => handleViewMessage(message.id)}
                        >
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <User size={16} />
                                <strong>
                                  {activeTab === 'inbox' ? message.sender_name : message.receiver_name}
                                </strong>
                                <span className={`badge ${getRoleBadgeClass(
                                  activeTab === 'inbox' ? message.sender_role : message.receiver_role
                                )}`}>
                                  {getRoleText(activeTab === 'inbox' ? message.sender_role : message.receiver_role)}
                                </span>
                              </div>
                              <div className="text-truncate" style={{ maxWidth: '200px' }}>
                                {message.subject}
                              </div>
                            </div>
                            {!message.read_status && activeTab === 'inbox' && (
                              <span className="badge bg-danger">Nuevo</span>
                            )}
                          </div>
                          <div className="d-flex align-items-center gap-2 text-muted small">
                            <Clock size={12} />
                            {formatDate(message.created_at)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
              
              {/* Vista de mensaje seleccionado */}
              <div className={`col-md-8 ${selectedMessage ? '' : 'd-none d-md-block'}`}>
                {selectedMessage ? (
                  <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="mb-0">{selectedMessage.subject}</h5>
                        <small className="text-muted">
                          {activeTab === 'inbox' ? 'De' : 'Para'}: {activeTab === 'inbox' ? selectedMessage.sender_name : selectedMessage.receiver_name}
                        </small>
                      </div>
                      <div className="d-flex gap-2">
                        {!selectedMessage.read_status && activeTab === 'inbox' && (
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleMarkAsRead(selectedMessage.id)}
                            title="Marcar como leído"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteMessage(selectedMessage.id)}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="mb-3">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <User size={18} />
                          <strong>
                            {activeTab === 'inbox' ? selectedMessage.sender_name : selectedMessage.receiver_name}
                          </strong>
                          <span className={`badge ${getRoleBadgeClass(
                            activeTab === 'inbox' ? selectedMessage.sender_role : selectedMessage.receiver_role
                          )}`}>
                            {getRoleText(activeTab === 'inbox' ? selectedMessage.sender_role : selectedMessage.receiver_role)}
                          </span>
                        </div>
                        <div className="text-muted small">
                          <Clock size={12} className="me-1" />
                          {formatDate(selectedMessage.created_at)}
                        </div>
                        {selectedMessage.message_type && (
                          <div className="mt-2">
                            <span className="badge bg-secondary">
                              Tipo: {selectedMessage.message_type}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="border-top pt-3">
                        <div style={{ whiteSpace: 'pre-wrap' }}>{selectedMessage.message}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card">
                    <div className="card-body text-center text-muted py-5">
                      <Mail size={48} className="mb-3 opacity-50" />
                      <p>Selecciona un mensaje para ver su contenido</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
