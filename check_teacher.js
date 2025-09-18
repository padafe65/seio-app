// Script para verificar los datos del docente en la base de datos
const mysql = require('mysql2/promise');

async function checkTeacher() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'seio_db'
  });

  try {
    // Verificar el usuario
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE email = ?', 
      ['carlosferrer@gmail.com']
    );

    if (users.length === 0) {
      console.log('❌ No se encontró el usuario con ese correo');
      return;
    }

    const user = users[0];
    console.log('👤 Usuario encontrado:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    // Verificar si es docente
    if (user.role === 'docente') {
      const [teachers] = await connection.execute(
        'SELECT * FROM teachers WHERE user_id = ?',
        [user.id]
      );

      if (teachers.length === 0) {
        console.log('⚠️ El usuario es docente pero no tiene un registro en la tabla teachers');
      } else {
        console.log('✅ Docente encontrado en la tabla teachers:', {
          teacher_id: teachers[0].id,
          user_id: teachers[0].user_id,
          institution_id: teachers[0].institution_id
        });
      }
    } else {
      console.log('ℹ️ El usuario no tiene el rol de docente');
    }
  } catch (error) {
    console.error('❌ Error al consultar la base de datos:', error);
  } finally {
    await connection.end();
  }
}

checkTeacher();
