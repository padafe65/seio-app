import request from 'supertest';
import app from '../app.js';
import { pool, clearTestDatabase } from '../config/testDb.js';
import jwt from 'jsonwebtoken';

// Datos de prueba
const testAdmin = {
  email: 'admin@test.com',
  password: 'admin123',
  role: 'admin'
};

const testTeacher = {
  name: 'Profesor Prueba',
  email: 'teacher@test.com',
  password: 'teacher123',
  role: 'docente'
};

const testStudent = {
  name: 'Estudiante Prueba',
  email: 'student@test.com',
  password: 'student123',
  role: 'estudiante',
  contact_phone: '123456789',
  contact_email: 'contact@student.com',
  age: 20,
  grade: '10',
  course_id: 1
};

let adminToken;
let teacherToken;
let studentToken;
let createdStudentId;

// Antes de todas las pruebas
beforeAll(async () => {
  // Clear and initialize test database
  await clearTestDatabase();
  
  // Import database schema here or run migrations
  // For now, we'll just create the necessary tables for testing
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'docente', 'estudiante') NOT NULL,
      estado ENUM('activo', 'inactivo') DEFAULT 'activo',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS teachers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      subject VARCHAR(255),
      institution VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      contact_phone VARCHAR(20),
      contact_email VARCHAR(255),
      age INT,
      grade VARCHAR(10),
      course_id INT,
      profile_image VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS teacher_students (
      teacher_id INT NOT NULL,
      student_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (teacher_id, student_id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
  `);
  // Limpiar datos de prueba
  await pool.query('DELETE FROM users WHERE email LIKE ?', ['%@test.com']);
  
  // Crear usuario administrador
  const [admin] = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [testAdmin.email, testAdmin.email, testAdmin.password, testAdmin.role]
  );
  
  // Crear token de administrador
  adminToken = jwt.sign(
    { id: admin.insertId, email: testAdmin.email, role: testAdmin.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  // Crear usuario docente
  const [teacherUser] = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [testTeacher.name, testTeacher.email, testTeacher.password, testTeacher.role]
  );
  
  // Crear registro de docente
  await pool.query(
    'INSERT INTO teachers (user_id, subject, institution) VALUES (?, ?, ?)',
    [teacherUser.insertId, 'Matemáticas', 'Colegio Prueba']
  );
  
  // Crear token de docente
  teacherToken = jwt.sign(
    { id: teacherUser.insertId, email: testTeacher.email, role: testTeacher.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  // Crear usuario estudiante
  const [studentUser] = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [testStudent.name, testStudent.email, testStudent.password, testStudent.role]
  );
  
  // Crear registro de estudiante
  await pool.query(
    'INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id) VALUES (?, ?, ?, ?, ?, ?)',
    [studentUser.insertId, testStudent.contact_phone, testStudent.contact_email, testStudent.age, testStudent.grade, testStudent.course_id]
  );
  
  // Crear token de estudiante
  studentToken = jwt.sign(
    { id: studentUser.insertId, email: testStudent.email, role: testStudent.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

describe('Student API Integration Tests', () => {
  // Prueba 1: Crear un nuevo estudiante (solo admin)
  describe('POST /api/students', () => {
    it('debería crear un nuevo estudiante con rol de administrador', async () => {
      const newStudent = {
        name: 'Nuevo Estudiante',
        email: 'nuevo@estudiante.com',
        contact_phone: '987654321',
        contact_email: 'contacto@estudiante.com',
        age: 18,
        grade: '9',
        course_id: 1
      };
      
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', newStudent.name)
        .field('email', newStudent.email)
        .field('contact_phone', newStudent.contact_phone)
        .field('contact_email', newStudent.contact_email)
        .field('age', newStudent.age)
        .field('grade', newStudent.grade)
        .field('course_id', newStudent.course_id);
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      
      // Guardar el ID para pruebas posteriores
      createdStudentId = res.body.data.id;
    });
    
    it('debería denegar la creación de estudiante sin autenticación', async () => {
      const res = await request(app)
        .post('/api/students')
        .send({
          name: 'Estudiante No Autorizado',
          email: 'noauth@test.com',
          contact_phone: '123456789',
          contact_email: 'contact@test.com',
          age: 20,
          grade: '10',
          course_id: 1
        });
      
      expect(res.statusCode).toEqual(401);
    });
    
    it('debería denegar la creación de estudiante con rol de docente', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          name: 'Estudiante Docente',
          email: 'docente@test.com',
          contact_phone: '123456789',
          contact_email: 'docente@test.com',
          age: 20,
          grade: '10',
          course_id: 1
        });
      
      expect(res.statusCode).toEqual(403);
    });
  });
  
  // Prueba 2: Obtener estudiante por ID
  describe('GET /api/students/:id', () => {
    it('debería obtener un estudiante por ID con rol de administrador', async () => {
      const res = await request(app)
        .get(`/api/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', createdStudentId);
    });
    
    it('debería obtener un estudiante por ID con rol de docente', async () => {
      const res = await request(app)
        .get(`/api/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
    
    it('debería denegar el acceso a un estudiante que no es el suyo', async () => {
      const res = await request(app)
        .get(`/api/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(res.statusCode).toEqual(403);
    });
  });
  
  // Prueba 3: Actualizar estudiante
  describe('PATCH /api/students/:id', () => {
    it('debería actualizar un estudiante con rol de administrador', async () => {
      const updatedData = {
        name: 'Estudiante Actualizado',
        contact_phone: '987654321',
        age: 19
      };
      
      const res = await request(app)
        .patch(`/api/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedData);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('name', updatedData.name);
      expect(res.body.data).toHaveProperty('contact_phone', updatedData.contact_phone);
      expect(res.body.data).toHaveProperty('age', updatedData.age);
    });
  });
  
  // Prueba 4: Eliminar estudiante
  describe('DELETE /api/students/:id', () => {
    it('debería eliminar un estudiante con rol de administrador', async () => {
      const res = await request(app)
        .delete(`/api/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      
      // Verificar que el estudiante ya no existe
      const [students] = await pool.query('SELECT * FROM students WHERE id = ?', [createdStudentId]);
      expect(students.length).toBe(0);
    });
    
    it('debería denegar la eliminación con rol de docente', async () => {
      // Crear un estudiante temporal para esta prueba
      const [user] = await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Temp Student', 'temp@student.com', 'temp123', 'estudiante']
      );
      
      const [student] = await pool.query(
        'INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id) VALUES (?, ?, ?, ?, ?, ?)',
        [user.insertId, '123456789', 'temp@student.com', 20, '10', 1]
      );
      
      const tempStudentId = student.insertId;
      
      const res = await request(app)
        .delete(`/api/students/${tempStudentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(res.statusCode).toEqual(403);
      
      // Limpiar
      await pool.query('DELETE FROM students WHERE id = ?', [tempStudentId]);
      await pool.query('DELETE FROM users WHERE id = ?', [user.insertId]);
    });
  });
});

describe('Student-Teacher Relationship Tests', () => {
  let teacherId;
  let studentId;
  
  beforeAll(async () => {
    // Obtener el ID del profesor de prueba
    const [teacher] = await pool.query('SELECT id FROM teachers LIMIT 1');
    teacherId = teacher[0].id;
    
    // Crear un estudiante para pruebas de relación
    const [user] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Rel Student', 'rel@student.com', 'rel123', 'estudiante']
    );
    
    const [student] = await pool.query(
      'INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id) VALUES (?, ?, ?, ?, ?, ?)',
      [user.insertId, '123456789', 'rel@student.com', 20, '10', 1]
    );
    
    studentId = student.insertId;
  });
  
  // Prueba 5: Asignar estudiante a profesor
  it('debería asignar un estudiante a un profesor', async () => {
    const res = await request(app)
      .post(`/api/teachers/${teacherId}/students/${studentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    
    // Verificar la relación
    const [relations] = await pool.query(
      'SELECT * FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
      [teacherId, studentId]
    );
    
    expect(relations.length).toBe(1);
  });
  
  // Prueba 6: Obtener estudiantes de un profesor
  it('debería obtener los estudiantes de un profesor', async () => {
    const res = await request(app)
      .get(`/api/teachers/${teacherId}/students`)
      .set('Authorization', `Bearer ${teacherToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    
    // Verificar que el estudiante está en la lista
    const studentFound = res.body.data.some(s => s.id === studentId);
    expect(studentFound).toBe(true);
  });
  
  afterAll(async () => {
    // Limpiar datos de prueba
    await pool.query('DELETE FROM teacher_students WHERE teacher_id = ?', [teacherId]);
    await pool.query('DELETE FROM students WHERE id = ?', [studentId]);
    await pool.query('DELETE FROM users WHERE email = ?', ['rel@student.com']);
  });
});

describe('Error Handling Tests', () => {
  it('debería manejar estudiante no encontrado', async () => {
    const nonExistentId = 999999;
    const res = await request(app)
      .get(`/api/students/${nonExistentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
  });
  
  it('debería validar los datos del estudiante', async () => {
    const invalidStudent = {
      name: '', // Nombre vacío
      email: 'invalid-email', // Email inválido
      age: 'no-es-un-numero' // Edad no numérica
    };
    
    const res = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(invalidStudent);
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});

// Después de todas las pruebas
afterAll(async () => {
  // Cerrar la conexión a la base de datos
  await pool.end();
});
