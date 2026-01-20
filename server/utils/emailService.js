/**
 * Servicio de envío de correos electrónicos
 * Configuración para nodemailer
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Crear transporter de nodemailer
 * Soporta Gmail, Outlook y otros servicios SMTP
 */
const createTransporter = () => {
  // Si hay configuración SMTP personalizada, usarla
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false // Para desarrollo, en producción debería ser true
      }
    });
  }

  // Si no hay configuración, usar Gmail con OAuth2 o App Password
  // Para Gmail, necesitas una "App Password" (no tu contraseña normal)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD // App Password de Gmail
      }
    });
  }

  // Si no hay configuración, retornar null (no se enviarán correos)
  console.warn('⚠️ No hay configuración de correo. Los correos no se enviarán.');
  return null;
};

/**
 * Enviar correo de recuperación de contraseña
 * @param {string} toEmail - Correo del destinatario
 * @param {string} userName - Nombre del usuario
 * @param {string} resetUrl - URL para restablecer contraseña
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendPasswordResetEmail = async (toEmail, userName, resetUrl) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.warn('⚠️ No se puede enviar correo: no hay configuración SMTP');
      // En desarrollo, mostrar el link en consola
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [DEV] Correo de recuperación para ${toEmail}:`);
        console.log(`🔗 Link: ${resetUrl}`);
      }
      return { success: false, message: 'Servicio de correo no configurado' };
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@seio.com',
      to: toEmail,
      subject: 'Recuperación de Contraseña - SEIO',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              border: 1px solid #ddd;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #007bff;
              margin: 0;
            }
            .content {
              background-color: white;
              padding: 20px;
              border-radius: 5px;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #007bff;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              text-align: center;
            }
            .button:hover {
              background-color: #0056b3;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 20px;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 10px;
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Recuperación de Contraseña</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${userName}</strong>,</p>
              <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en SEIO.</p>
              <p>Haz clic en el siguiente botón para restablecer tu contraseña:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
              </div>
              <p>O copia y pega este enlace en tu navegador:</p>
              <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
              <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul>
                  <li>Este enlace expirará en <strong>1 hora</strong></li>
                  <li>Si no solicitaste este cambio, ignora este correo</li>
                  <li>Tu contraseña no cambiará hasta que completes el proceso</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>Este es un correo automático, por favor no respondas.</p>
              <p>© ${new Date().getFullYear()} SEIO - Sistema Evaluativo Integral Online</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Recuperación de Contraseña - SEIO
        
        Hola ${userName},
        
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
        
        Haz clic en el siguiente enlace para restablecer tu contraseña:
        ${resetUrl}
        
        Este enlace expirará en 1 hora.
        
        Si no solicitaste este cambio, ignora este correo.
        
        © ${new Date().getFullYear()} SEIO
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Correo de recuperación enviado a ${toEmail}:`, info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error al enviar correo de recuperación:', error);
    
    // En desarrollo, mostrar el link en consola si falla el envío
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 [DEV] Falló el envío, pero aquí está el link para ${toEmail}:`);
      console.log(`🔗 Link: ${resetUrl}`);
    }
    
    return { success: false, error: error.message };
  }
};

/**
 * Enviar correo con resultados de fase y planes de mejoramiento
 * @param {Object} studentData - Datos del estudiante (id, name, email, contact_email, grade, course_name)
 * @param {number} phase - Número de fase (1-4)
 * @param {number} phaseScore - Nota de la fase
 * @param {Object|null} improvementPlan - Plan de mejoramiento si existe, null si no hay
 * @param {Array} failedIndicators - Lista de indicadores no alcanzados
 * @param {Buffer|null} pdfBuffer - Buffer del PDF adjunto (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendPhaseResultsEmail = async (studentData, phase, phaseScore, improvementPlan, failedIndicators = [], pdfBuffer = null) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.warn('⚠️ No se puede enviar correo: no hay configuración SMTP');
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [DEV] Correo de resultados de fase ${phase} para ${studentData.name}`);
        console.log(`   Email estudiante: ${studentData.email}`);
        console.log(`   Email acudiente: ${studentData.contact_email}`);
        console.log(`   Nota fase: ${phaseScore}`);
        console.log(`   Plan de mejoramiento: ${improvementPlan ? 'Sí' : 'No'}`);
      }
      return { success: false, message: 'Servicio de correo no configurado' };
    }

    const passed = phaseScore >= 3.5;
    const statusText = passed ? 'APROBÓ' : 'NO APROBÓ';
    const statusColor = passed ? '#28a745' : '#dc3545';
    const statusIcon = passed ? '✅' : '❌';

    // Construir lista de indicadores fallidos
    let indicatorsHtml = '';
    if (failedIndicators.length > 0) {
      indicatorsHtml = `
        <div class="section">
          <h3>📋 Indicadores No Alcanzados:</h3>
          <ul>
            ${failedIndicators.map(ind => `<li>${ind.description || ind}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Construir sección de plan de mejoramiento
    let planHtml = '';
    if (improvementPlan) {
      planHtml = `
        <div class="section plan-section">
          <h3>📚 Plan de Mejoramiento Disponible</h3>
          <div class="plan-details">
            <p><strong>Título:</strong> ${improvementPlan.title || 'Plan de Recuperación'}</p>
            <p><strong>Materia:</strong> ${improvementPlan.subject || 'N/A'}</p>
            <p><strong>Fecha límite:</strong> ${improvementPlan.deadline || 'Por definir'}</p>
            ${improvementPlan.description ? `<p><strong>Descripción:</strong></p><p>${improvementPlan.description.replace(/\n/g, '<br>')}</p>` : ''}
            ${improvementPlan.activities ? `<p><strong>Actividades:</strong></p><p>${improvementPlan.activities.replace(/\n/g, '<br>')}</p>` : ''}
          </div>
        </div>
      `;
    } else {
      planHtml = `
        <div class="section info-section">
          <h3>ℹ️ Información Importante</h3>
          <p>El docente realizará la entrega del plan de mejoramiento de forma física o a través de correo electrónico en los próximos días.</p>
          <p>Por favor, estar atento a las comunicaciones del docente.</p>
        </div>
      `;
    }

    // Preparar adjuntos
    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `Resultados_Fase_${phase}_${studentData.name.replace(/\s+/g, '_')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@seio.com',
      to: [studentData.email, studentData.contact_email].filter(Boolean).join(', '), // Enviar a estudiante y acudiente
      subject: `Resultados Fase ${phase} - ${studentData.name} - ${statusText}`,
      attachments: attachments.length > 0 ? attachments : undefined,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              border: 1px solid #ddd;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #007bff;
              margin: 0;
            }
            .status-badge {
              display: inline-block;
              padding: 10px 20px;
              border-radius: 5px;
              font-weight: bold;
              font-size: 18px;
              margin: 20px 0;
              background-color: ${statusColor};
              color: white;
            }
            .content {
              background-color: white;
              padding: 20px;
              border-radius: 5px;
              margin-bottom: 20px;
            }
            .section {
              margin: 20px 0;
              padding: 15px;
              background-color: #f8f9fa;
              border-radius: 5px;
              border-left: 4px solid #007bff;
            }
            .section h3 {
              margin-top: 0;
              color: #007bff;
            }
            .plan-section {
              border-left-color: #28a745;
              background-color: #d4edda;
            }
            .info-section {
              border-left-color: #ffc107;
              background-color: #fff3cd;
            }
            .score-display {
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              color: ${statusColor};
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 20px;
            }
            ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            .plan-details {
              background-color: white;
              padding: 15px;
              border-radius: 5px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Resultados Fase ${phase}</h1>
            </div>
            <div class="content">
              <p>Estimado(a) <strong>${studentData.name}</strong> y acudiente,</p>
              <p>Le informamos los resultados académicos de la <strong>Fase ${phase}</strong> del período académico:</p>
              
              <div class="score-display">
                ${statusIcon} Nota Fase ${phase}: <span style="color: ${statusColor};">${phaseScore.toFixed(2)}</span>
              </div>
              
              <div class="status-badge">
                ${statusText}
              </div>

              ${indicatorsHtml}

              ${planHtml}
            </div>
            <div class="footer">
              <p>Este es un correo automático del sistema SEIO.</p>
              <p>© ${new Date().getFullYear()} SEIO - Sistema Evaluativo Integral Online</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Resultados Fase ${phase} - SEIO
        
        Estimado(a) ${studentData.name} y acudiente,
        
        Le informamos los resultados académicos de la Fase ${phase}:
        
        Nota Fase ${phase}: ${phaseScore.toFixed(2)}
        Estado: ${statusText}
        
        ${failedIndicators.length > 0 ? `\nIndicadores No Alcanzados:\n${failedIndicators.map(ind => `- ${ind.description || ind}`).join('\n')}` : ''}
        
        ${improvementPlan ? `\nPlan de Mejoramiento:\n${improvementPlan.title || 'Plan de Recuperación'}\nMateria: ${improvementPlan.subject || 'N/A'}\nFecha límite: ${improvementPlan.deadline || 'Por definir'}` : '\nEl docente realizará la entrega del plan de mejoramiento de forma física o a través de correo electrónico en los próximos días.'}
        
        © ${new Date().getFullYear()} SEIO
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Correo de resultados fase ${phase} enviado a ${studentData.email} y ${studentData.contact_email}:`, info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error al enviar correo de resultados de fase:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Enviar correo con nota final (al completar fase 4)
 * @param {Object} studentData - Datos del estudiante (id, name, email, contact_email, grade, course_name)
 * @param {number} finalGrade - Nota final (promedio de las 4 fases)
 * @param {Object} phaseGrades - Objeto con las notas por fase {phase1, phase2, phase3, phase4}
 * @param {Buffer|null} pdfBuffer - Buffer del PDF adjunto (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendFinalGradeEmail = async (studentData, finalGrade, phaseGrades = {}, pdfBuffer = null) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.warn('⚠️ No se puede enviar correo: no hay configuración SMTP');
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [DEV] Correo de nota final para ${studentData.name}`);
        console.log(`   Email estudiante: ${studentData.email}`);
        console.log(`   Email acudiente: ${studentData.contact_email}`);
        console.log(`   Nota final: ${finalGrade}`);
      }
      return { success: false, message: 'Servicio de correo no configurado' };
    }

    const passed = finalGrade >= 3.5;
    const statusText = passed ? 'APROBÓ' : 'REPROBÓ';
    const statusColor = passed ? '#28a745' : '#dc3545';
    const statusIcon = passed ? '✅' : '❌';
    const minScore = 3.5;

    // Construir tabla de notas por fase
    const phasesTable = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #007bff; color: white;">
          <th style="padding: 10px; border: 1px solid #ddd;">Fase</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Nota</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Estado</th>
        </tr>
        ${[1, 2, 3, 4].map(phaseNum => {
          const phaseKey = `phase${phaseNum}`;
          const phaseScore = phaseGrades[phaseKey] || null;
          const phasePassed = phaseScore !== null && phaseScore >= 3.5;
          return `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">Fase ${phaseNum}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${phaseScore !== null ? phaseScore.toFixed(2) : 'N/A'}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: ${phasePassed ? '#28a745' : '#dc3545'};">
                ${phaseScore !== null ? (phasePassed ? '✅ Aprobó' : '❌ No aprobó') : 'Sin calificar'}
              </td>
            </tr>
          `;
        }).join('')}
      </table>
    `;

    // Preparar adjuntos
    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `Nota_Final_${studentData.name.replace(/\s+/g, '_')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@seio.com',
      to: [studentData.email, studentData.contact_email].filter(Boolean).join(', '),
      subject: `Nota Final - ${studentData.name} - ${statusText}`,
      attachments: attachments.length > 0 ? attachments : undefined,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              border: 1px solid #ddd;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #007bff;
              margin: 0;
            }
            .status-badge {
              display: inline-block;
              padding: 15px 30px;
              border-radius: 5px;
              font-weight: bold;
              font-size: 20px;
              margin: 20px 0;
              background-color: ${statusColor};
              color: white;
            }
            .content {
              background-color: white;
              padding: 20px;
              border-radius: 5px;
              margin-bottom: 20px;
            }
            .score-display {
              text-align: center;
              font-size: 32px;
              font-weight: bold;
              color: ${statusColor};
              margin: 30px 0;
              padding: 20px;
              background-color: #f8f9fa;
              border-radius: 10px;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              padding: 10px;
              border: 1px solid #ddd;
              text-align: center;
            }
            th {
              background-color: #007bff;
              color: white;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎓 Nota Final - Período Académico</h1>
            </div>
            <div class="content">
              <p>Estimado(a) <strong>${studentData.name}</strong> y acudiente,</p>
              <p>Le informamos la <strong>nota final</strong> del período académico:</p>
              
              <div class="score-display">
                ${statusIcon} Nota Final: <span style="color: ${statusColor};">${finalGrade.toFixed(2)}</span>
                <div style="font-size: 14px; margin-top: 10px; color: #666;">
                  Nota mínima para aprobar: ${minScore}
                </div>
              </div>
              
              <div class="status-badge">
                ${statusText}
              </div>

              <h3 style="color: #007bff; margin-top: 30px;">Desglose por Fases:</h3>
              ${phasesTable}

              ${!passed ? `
                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
                  <p><strong>⚠️ Importante:</strong></p>
                  <p>El estudiante no alcanzó la nota mínima requerida (${minScore}) para aprobar el período académico.</p>
                  <p>El docente se comunicará para informar sobre el proceso de recuperación o habilitación.</p>
                </div>
              ` : `
                <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 5px;">
                  <p><strong>✅ Felicitaciones:</strong></p>
                  <p>El estudiante ha aprobado exitosamente el período académico.</p>
                </div>
              `}
            </div>
            <div class="footer">
              <p>Este es un correo automático del sistema SEIO.</p>
              <p>© ${new Date().getFullYear()} SEIO - Sistema Evaluativo Integral Online</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Nota Final - SEIO
        
        Estimado(a) ${studentData.name} y acudiente,
        
        Le informamos la nota final del período académico:
        
        Nota Final: ${finalGrade.toFixed(2)}
        Estado: ${statusText}
        Nota mínima para aprobar: ${minScore}
        
        Desglose por Fases:
        Fase 1: ${phaseGrades.phase1 !== null && phaseGrades.phase1 !== undefined ? phaseGrades.phase1.toFixed(2) : 'N/A'}
        Fase 2: ${phaseGrades.phase2 !== null && phaseGrades.phase2 !== undefined ? phaseGrades.phase2.toFixed(2) : 'N/A'}
        Fase 3: ${phaseGrades.phase3 !== null && phaseGrades.phase3 !== undefined ? phaseGrades.phase3.toFixed(2) : 'N/A'}
        Fase 4: ${phaseGrades.phase4 !== null && phaseGrades.phase4 !== undefined ? phaseGrades.phase4.toFixed(2) : 'N/A'}
        
        ${!passed ? '\n⚠️ El estudiante no alcanzó la nota mínima requerida. El docente se comunicará para informar sobre el proceso de recuperación.' : '\n✅ El estudiante ha aprobado exitosamente el período académico.'}
        
        © ${new Date().getFullYear()} SEIO
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Correo de nota final enviado a ${studentData.email} y ${studentData.contact_email}:`, info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error al enviar correo de nota final:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Enviar correo con plan de mejoramiento específico
 * @param {Object} studentData - Datos del estudiante (id, name, email, contact_email)
 * @param {Object} improvementPlan - Plan de mejoramiento completo
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendImprovementPlanEmail = async (studentData, improvementPlan) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.warn('⚠️ No se puede enviar correo: no hay configuración SMTP');
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [DEV] Correo de plan de mejoramiento para ${studentData.name}`);
        console.log(`   Plan: ${improvementPlan.title}`);
      }
      return { success: false, message: 'Servicio de correo no configurado' };
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@seio.com',
      to: [studentData.email, studentData.contact_email].filter(Boolean).join(', '),
      subject: `Plan de Mejoramiento - ${improvementPlan.title || 'Recuperación Académica'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              border: 1px solid #ddd;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #007bff;
              margin: 0;
            }
            .content {
              background-color: white;
              padding: 20px;
              border-radius: 5px;
              margin-bottom: 20px;
            }
            .section {
              margin: 20px 0;
              padding: 15px;
              background-color: #f8f9fa;
              border-radius: 5px;
              border-left: 4px solid #007bff;
            }
            .section h3 {
              margin-top: 0;
              color: #007bff;
            }
            .deadline {
              background-color: #fff3cd;
              border-left-color: #ffc107;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 20px;
            }
            ul {
              margin: 10px 0;
              padding-left: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 Plan de Mejoramiento Académico</h1>
            </div>
            <div class="content">
              <p>Estimado(a) <strong>${studentData.name}</strong> y acudiente,</p>
              <p>Se ha generado un plan de mejoramiento académico para el estudiante:</p>
              
              <div class="section">
                <h3>📋 Información del Plan</h3>
                <p><strong>Título:</strong> ${improvementPlan.title || 'Plan de Recuperación'}</p>
                <p><strong>Materia:</strong> ${improvementPlan.subject || 'N/A'}</p>
                ${improvementPlan.deadline ? `<p class="deadline"><strong>📅 Fecha límite:</strong> ${improvementPlan.deadline}</p>` : ''}
              </div>

              ${improvementPlan.description ? `
                <div class="section">
                  <h3>📝 Descripción</h3>
                  <p>${improvementPlan.description.replace(/\n/g, '<br>')}</p>
                </div>
              ` : ''}

              ${improvementPlan.activities ? `
                <div class="section">
                  <h3>✅ Actividades a Realizar</h3>
                  <p>${improvementPlan.activities.replace(/\n/g, '<br>')}</p>
                </div>
              ` : ''}

              ${improvementPlan.failed_achievements ? `
                <div class="section">
                  <h3>❌ Logros No Alcanzados</h3>
                  <p>${improvementPlan.failed_achievements.replace(/\n/g, '<br>')}</p>
                </div>
              ` : ''}

              ${improvementPlan.passed_achievements ? `
                <div class="section">
                  <h3>✅ Logros Alcanzados</h3>
                  <p>${improvementPlan.passed_achievements.replace(/\n/g, '<br>')}</p>
                </div>
              ` : ''}
            </div>
            <div class="footer">
              <p>Este es un correo automático del sistema SEIO.</p>
              <p>© ${new Date().getFullYear()} SEIO - Sistema Evaluativo Integral Online</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Plan de Mejoramiento Académico - SEIO
        
        Estimado(a) ${studentData.name} y acudiente,
        
        Se ha generado un plan de mejoramiento académico:
        
        Título: ${improvementPlan.title || 'Plan de Recuperación'}
        Materia: ${improvementPlan.subject || 'N/A'}
        ${improvementPlan.deadline ? `Fecha límite: ${improvementPlan.deadline}` : ''}
        
        ${improvementPlan.description ? `\nDescripción:\n${improvementPlan.description}` : ''}
        
        ${improvementPlan.activities ? `\nActividades:\n${improvementPlan.activities}` : ''}
        
        ${improvementPlan.failed_achievements ? `\nLogros No Alcanzados:\n${improvementPlan.failed_achievements}` : ''}
        
        © ${new Date().getFullYear()} SEIO
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Correo de plan de mejoramiento enviado a ${studentData.email} y ${studentData.contact_email}:`, info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error al enviar correo de plan de mejoramiento:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verificar configuración de correo
 * @returns {boolean} true si está configurado
 */
export const isEmailConfigured = () => {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
         !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
};
