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
 * Verificar configuración de correo
 * @returns {boolean} true si está configurado
 */
export const isEmailConfigured = () => {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
         !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
};
