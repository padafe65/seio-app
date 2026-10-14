import multer from 'multer';

// Keep PDFs in memory until the route validates the signature and authorization.
const uploadImprovementPlanPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const isPdf = file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname || '');
    callback(isPdf ? null : new Error('Solo se permiten archivos PDF.'), isPdf);
  }
});

export default uploadImprovementPlanPdf;
