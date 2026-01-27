#!/usr/bin/env node
/**
 * Crea tablas attendance_sessions y attendance_records.
 * Uso: node server/scripts/run-migration-attendance.js
 *      npm run migrate:attendance (desde raíz, si está en package.json)
 */
import pool from '../config/db.js';

const SQL = `
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  teacher_id INT NOT NULL,
  name VARCHAR(120) DEFAULT NULL,
  session_date DATE NOT NULL,
  grade VARCHAR(20) DEFAULT NULL,
  course_id INT DEFAULT NULL,
  token VARCHAR(64) NOT NULL,
  short_code VARCHAR(12) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_token (token),
  UNIQUE KEY uk_short_code (short_code),
  KEY idx_teacher (teacher_id),
  KEY idx_expires (expires_at),
  KEY idx_session_date (session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id INT UNSIGNED NOT NULL,
  student_id INT NOT NULL,
  status ENUM('present','absent') NOT NULL DEFAULT 'present',
  source ENUM('manual','qr') NOT NULL DEFAULT 'manual',
  registered_at DATETIME NOT NULL DEFAULT (NOW()),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_session_student (session_id, student_id),
  KEY idx_session (session_id),
  KEY idx_student (student_id),
  CONSTRAINT fk_ar_session FOREIGN KEY (session_id) REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function run() {
  try {
    const statements = SQL.split(';').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    console.log('✅ Migración aplicada: attendance_sessions y attendance_records.');
  } catch (e) {
    console.error('❌ Error en migración:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
