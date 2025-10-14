// Utilidad para sincronizar subject_categories con questionnaires
import pool from '../config/db.js';

/**
 * Sincroniza la tabla subject_categories con las combinaciones únicas
 * de subject-category que existen en questionnaires
 */
export async function syncSubjectCategories() {
  try {
    console.log('🔄 Sincronizando subject_categories con questionnaires...');
    
    const [result] = await pool.query(`
      INSERT IGNORE INTO subject_categories (subject, category)
      SELECT DISTINCT 
        q.subject,
        q.category
      FROM questionnaires q
      WHERE q.subject IS NOT NULL 
        AND q.category IS NOT NULL
    `);
    
    if (result.affectedRows > 0) {
      console.log(`✅ Se agregaron ${result.affectedRows} nuevas combinaciones a subject_categories`);
    } else {
      console.log('✅ subject_categories ya está sincronizada');
    }
    
    // Mostrar estadísticas
    const [stats] = await pool.query(`
      SELECT COUNT(*) as total FROM subject_categories
    `);
    console.log(`📊 Total de combinaciones en subject_categories: ${stats[0].total}`);
    
  } catch (error) {
    console.error('❌ Error al sincronizar subject_categories:', error);
    throw error;
  }
}

/**
 * Asegura que una combinación subject-category específica exista
 * @param {string} subject - La materia
 * @param {string} category - La categoría
 */
export async function ensureSubjectCategoryExists(subject, category) {
  if (!subject || !category) return;
  
  try {
    const [existing] = await pool.query(
      'SELECT id FROM subject_categories WHERE subject = ? AND category = ?',
      [subject, category]
    );
    
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO subject_categories (subject, category) VALUES (?, ?)',
        [subject, category]
      );
      console.log(`✅ Creado subject_category: ${subject} - ${category}`);
    }
  } catch (error) {
    // Si es un error de duplicado (por race condition), ignorarlo
    if (error.code !== 'ER_DUP_ENTRY') {
      console.error('❌ Error al crear subject_category:', error);
    }
  }
}

