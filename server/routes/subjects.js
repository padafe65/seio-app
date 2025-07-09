// routes/subjects.js
import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// Obtener categorías por materia
router.get('/categories/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    
    console.log("Buscando categorías para materia:", subject);
    
    // 1. Intentar buscar exactamente como viene
    let [rows] = await pool.query(
      'SELECT * FROM subject_categories WHERE subject = ?',
      [subject]
    );
    
    // 2. Si no hay resultados, intentar normalizar (quitar tildes)
    if (rows.length === 0) {
      const normalizedSubject = subject
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Quita tildes
      
      [rows] = await pool.query(
        'SELECT * FROM subject_categories WHERE subject = ?',
        [normalizedSubject]
      );
    }
    
    // 3. Si aún no hay resultados, buscar con LIKE para coincidencias parciales
    if (rows.length === 0) {
      [rows] = await pool.query(
        'SELECT * FROM subject_categories WHERE subject LIKE ?',
        [`%${subject}%`]
      );
    }
    
    // 4. Si todavía no hay resultados, devolver categorías genéricas
    if (rows.length === 0) {
      console.log(`No se encontraron categorías para ${subject}, devolviendo predeterminadas`);
      return res.json([
        { category: `${subject}_Teoría` },
        { category: `${subject}_Práctica` },
        { category: `${subject}_Evaluación` }
      ]);
    }
    
    console.log(`Se encontraron ${rows.length} categorías para ${subject}`);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener categorías:', error);
    res.status(500).json({ message: 'Error al obtener categorías' });
  }
});

// Obtener categorías por materia (versión alternativa)
router.get('/subject-categories/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    
    // Si la materia es "Matemáticas", buscar como "Matematicas" (sin tilde)
    const searchSubject = subject === 'Matemáticas' ? 'Matematicas' : subject;
    
    // Consulta directa a la tabla subject_categories
    const [rows] = await pool.query(
      'SELECT * FROM subject_categories WHERE subject = ?',
      [searchSubject]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener categorías de materia:', error);
    res.status(500).json({ message: 'Error al obtener categorías de materia' });
  }
});

// Crear una nueva materia
router.post('/', async (req, res) => {
  try {
    const { subject } = req.body;
    
    // Verificar si la materia ya existe
    const [existingRows] = await pool.query(
      'SELECT * FROM subject_categories WHERE subject = ?',
      [subject]
    );
    
    if (existingRows.length > 0) {
      return res.status(400).json({ message: 'Esta materia ya existe' });
    }
    
    // Insertar la materia con una categoría predeterminada
    const [result] = await pool.query(
      'INSERT INTO subject_categories (subject, category) VALUES (?, ?)',
      [subject, `${subject}_General`]
    );
    
    res.status(201).json({
      id: result.insertId,
      subject,
      category: `${subject}_General`
    });
  } catch (error) {
    console.error('❌ Error al crear materia:', error);
    res.status(500).json({ message: 'Error al crear materia' });
  }
});

// Obtener todas las categorías
router.get('/all-categories', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM subject_categories ORDER BY subject, category'
    );
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener todas las categorías:', error);
    res.status(500).json({ message: 'Error al obtener todas las categorías' });
  }
});

// Obtener todas las materias disponibles
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT subject FROM subject_categories ORDER BY subject'
    );
    
    res.json(rows.map(row => row.subject));
  } catch (error) {
    console.error('❌ Error al obtener materias:', error);
    res.status(500).json({ message: 'Error al obtener materias' });
  }
});

// Obtener la materia de un docente
router.get('/teacher/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [rows] = await pool.query(
      'SELECT subject FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }
    
    res.json({ subject: rows[0].subject });
  } catch (error) {
    console.error('❌ Error al obtener materia del docente:', error);
    res.status(500).json({ message: 'Error al obtener materia del docente' });
  }
});

export default router;
