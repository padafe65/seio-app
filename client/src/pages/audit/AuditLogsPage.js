// pages/audit/AuditLogsPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { 
  FileText, 
  Download, 
  Filter, 
  Search, 
  Calendar,
  User,
  Database,
  Activity,
  RefreshCw,
  Eye,
  X,
  FileSpreadsheet,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Swal from 'sweetalert2';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable'; // Importación con nombre
import * as XLSX from 'xlsx';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Registrar componentes de Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AuditLogsPage = () => {
  const { user, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [auditTables, setAuditTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  
  // Filtros
  const [filters, setFilters] = useState({
    tableName: '',
    userId: '',
    action: '',
    startDate: '',
    endDate: '',
    limit: 200
  });

  useEffect(() => {
    if (!isAuthReady) return;
    
    if (!user || user.role !== 'super_administrador') {
      navigate('/dashboard');
      return;
    }
    
    fetchAuditTables();
    fetchAuditLogs();
  }, [user, isAuthReady, navigate]);

  const fetchAuditTables = async () => {
    try {
      const response = await axiosClient.get('/audit/tables');
      setAuditTables(response.data?.data || []);
    } catch (error) {
      console.error('Error al cargar tablas auditadas:', error);
      setAuditTables([]);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      
      // Construir query string con filtros
      const params = new URLSearchParams();
      if (filters.tableName) params.append('tableName', filters.tableName);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('limit', filters.limit);
      
      const response = await axiosClient.get(`/audit/logs?${params.toString()}`);
      setLogs(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar logs de auditoría:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los logs de auditoría',
        confirmButtonText: 'OK'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      tableName: '',
      userId: '',
      action: '',
      startDate: '',
      endDate: '',
      limit: 50
    });
  };

  const applyFilters = () => {
    fetchAuditLogs();
  };

  const viewDetails = (log) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedLog(null);
  };

  // Búsqueda en tiempo real
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    
    const term = searchTerm.toLowerCase();
    return logs.filter(log => 
      log.user_name?.toLowerCase().includes(term) ||
      log.table_name?.toLowerCase().includes(term) ||
      log.action?.toLowerCase().includes(term) ||
      log.description?.toLowerCase().includes(term) ||
      log.user_role?.toLowerCase().includes(term)
    );
  }, [logs, searchTerm]);

  // Paginación
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  // Estadísticas
  const stats = useMemo(() => {
    const actionCounts = {};
    const tableCounts = {};
    const userCounts = {};
    
    logs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      tableCounts[log.table_name] = (tableCounts[log.table_name] || 0) + 1;
      userCounts[log.user_name] = (userCounts[log.user_name] || 0) + 1;
    });

    return { actionCounts, tableCounts, userCounts };
  }, [logs]);

  const showPDFPreview = () => {
    setShowPreview(true);
  };

  const generatePDFReport = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text('Reporte de Auditoría del Sistema', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text('Sistema Evaluativo Integral Online (SEIO)', pageWidth / 2, 28, { align: 'center' });
      
      // Información del usuario
      doc.setFontSize(10);
      doc.text(`Generado por: ${user?.name || 'N/A'}`, 14, 40);
      doc.text(`Rol: ${user?.role || 'N/A'}`, 14, 46);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 14, 52);
      doc.text(`Hora: ${new Date().toLocaleTimeString('es-ES')}`, 14, 58);
      
      // Filtros aplicados
      let yPos = 68;
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text('Filtros Aplicados:', 14, yPos);
      yPos += 6;
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      if (filters.tableName) doc.text(`• Tabla: ${filters.tableName}`, 14, yPos += 5);
      if (filters.action) doc.text(`• Acción: ${filters.action}`, 14, yPos += 5);
      if (filters.startDate) doc.text(`• Desde: ${filters.startDate}`, 14, yPos += 5);
      if (filters.endDate) doc.text(`• Hasta: ${filters.endDate}`, 14, yPos += 5);
      doc.text(`• Total de registros: ${filteredLogs.length}`, 14, yPos += 5);
      
      // Tabla de datos
      const tableData = filteredLogs.slice(0, 100).map(log => [
        formatDate(log.created_at),
        log.user_name,
        log.user_role,
        log.action,
        log.table_name,
        log.description.substring(0, 50) + (log.description.length > 50 ? '...' : '')
      ]);
      
      autoTable(doc, {
        startY: yPos + 10,
        head: [['Fecha', 'Usuario', 'Rol', 'Acción', 'Tabla', 'Descripción']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 10 }
      });
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Página ${i} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }
      
      // Guardar PDF
      const fileName = `auditoria_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      Swal.fire({
        icon: 'success',
        title: 'Reporte generado',
        text: `El archivo ${fileName} se ha descargado correctamente`,
        confirmButtonText: 'OK'
      });
      
      setShowPreview(false);
    } catch (error) {
      console.error('Error al generar reporte:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el reporte PDF',
        confirmButtonText: 'OK'
      });
    }
  };

  const exportToExcel = () => {
    try {
      const excelData = filteredLogs.map(log => ({
        'Fecha y Hora': formatDate(log.created_at),
        'Usuario': log.user_name,
        'Rol': log.user_role,
        'Acción': log.action,
        'Tabla': log.table_name,
        'Descripción': log.description,
        'IP': log.ip_address || 'N/A',
        'ID Registro': log.record_id
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');
      
      // Ajustar ancho de columnas
      const colWidths = [
        { wch: 20 }, // Fecha
        { wch: 25 }, // Usuario
        { wch: 20 }, // Rol
        { wch: 15 }, // Acción
        { wch: 15 }, // Tabla
        { wch: 50 }, // Descripción
        { wch: 15 }, // IP
        { wch: 10 }  // ID
      ];
      ws['!cols'] = colWidths;
      
      const fileName = `auditoria_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      Swal.fire({
        icon: 'success',
        title: 'Exportado a Excel',
        text: `El archivo ${fileName} se ha descargado correctamente`,
        confirmButtonText: 'OK'
      });
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo exportar a Excel',
        confirmButtonText: 'OK'
      });
    }
  };

  const getActionBadge = (action) => {
    const badges = {
      'CREATE': 'bg-success',
      'UPDATE': 'bg-warning',
      'DELETE': 'bg-danger',
      'LOGIN_SUCCESS': 'bg-info',
      'LOGIN_FAILED': 'bg-secondary',
      'LOGOUT': 'bg-secondary'
    };
    return badges[action] || 'bg-secondary';
  };

  const getRoleBadge = (role) => {
    const badges = {
      'super_administrador': 'bg-danger',
      'administrador': 'bg-warning',
      'docente': 'bg-info',
      'estudiante': 'bg-success'
    };
    return badges[role] || 'bg-secondary';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const parseJSON = (jsonString) => {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="mb-1">
            <Activity size={32} className="me-2" />
            Auditoría del Sistema
          </h2>
          <p className="text-muted mb-0">
            Registro completo de todas las acciones realizadas en el sistema
          </p>
        </div>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-success"
            onClick={exportToExcel}
            title="Exportar a Excel"
          >
            <FileSpreadsheet size={20} className="me-2" />
            Excel
          </button>
          <button 
            className="btn btn-outline-info"
            onClick={() => setShowStats(!showStats)}
            title="Ver estadísticas"
          >
            <BarChart3 size={20} className="me-2" />
            Estadísticas
          </button>
          <button 
            className="btn btn-primary"
            onClick={showPDFPreview}
            title="Vista previa y generar PDF"
          >
            <Download size={20} className="me-2" />
            Reporte PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <Filter size={20} className="me-2" />
            Filtros
          </h5>
          <button 
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {showFilters && (
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label small">
                  <Database size={16} className="me-1" />
                  Tabla
                </label>
                <select 
                  className="form-select"
                  value={filters.tableName}
                  onChange={(e) => handleFilterChange('tableName', e.target.value)}
                >
                  <option value="">Todas las tablas</option>
                  {auditTables.map(tableName => (
                    <option key={tableName} value={tableName}>
                      {{ users: 'Usuarios', students: 'Estudiantes', courses: 'Cursos', questionnaires: 'Cuestionarios', teachers: 'Docentes' }[tableName] || tableName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label small">
                  <Activity size={16} className="me-1" />
                  Acción
                </label>
                <select 
                  className="form-select"
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                >
                  <option value="">Todas las acciones</option>
                  <option value="CREATE">Crear</option>
                  <option value="UPDATE">Actualizar</option>
                  <option value="DELETE">Eliminar</option>
                  <option value="LOGIN_SUCCESS">Inicio de sesión</option>
                  <option value="LOGOUT">Cierre de sesión</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label small">
                  <Calendar size={16} className="me-1" />
                  Fecha Inicio
                </label>
                <input 
                  type="date"
                  className="form-control"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label small">
                  <Calendar size={16} className="me-1" />
                  Fecha Fin
                </label>
                <input 
                  type="date"
                  className="form-control"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label small">Límite de resultados</label>
                <select 
                  className="form-select"
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', e.target.value)}
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                  <option value="1000">1000</option>
                </select>
              </div>

              <div className="col-md-9 d-flex align-items-end gap-2">
                <button 
                  className="btn btn-primary"
                  onClick={applyFilters}
                >
                  <Search size={18} className="me-2" />
                  Aplicar Filtros
                </button>
                <button 
                  className="btn btn-outline-secondary"
                  onClick={clearFilters}
                >
                  <X size={18} className="me-2" />
                  Limpiar
                </button>
                <button 
                  className="btn btn-outline-primary"
                  onClick={fetchAuditLogs}
                >
                  <RefreshCw size={18} className="me-2" />
                  Actualizar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Búsqueda en Tiempo Real */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="input-group">
            <span className="input-group-text">
              <Search size={18} />
            </span>
            <input 
              type="text"
              className="form-control"
              placeholder="Buscar en los resultados (usuario, tabla, acción, descripción)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset a primera página al buscar
              }}
            />
            {searchTerm && (
              <button 
                className="btn btn-outline-secondary"
                onClick={() => setSearchTerm('')}
              >
                <X size={18} />
              </button>
            )}
          </div>
          {searchTerm && (
            <small className="text-muted mt-2 d-block">
              Mostrando {filteredLogs.length} de {logs.length} registros
            </small>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      {showStats && (
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h6 className="mb-0">Acciones por Tipo</h6>
              </div>
              <div className="card-body">
                <Bar 
                  data={{
                    labels: Object.keys(stats.actionCounts),
                    datasets: [{
                      label: 'Cantidad',
                      data: Object.values(stats.actionCounts),
                      backgroundColor: [
                        'rgba(40, 167, 69, 0.7)',
                        'rgba(255, 193, 7, 0.7)',
                        'rgba(220, 53, 69, 0.7)',
                        'rgba(23, 162, 184, 0.7)',
                        'rgba(108, 117, 125, 0.7)'
                      ],
                      borderColor: [
                        'rgb(40, 167, 69)',
                        'rgb(255, 193, 7)',
                        'rgb(220, 53, 69)',
                        'rgb(23, 162, 184)',
                        'rgb(108, 117, 125)'
                      ],
                      borderWidth: 1
                    }]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                      title: { display: false }
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h6 className="mb-0">Actividad por Tabla</h6>
              </div>
              <div className="card-body">
                <Pie 
                  data={{
                    labels: Object.keys(stats.tableCounts),
                    datasets: [{
                      data: Object.values(stats.tableCounts),
                      backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)'
                      ],
                      borderColor: [
                        'rgb(255, 99, 132)',
                        'rgb(54, 162, 235)',
                        'rgb(255, 206, 86)',
                        'rgb(75, 192, 192)',
                        'rgb(153, 102, 255)'
                      ],
                      borderWidth: 1
                    }]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'right' }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <FileText size={20} className="me-2" />
            Registros de Auditoría ({filteredLogs.length})
          </h5>
          {totalPages > 1 && (
            <small className="text-muted">
              Página {currentPage} de {totalPages}
            </small>
          )}
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Acción</th>
                  <th>Tabla</th>
                  <th>Descripción</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      {searchTerm ? 'No se encontraron resultados para tu búsqueda' : 'No se encontraron registros de auditoría'}
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="small">{formatDate(log.created_at)}</td>
                      <td>
                        <User size={16} className="me-1" />
                        {log.user_name}
                      </td>
                      <td>
                        <span className={`badge ${getRoleBadge(log.user_role)} text-white`}>
                          {log.user_role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getActionBadge(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <code className="small">{log.table_name}</code>
                      </td>
                      <td className="small">{log.description}</td>
                      <td>
                        <button 
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => viewDetails(log)}
                          title="Ver detalles"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Paginación */}
        {totalPages > 1 && (
          <div className="card-footer">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <small className="text-muted">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredLogs.length)} de {filteredLogs.length} registros
                </small>
              </div>
              <nav>
                <ul className="pagination mb-0">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button 
                      className="page-link"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </li>
                  
                  {[...Array(totalPages)].map((_, index) => {
                    const pageNum = index + 1;
                    // Mostrar solo páginas cercanas a la actual
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                    ) {
                      return (
                        <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                          <button 
                            className="page-link"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        </li>
                      );
                    } else if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
                      return <li key={pageNum} className="page-item disabled"><span className="page-link">...</span></li>;
                    }
                    return null;
                  })}
                  
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button 
                      className="page-link"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Vista Previa de PDF */}
      {showPreview && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Vista Previa del Reporte PDF</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowPreview(false)}
                ></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Header del Reporte */}
                <div className="text-center mb-4 pb-3 border-bottom">
                  <h3 className="mb-2">Reporte de Auditoría del Sistema</h3>
                  <h5 className="text-muted mb-3">Sistema Evaluativo Integral Online (SEIO)</h5>
                  <div className="row text-start">
                    <div className="col-md-6">
                      <p className="mb-1"><strong>Generado por:</strong> {user?.name || 'N/A'}</p>
                      <p className="mb-1"><strong>Rol:</strong> {user?.role || 'N/A'}</p>
                    </div>
                    <div className="col-md-6">
                      <p className="mb-1"><strong>Fecha:</strong> {new Date().toLocaleDateString('es-ES')}</p>
                      <p className="mb-1"><strong>Hora:</strong> {new Date().toLocaleTimeString('es-ES')}</p>
                    </div>
                  </div>
                </div>

                {/* Filtros Aplicados */}
                <div className="mb-4">
                  <h6 className="mb-3">Filtros Aplicados:</h6>
                  <ul className="list-unstyled">
                    {filters.tableName && <li>• <strong>Tabla:</strong> {filters.tableName}</li>}
                    {filters.action && <li>• <strong>Acción:</strong> {filters.action}</li>}
                    {filters.startDate && <li>• <strong>Desde:</strong> {filters.startDate}</li>}
                    {filters.endDate && <li>• <strong>Hasta:</strong> {filters.endDate}</li>}
                    <li>• <strong>Total de registros:</strong> {filteredLogs.length}</li>
                  </ul>
                </div>

                {/* Resumen Estadístico */}
                <div className="mb-4">
                  <h6 className="mb-3">Resumen:</h6>
                  <div className="row">
                    <div className="col-md-4">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="text-success">Creaciones</h6>
                          <h3>{stats.actionCounts['CREATE'] || 0}</h3>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="text-warning">Actualizaciones</h6>
                          <h3>{stats.actionCounts['UPDATE'] || 0}</h3>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="text-danger">Eliminaciones</h6>
                          <h3>{stats.actionCounts['DELETE'] || 0}</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vista Previa de la Tabla */}
                <div className="mb-3">
                  <h6 className="mb-3">Registros a Incluir (Primeros 10):</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th>Fecha</th>
                          <th>Usuario</th>
                          <th>Rol</th>
                          <th>Acción</th>
                          <th>Tabla</th>
                          <th>Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs.slice(0, 10).map((log) => (
                          <tr key={log.id}>
                            <td className="small">{formatDate(log.created_at)}</td>
                            <td className="small">{log.user_name}</td>
                            <td className="small">{log.user_role}</td>
                            <td className="small">{log.action}</td>
                            <td className="small">{log.table_name}</td>
                            <td className="small">{log.description.substring(0, 40)}...</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredLogs.length > 10 && (
                    <p className="text-muted small">
                      ... y {filteredLogs.length - 10} registros más (se incluirán hasta 100 en el PDF)
                    </p>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowPreview(false)}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={generatePDFReport}
                >
                  <Download size={18} className="me-2" />
                  Descargar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalles */}
      {showDetails && selectedLog && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Detalles del Registro de Auditoría</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={closeDetails}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Fecha y Hora:</strong>
                    <p>{formatDate(selectedLog.created_at)}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>Usuario:</strong>
                    <p>{selectedLog.user_name} ({selectedLog.user_role})</p>
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Acción:</strong>
                    <p>
                      <span className={`badge ${getActionBadge(selectedLog.action)}`}>
                        {selectedLog.action}
                      </span>
                    </p>
                  </div>
                  <div className="col-md-6">
                    <strong>Tabla:</strong>
                    <p><code>{selectedLog.table_name}</code></p>
                  </div>
                </div>

                <div className="mb-3">
                  <strong>Descripción:</strong>
                  <p>{selectedLog.description}</p>
                </div>

                {selectedLog.ip_address && (
                  <div className="mb-3">
                    <strong>Dirección IP:</strong>
                    <p><code>{selectedLog.ip_address}</code></p>
                  </div>
                )}

                {selectedLog.old_values && (
                  <div className="mb-3">
                    <strong>Valores Anteriores:</strong>
                    <pre className="bg-light p-3 rounded">
                      {JSON.stringify(parseJSON(selectedLog.old_values), null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_values && (
                  <div className="mb-3">
                    <strong>Valores Nuevos:</strong>
                    <pre className="bg-light p-3 rounded">
                      {JSON.stringify(parseJSON(selectedLog.new_values), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={closeDetails}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
