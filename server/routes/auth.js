// server/routes/auth.js
import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/verify', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email
    }
  });
});

export default router;
