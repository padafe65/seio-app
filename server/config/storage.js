// Configuración de almacenamiento flexible (local/AWS S3)
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tipo de almacenamiento: 'local' o 's3'
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';

// Configuración para almacenamiento local
const getLocalStorage = () => {
  const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads/guides');
  
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = `guia-${uniqueSuffix}${ext}`;
      cb(null, filename);
    }
  });
};

// Configuración de multer para subida de archivos
const storage = STORAGE_TYPE === 's3' ? null : getLocalStorage();

// Middleware de multer para subir PDFs
export const uploadGuide = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB máximo para PDFs
  },
  fileFilter: (req, file, cb) => {
    // Permitir solo PDFs
    const filetypes = /pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten archivos PDF'));
  }
});

// Función para obtener la ruta del archivo subido
export const getFilePath = (file) => {
  if (STORAGE_TYPE === 's3') {
    // En producción con S3, se subiría a S3 y se retornaría la URL
    // Por ahora retornamos null para implementación futura
    return null;
  } else {
    // Almacenamiento local: retornar ruta relativa
    if (file) {
      return `guides/${file.filename}`;
    }
    return null;
  }
};

// Función para obtener la URL completa del archivo
export const getFileUrl = (filePath) => {
  if (!filePath) return null;
  
  if (STORAGE_TYPE === 's3') {
    // Si ya es una URL completa de S3, retornarla
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    // Construir URL de S3
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${filePath}`;
  } else {
    // Almacenamiento local: construir URL relativa
    return `/uploads/${filePath}`;
  }
};

// Función para eliminar archivo (futuro para AWS S3)
export const deleteFile = async (filePath) => {
  if (STORAGE_TYPE === 's3') {
    // Implementar eliminación de S3 en el futuro
    console.log('Eliminación de S3 no implementada aún');
    return;
  } else {
    // Eliminar archivo local
    const fs = await import('fs');
    const fullPath = path.join(__dirname, '../uploads', filePath);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
    }
  }
};

export default {
  STORAGE_TYPE,
  uploadGuide,
  getFilePath,
  getFileUrl,
  deleteFile
};
