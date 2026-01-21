// server/routes/authRoutes.js
import express from 'express';
import { register, login, checkTeacher } from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();
router.post('/register', register);
router.post('/login', login);
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
