import pool from '../config/db.js';
import { sendLegalConsentNotification } from './emailService.js';

export const notifyLegalConsent = async (consentId, details) => {
  try {
    const result = await sendLegalConsentNotification(details);
    const [existingRows] = await pool.query(
      'SELECT notification_recipients, notification_details FROM legal_consents WHERE id = ?',
      [consentId]
    );
    const parseArray = (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
      }
      return [];
    };
    const previousRecipients = parseArray(existingRows[0]?.notification_recipients);
    const previousDetails = parseArray(existingRows[0]?.notification_details);
    const recipients = [...new Set([...previousRecipients, ...result.recipients])];
    const allDetails = [...previousDetails, ...(result.details || [{ error: result.error }])];
    const sentCount = allDetails.filter((item) => item.sent).length;
    const overallStatus = sentCount === allDetails.length ? 'sent' : sentCount ? 'partial' : 'failed';
    await pool.query(
      `UPDATE legal_consents
       SET notification_status = ?, notification_recipients = ?, notification_details = ?
       WHERE id = ?`,
      [overallStatus, JSON.stringify(recipients), JSON.stringify(allDetails), consentId]
    );
    return { ...result, status: overallStatus, recipients, details: allDetails };
  } catch (error) {
    console.error('No se pudo procesar la notificación de aceptación:', error);
    try {
      await pool.query(
        `UPDATE legal_consents SET notification_status = 'failed', notification_details = ? WHERE id = ?`,
        [JSON.stringify([{ error: error.message }]), consentId]
      );
    } catch (updateError) {
      console.error('No se pudo guardar el estado del correo:', updateError.message);
    }
    return { status: 'failed', error: error.message };
  }
};
