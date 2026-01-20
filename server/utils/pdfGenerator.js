/**
 * Generador de PDFs para resultados académicos
 * Genera PDFs con formato estándar para resultados de fase y planes de mejoramiento
 */

import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Genera un PDF con los resultados de fase de un estudiante
 * @param {Object} data - Datos del estudiante, fase, resultados, etc.
 * @returns {Promise<Buffer>} Buffer del PDF generado
 */
export const generatePhaseResultsPDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // ============================================
      // ENCABEZADO CON LOGO
      // ============================================
      const logoPath = path.join(__dirname, '../uploads/logos/logo.png');
      const logoExists = fs.existsSync(logoPath);

      if (logoExists) {
        try {
          doc.image(logoPath, 50, 50, { width: 80, height: 80 });
        } catch (error) {
          console.warn('⚠️ Error al cargar logo, continuando sin logo:', error.message);
        }
      }

      // Título principal
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor('#1a1a1a')
         .text('SEIO - Sistema Evaluativo Integral Online', logoExists ? 150 : 50, 50, {
           width: 400,
           align: 'left'
         });

      doc.fontSize(16)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Resultados de Evaluación Académica', logoExists ? 150 : 50, 80, {
           width: 400,
           align: 'left'
         });

      // Línea separadora
      doc.moveTo(50, 140)
         .lineTo(550, 140)
         .strokeColor('#cccccc')
         .lineWidth(1)
         .stroke();

      let yPosition = 170;

      // ============================================
      // INFORMACIÓN DE LA INSTITUCIÓN
      // ============================================
      if (data.institution) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('#1a1a1a')
           .text('Institución Educativa:', 50, yPosition);
        
        doc.fontSize(11)
           .font('Helvetica')
           .fillColor('#333333')
           .text(data.institution, 200, yPosition, { width: 350 });
        
        yPosition += 25;
      }

      // ============================================
      // PERÍODO ACADÉMICO
      // ============================================
      if (data.academicPeriod) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('#1a1a1a')
           .text('Período Académico:', 50, yPosition);
        
        doc.fontSize(11)
           .font('Helvetica')
           .fillColor('#333333')
           .text(data.academicPeriod, 200, yPosition, { width: 350 });
        
        yPosition += 25;
      }

      // ============================================
      // DATOS DEL DOCENTE
      // ============================================
      if (data.teacherName) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('#1a1a1a')
           .text('Docente:', 50, yPosition);
        
        doc.fontSize(11)
           .font('Helvetica')
           .fillColor('#333333')
           .text(data.teacherName, 200, yPosition, { width: 350 });
        
        yPosition += 20;

        if (data.teacherSubject) {
          doc.fontSize(11)
             .font('Helvetica')
             .fillColor('#666666')
             .text(`Materia: ${data.teacherSubject}`, 200, yPosition, { width: 350 });
          
          yPosition += 25;
        } else {
          yPosition += 15;
        }
      } else {
        yPosition += 10;
      }

      // Línea separadora
      doc.moveTo(50, yPosition)
         .lineTo(550, yPosition)
         .strokeColor('#cccccc')
         .lineWidth(1)
         .stroke();

      yPosition += 20;

      // ============================================
      // DATOS DEL ESTUDIANTE
      // ============================================
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#1a1a1a')
         .text('DATOS DEL ESTUDIANTE', 50, yPosition);

      yPosition += 25;

      const studentInfo = [
        { label: 'Nombre:', value: data.studentName || 'N/A' },
        { label: 'Grado:', value: data.studentGrade || 'N/A' },
        { label: 'Curso:', value: data.courseName || 'N/A' },
        { label: 'Fase Evaluada:', value: `Fase ${data.phase}` }
      ];

      studentInfo.forEach(info => {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#333333')
           .text(info.label, 50, yPosition);
        
        doc.fontSize(11)
           .font('Helvetica')
           .fillColor('#666666')
           .text(info.value, 150, yPosition, { width: 400 });
        
        yPosition += 20;
      });

      yPosition += 10;

      // Línea separadora
      doc.moveTo(50, yPosition)
         .lineTo(550, yPosition)
         .strokeColor('#cccccc')
         .lineWidth(1)
         .stroke();

      yPosition += 20;

      // ============================================
      // RESULTADOS DE LA FASE
      // ============================================
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#1a1a1a')
         .text('RESULTADOS DE LA EVALUACIÓN', 50, yPosition);

      yPosition += 25;

      const phaseScore = parseFloat(data.phaseScore) || 0;
      const passed = phaseScore >= 3.5;
      const statusText = passed ? 'APROBÓ' : 'NO APROBÓ';
      const statusColor = passed ? '#28a745' : '#dc3545';

      // Nota de la fase (destacada)
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor('#1a1a1a')
         .text('Nota de la Fase:', 50, yPosition);

      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor(statusColor)
         .text(phaseScore.toFixed(2), 200, yPosition - 5);

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(statusColor)
         .text(statusText, 280, yPosition + 5);

      yPosition += 40;

      // Nota mínima
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Nota mínima para aprobar: 3.5', 50, yPosition, { width: 500 });

      yPosition += 20;

      // ============================================
      // INDICADORES NO ALCANZADOS
      // ============================================
      if (data.failedIndicators && data.failedIndicators.length > 0) {
        // Verificar si hay espacio suficiente en la página
        if (yPosition > 650) {
          doc.addPage();
          yPosition = 50;
        }

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('#1a1a1a')
           .text('INDICADORES NO ALCANZADOS:', 50, yPosition);

        yPosition += 20;

        data.failedIndicators.forEach((indicator, index) => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }

          const indicatorText = indicator.description || indicator;
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor('#333333')
             .text(`• ${indicatorText}`, 70, yPosition, {
               width: 480,
               continued: false
             });

          yPosition += 18;
        });

        yPosition += 10;
      }

      // ============================================
      // PLAN DE MEJORAMIENTO
      // ============================================
      if (data.improvementPlan) {
        // Verificar si hay espacio suficiente
        if (yPosition > 600) {
          doc.addPage();
          yPosition = 50;
        }

        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#1a1a1a')
           .text('PLAN DE MEJORAMIENTO', 50, yPosition);

        yPosition += 25;

        const plan = data.improvementPlan;

        if (plan.title) {
          doc.fontSize(11)
             .font('Helvetica-Bold')
             .fillColor('#333333')
             .text('Título:', 50, yPosition);
          
          doc.fontSize(11)
             .font('Helvetica')
             .fillColor('#666666')
             .text(plan.title, 120, yPosition, { width: 430 });
          
          yPosition += 20;
        }

        if (plan.subject) {
          doc.fontSize(11)
             .font('Helvetica-Bold')
             .fillColor('#333333')
             .text('Materia:', 50, yPosition);
          
          doc.fontSize(11)
             .font('Helvetica')
             .fillColor('#666666')
             .text(plan.subject, 120, yPosition, { width: 430 });
          
          yPosition += 20;
        }

        if (plan.deadline) {
          doc.fontSize(11)
             .font('Helvetica-Bold')
             .fillColor('#333333')
             .text('Fecha Límite:', 50, yPosition);
          
          doc.fontSize(11)
             .font('Helvetica')
             .fillColor('#dc3545')
             .text(plan.deadline, 120, yPosition, { width: 430 });
          
          yPosition += 20;
        }

        if (plan.description) {
          if (yPosition > 650) {
            doc.addPage();
            yPosition = 50;
          }

          doc.fontSize(11)
             .font('Helvetica-Bold')
             .fillColor('#333333')
             .text('Descripción:', 50, yPosition);
          
          yPosition += 15;

          const descriptionLines = plan.description.split('\n');
          descriptionLines.forEach(line => {
            if (yPosition > 700) {
              doc.addPage();
              yPosition = 50;
            }

            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#666666')
               .text(line.trim() || ' ', 70, yPosition, { width: 480 });
            
            yPosition += 15;
          });

          yPosition += 5;
        }

        if (plan.activities) {
          if (yPosition > 650) {
            doc.addPage();
            yPosition = 50;
          }

          doc.fontSize(11)
             .font('Helvetica-Bold')
             .fillColor('#333333')
             .text('Actividades a Realizar:', 50, yPosition);
          
          yPosition += 15;

          const activityLines = plan.activities.split('\n');
          activityLines.forEach(line => {
            if (yPosition > 700) {
              doc.addPage();
              yPosition = 50;
            }

            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#666666')
               .text(line.trim() || ' ', 70, yPosition, { width: 480 });
            
            yPosition += 15;
          });
        }
      } else {
        // Mensaje si no hay plan
        if (yPosition > 650) {
          doc.addPage();
          yPosition = 50;
        }

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#1a1a1a')
           .text('PLAN DE MEJORAMIENTO', 50, yPosition);

        yPosition += 20;

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#666666')
           .text('El docente realizará la entrega del plan de mejoramiento de forma física o a través de correo electrónico en los próximos días.', 70, yPosition, {
             width: 480,
             align: 'justify'
           });
      }

      // ============================================
      // PIE DE PÁGINA
      // ============================================
      const pageHeight = doc.page.height;
      const footerY = pageHeight - 50;

      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#999999')
         .text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES', { 
           year: 'numeric', 
           month: 'long', 
           day: 'numeric',
           hour: '2-digit',
           minute: '2-digit'
         })}`, 50, footerY, {
           width: 500,
           align: 'center'
         });

      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#999999')
         .text(`© ${new Date().getFullYear()} SEIO - Sistema Evaluativo Integral Online`, 50, footerY + 15, {
           width: 500,
           align: 'center'
         });

      // Finalizar el documento
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Genera un PDF con la nota final del período académico
 * @param {Object} data - Datos del estudiante, notas por fase, etc.
 * @returns {Promise<Buffer>} Buffer del PDF generado
 */
export const generateFinalGradePDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Encabezado (similar al anterior)
      const logoPath = path.join(__dirname, '../uploads/logos/logo.png');
      const logoExists = fs.existsSync(logoPath);

      if (logoExists) {
        try {
          doc.image(logoPath, 50, 50, { width: 80, height: 80 });
        } catch (error) {
          console.warn('⚠️ Error al cargar logo:', error.message);
        }
      }

      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor('#1a1a1a')
         .text('SEIO - Sistema Evaluativo Integral Online', logoExists ? 150 : 50, 50);

      doc.fontSize(16)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Nota Final - Período Académico', logoExists ? 150 : 50, 80);

      let yPosition = 170;

      // Información de institución, período y docente
      if (data.institution) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Institución Educativa:', 50, yPosition);
        doc.fontSize(11)
           .font('Helvetica')
           .text(data.institution, 200, yPosition);
        yPosition += 25;
      }

      if (data.academicPeriod) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Período Académico:', 50, yPosition);
        doc.fontSize(11)
           .font('Helvetica')
           .text(data.academicPeriod, 200, yPosition);
        yPosition += 25;
      }

      if (data.teacherName) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Docente:', 50, yPosition);
        doc.fontSize(11)
           .font('Helvetica')
           .text(data.teacherName, 200, yPosition);
        yPosition += 20;
        if (data.teacherSubject) {
          doc.fontSize(11)
             .font('Helvetica')
             .fillColor('#666666')
             .text(`Materia: ${data.teacherSubject}`, 200, yPosition);
          yPosition += 25;
        }
      }

      yPosition += 10;

      // Datos del estudiante
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#1a1a1a')
         .text('DATOS DEL ESTUDIANTE', 50, yPosition);

      yPosition += 25;

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Nombre:', 50, yPosition);
      doc.fontSize(11)
         .font('Helvetica')
         .text(data.studentName || 'N/A', 150, yPosition);
      yPosition += 20;

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Grado:', 50, yPosition);
      doc.fontSize(11)
         .font('Helvetica')
         .text(data.studentGrade || 'N/A', 150, yPosition);
      yPosition += 20;

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Curso:', 50, yPosition);
      doc.fontSize(11)
         .font('Helvetica')
         .text(data.courseName || 'N/A', 150, yPosition);
      yPosition += 30;

      // Nota final destacada
      const finalGrade = parseFloat(data.finalGrade) || 0;
      const passed = finalGrade >= 3.5;
      const statusColor = passed ? '#28a745' : '#dc3545';

      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#1a1a1a')
         .text('NOTA FINAL:', 50, yPosition);

      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fillColor(statusColor)
         .text(finalGrade.toFixed(2), 200, yPosition - 5);

      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor(statusColor)
         .text(passed ? 'APROBÓ' : 'REPROBÓ', 300, yPosition + 5);

      yPosition += 50;

      // Tabla de notas por fase
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#1a1a1a')
         .text('DESGLOSE POR FASES:', 50, yPosition);

      yPosition += 25;

      const phases = [
        { num: 1, score: data.phaseGrades?.phase1 },
        { num: 2, score: data.phaseGrades?.phase2 },
        { num: 3, score: data.phaseGrades?.phase3 },
        { num: 4, score: data.phaseGrades?.phase4 }
      ];

      phases.forEach(phase => {
        const score = phase.score !== null && phase.score !== undefined ? parseFloat(phase.score) : null;
        const phasePassed = score !== null && score >= 3.5;

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#333333')
           .text(`Fase ${phase.num}:`, 70, yPosition);

        if (score !== null) {
          doc.fontSize(11)
             .font('Helvetica')
             .fillColor(phasePassed ? '#28a745' : '#dc3545')
             .text(score.toFixed(2), 150, yPosition);

          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(phasePassed ? '#28a745' : '#dc3545')
             .text(phasePassed ? '✓ Aprobó' : '✗ No aprobó', 220, yPosition);
        } else {
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor('#999999')
             .text('N/A', 150, yPosition);
        }

        yPosition += 20;
      });

      // Pie de página
      const pageHeight = doc.page.height;
      const footerY = pageHeight - 50;

      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#999999')
         .text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES', { 
           year: 'numeric', 
           month: 'long', 
           day: 'numeric',
           hour: '2-digit',
           minute: '2-digit'
         })}`, 50, footerY, { width: 500, align: 'center' });

      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#999999')
         .text(`© ${new Date().getFullYear()} SEIO - Sistema Evaluativo Integral Online`, 50, footerY + 15, {
           width: 500,
           align: 'center'
         });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};
