import pool from './config/db.js';

async function checkTable() {
  try {
    // Verificar si la tabla indicators tiene la columna questionnaire_id
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'seio_db' 
      AND TABLE_NAME = 'indicators';
    `);
    
    console.log('Estructura de la tabla indicators:');
    console.table(columns);
    
    // Verificar las relaciones de clave foránea
    const [fks] = await pool.query(`
      SELECT 
        TABLE_NAME, COLUMN_NAME, 
        REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'seio_db' 
      AND TABLE_NAME = 'indicators';
    `);
    
    console.log('\nRelaciones de la tabla indicators:');
    console.table(fks);
    
  } catch (error) {
    console.error('Error al verificar la tabla:', error);
  } finally {
    process.exit();
  }
}

checkTable();
