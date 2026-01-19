import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  sendMessage,
  getInbox,
  getSentMessages,
  getMessage,
  markAsRead,
  deleteMessage,
  getUnreadCount,
  getAvailableRecipients
} from '../controllers/messageController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas de mensajería
router.post('/', sendMessage);
router.get('/inbox', getInbox);
router.get('/sent', getSentMessages);
router.get('/unread-count', getUnreadCount);
router.get('/recipients', getAvailableRecipients);
router.get('/:id', getMessage);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteMessage);

export default router;
