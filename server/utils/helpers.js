// backend-rifa/utils/helpers.js
export const generateRandomNumber = () => {
    return Math.floor(1000 + Math.random() * 9000);
  };
  
  // backend-rifa/server.js
  import express from 'express';
  import cors from 'cors';
  import dotenv from 'dotenv';
  import authRoutes from './routes/authRoutes.js';
  import rifaRoutes from './routes/rifaRoutes.js';
  
  dotenv.config();
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api', rifaRoutes);
  
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
  
  