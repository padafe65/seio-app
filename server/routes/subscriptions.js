// F:/seio/server/routes/subscriptions.js

import express from 'express';
import { 
  notifyManualPayment, 
  approvePayment, 
  getAllSubscriptionsAdmin, 
  getMySubscription, 
  registerSubscription,
  createCheckoutSession // Solo si hiciste la Opción 2
} from '../controllers/subscriptionsController.js';
import { verifyToken, isAdmin } from '../middleware/authMiddleware.js';
import upload from '../config/multer.js';

const router = express.Router();

// Rutas actualizadas
router.post('/notify-manual', verifyToken, upload.single('proof'), notifyManualPayment);
router.post('/approve', verifyToken, isAdmin, approvePayment);
router.get('/admin/all', verifyToken, isAdmin, getAllSubscriptionsAdmin);
router.get('/my-subscription', verifyToken, getMySubscription);

export default router;