import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Configuración de la conexión a la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'seio_db',
  port: process.env.DB_PORT || 3306
};

async function testDatabase() {
  let connection;
  
  try {
    // 1. Conectar a la base de datos
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión exitosa a la base de datos');

    // 2. Verificar el usuario con ID 23 (según el log)
    console.log('\n🔍 Verificando usuario con ID 23:');
    const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [23]);
    console.log('Usuario encontrado:', users[0]);

    if (users.length === 0) {
      console.error('❌ Usuario no encontrado');
      return;
    }

    const user = users[0];

    // 3. Verificar si el usuario es docente
    console.log('\n🔍 Verificando si el usuario es docente:');
    const [teachers] = await connection.query('SELECT * FROM teachers WHERE user_id = ?', [user.id]);
    console.log('Registros en teachers:', teachers);

    if (teachers.length === 0) {
      console.error('❌ El usuario no tiene un perfil de docente');
      return;
    }

    const teacher = teachers[0];
    console.log('Docente encontrado:', teacher);

    // 4. Verificar cuestionarios del docente
    console.log('\n🔍 Verificando cuestionarios del docente:');
    const [questionnaires] = await connection.query(
      'SELECT * FROM questionnaires WHERE created_by = ?', 
      [teacher.id]
    );
    
    console.log(`\n📋 Cuestionarios encontrados (${questionnaires.length}):`);
    console.table(questionnaires);

    // 5. Verificar la consulta completa con joins
    console.log('\n🔍 Verificando consulta completa con joins:');
    const [fullData] = await connection.query(`
      SELECT 
        q.*, 
        u.name as teacher_name,
        c.name as course_name
      FROM questionnaires q
      INNER JOIN teachers t ON q.created_by = t.id
      INNER JOIN users u ON t.user_id = u.id
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE q.created_by = ?
    `, [teacher.id]);
    
    console.log('\n📋 Resultado de la consulta completa:');
    console.table(fullData);

  } catch (error) {
    console.error('❌ Error en la prueba de base de datos:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar la prueba
testDatabase();
