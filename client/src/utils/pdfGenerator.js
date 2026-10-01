import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const cargarImagenComoBase64 = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous"); 
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

export const generateGradePDF = async (data, type = 'individual', teacherInfo = {}) => {
  // Si es grupal, usamos 'l' (landscape/horizontal) para que quepan las fases
  const doc = new jsPDF(type === 'group' ? 'l' : 'p'); 
  const primaryColor = [41, 128, 185];

  // --- 1. PROCESAR LOGO ---
  let logoUrl = teacherInfo.report_logo_url || teacherInfo.profile_image;
  if (logoUrl && !logoUrl.startsWith('http')) {
    logoUrl = `${API_URL}${logoUrl}`;
  }

  if (logoUrl) {
    try {
      const imgBase64 = await cargarImagenComoBase64(logoUrl);
      doc.addImage(imgBase64, 'PNG', 14, 10, 25, 25);
    } catch (e) {
      dibujarLogoTexto(doc, primaryColor);
    }
  } else {
    dibujarLogoTexto(doc, primaryColor);
  }

  // --- 2. ENCABEZADO E INSTITUCIÓN ---
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(40);
  doc.text(teacherInfo.report_brand_name || "SISTEMA EVALUATIVO INTEGRAL", 45, 20);
  
  doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(60);
  doc.text(`Docente: ${teacherInfo.name || 'N/A'}`, 45, 27);
  
  // VERIFICACIÓN DE INSTITUCIÓN: Prioridad datos del alumno > perfil docente > N/A
  const institucion = data[0]?.institution || teacherInfo.institution || "Institución no especificada";
  doc.text(`Institución: ${institucion}`, 45, 33);

  // --- 3. CONTENIDO (TABLA) ---
  let finalY = 0;
  doc.setTextColor(0);

  if (type === 'group') {
    // TABLA GRUPAL (PLANILLA)
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text(`PLANILLA DE CALIFICACIONES: ${data[0]?.course_name || 'General'}`, 14, 48);
    
    autoTable(doc, {
      startY: 55,
      head: [['Estudiante', 'Fase 1', 'Fase 2', 'Fase 3', 'Fase 4', 'Definitiva']],
      body: data.map(item => [
        item.student_name || item.name,
        item.phase1 || '0.0',
        item.phase2 || '0.0',
        item.phase3 || '0.0',
        item.phase4 || '0.0',
        item.final_grade || item.average || '0.0'
      ]),
      headStyles: { fillColor: primaryColor, halign: 'center' },
      styles: { halign: 'center', fontSize: 9 },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      didDrawPage: (d) => { finalY = d.cursor.y; }
    });
  } else {
    // TABLA INDIVIDUAL (REPORTE)
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text(`REPORTE INDIVIDUAL: ${data[0].student_name || data[0].name}`, 14, 48);
    autoTable(doc, {
      startY: 55,
      head: [['Evaluación', 'Fase 1', 'Fase 2', 'Fase 3', 'Fase 4', 'Definitiva']],
      body: data.map(item => [item.exam_title || 'N/A', item.phase1, item.phase2, item.phase3, item.phase4, item.final_grade]),
      headStyles: { fillColor: primaryColor, halign: 'center' },
      styles: { halign: 'center' },
      didDrawPage: (d) => { finalY = d.cursor.y; }
    });
  }

  // --- 4. FIRMA ---
  const firmaY = finalY + 25;
  const pageHeight = doc.internal.pageSize.height;
  if (firmaY > (pageHeight - 30)) doc.addPage();
  const yFinal = (firmaY > (pageHeight - 30)) ? 40 : firmaY;

  doc.setDrawColor(180).line(type === 'group' ? 110 : 70, yFinal, type === 'group' ? 180 : 140, yFinal);
  doc.setFontSize(9).text(teacherInfo.name || 'Firma Docente', type === 'group' ? 145 : 105, yFinal + 5, { align: 'center' });

  doc.save(`Reporte_${institucion.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
};

function dibujarLogoTexto(doc, color) {
  doc.setFont("courier", "bold").setFontSize(26).setTextColor(color[0], color[1], color[2]);
  doc.text("SEIO", 14, 28);
}