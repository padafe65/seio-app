import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import db from '../config/db.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurar multer para manejar la carga de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nombre = `comprobante_${Date.now()}${ext}`;
    cb(null, nombre);
  }
});

const upload = multer({ storage });

// Ruta para subir comprobantes
router.post('/subir-comprobante/:id', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: 'No se ha subido ningún archivo' });
    }

    const { id } = req.params;
    const { filename } = req.file;

    // Actualizar la base de datos con la ruta del archivo
    await db.query(
      'UPDATE students SET comprobante_url = ? WHERE id = ?',
      [filename, id]
    );

    res.json({ mensaje: 'Comprobante subido correctamente', filename });
  } catch (error) {
    console.error('Error al subir el comprobante:', error);
    res.status(500).json({ mensaje: 'Error al subir el comprobante' });
  }
});

export default router;
