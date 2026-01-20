/**
 * Script de prueba para el sistema de envío de emails
 * 
 * Este script permite probar las funciones de envío de email sin necesidad
 * de ejecutar todo el proceso de evaluación de fase.
 * 
 * Uso:
 * node test-email-system.js [tipo] [studentId] [phase]
 * 
 * Tipos:
 * - phase: Enviar email de resultados de fase
 * - final: Enviar email de nota final
 * - plan: Enviar email de plan de mejoramiento
 */

import pool from './config/db.js';
import { sendPhaseResultsEmail, sendFinalGradeEmail, sendImprovementPlanEmail } from './utils/emailService.js';
import dotenv from 'dotenv';

dotenv.config();

const testType = process.argv[2] || 'phase';
const studentId = parseInt(process.argv[3]) || null;
const phase = parseInt(process.argv[4]) || 1;

async function testPhaseEmail() {
  try {
    console.log('🧪 Probando envío de email de resultados de fase...\n');
    
    if (!studentId) {
      console.error('❌ Error: Debes proporcionar un studentId');
      console.log('Uso: node test-email-system.js phase [studentId] [phase]');
      process.exit(1);
    }
    
    // Obtener datos del estudiante
    const [students] = await pool.query(`
      SELECT 
        s.id as student_id,
        s.contact_email,
        s.grade,
        u.name as student_name,
        u.email as student_email,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.id = ?
    `, [studentId]);
    
    if (students.length === 0) {
      console.error(`❌ Error: No se encontró estudiante con ID ${studentId}`);
      process.exit(1);
    }
    
    const student = students[0];
    
    // Obtener nota de la fase
    const [grades] = await pool.query(`
      SELECT 
        CASE 
          WHEN ? = 1 THEN phase1
          WHEN ? = 2 THEN phase2
          WHEN ? = 3 THEN phase3
          WHEN ? = 4 THEN phase4
        END as phase_score
      FROM grades
      WHERE student_id = ?
    `, [phase, phase, phase, phase, studentId]);
    
    const phaseScore = grades.length > 0 && grades[0].phase_score ? parseFloat(grades[0].phase_score) : 3.0;
    
    // Obtener indicadores fallidos
    const [failedIndicators] = await pool.query(`
      SELECT DISTINCT
        i.id,
        i.description,
        i.subject,
        i.category
      FROM student_indicators si
      JOIN indicators i ON si.indicator_id = i.id
      WHERE si.student_id = ? 
      AND si.achieved = 0
      AND i.phase = ?
      ORDER BY i.subject, i.category
      LIMIT 5
    `, [studentId, phase]);
    
    // Obtener plan de mejoramiento si existe
    const [plans] = await pool.query(`
      SELECT ip.* 
      FROM improvement_plans ip
      WHERE ip.student_id = ? 
      AND (ip.title LIKE ? OR ip.title LIKE ?)
      ORDER BY ip.created_at DESC
      LIMIT 1
    `, [studentId, `%Fase ${phase}%`, `%fase ${phase}%`]);
    
    const improvementPlan = plans.length > 0 ? plans[0] : null;
    
    const studentData = {
      id: student.student_id,
      name: student.student_name,
      email: student.student_email,
      contact_email: student.contact_email,
      grade: student.grade,
      course_name: student.course_name
    };
    
    console.log('📧 Datos del email:');
    console.log(`   Estudiante: ${studentData.name}`);
    console.log(`   Email estudiante: ${studentData.email}`);
    console.log(`   Email acudiente: ${studentData.contact_email}`);
    console.log(`   Fase: ${phase}`);
    console.log(`   Nota: ${phaseScore}`);
    console.log(`   Plan de mejoramiento: ${improvementPlan ? 'Sí' : 'No'}`);
    console.log(`   Indicadores fallidos: ${failedIndicators.length}\n`);
    
    const result = await sendPhaseResultsEmail(
      studentData,
      phase,
      phaseScore,
      improvementPlan,
      failedIndicators
    );
    
    if (result.success) {
      console.log('✅ Email enviado exitosamente!');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.error('❌ Error al enviar email:', result.error || result.message);
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

async function testFinalGradeEmail() {
  try {
    console.log('🧪 Probando envío de email de nota final...\n');
    
    if (!studentId) {
      console.error('❌ Error: Debes proporcionar un studentId');
      console.log('Uso: node test-email-system.js final [studentId]');
      process.exit(1);
    }
    
    // Obtener datos del estudiante y notas
    const [students] = await pool.query(`
      SELECT 
        s.id as student_id,
        s.contact_email,
        s.grade,
        u.name as student_name,
        u.email as student_email,
        c.name as course_name,
        g.phase1,
        g.phase2,
        g.phase3,
        g.phase4,
        g.average as final_grade
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN grades g ON s.id = g.student_id
      WHERE s.id = ?
    `, [studentId]);
    
    if (students.length === 0) {
      console.error(`❌ Error: No se encontró estudiante con ID ${studentId}`);
      process.exit(1);
    }
    
    const student = students[0];
    const finalGrade = student.final_grade || 3.0;
    
    const studentData = {
      id: student.student_id,
      name: student.student_name,
      email: student.student_email,
      contact_email: student.contact_email,
      grade: student.grade,
      course_name: student.course_name
    };
    
    const phaseGrades = {
      phase1: student.phase1,
      phase2: student.phase2,
      phase3: student.phase3,
      phase4: student.phase4
    };
    
    console.log('📧 Datos del email:');
    console.log(`   Estudiante: ${studentData.name}`);
    console.log(`   Email estudiante: ${studentData.email}`);
    console.log(`   Email acudiente: ${studentData.contact_email}`);
    console.log(`   Nota final: ${finalGrade}`);
    console.log(`   Fase 1: ${phaseGrades.phase1 || 'N/A'}`);
    console.log(`   Fase 2: ${phaseGrades.phase2 || 'N/A'}`);
    console.log(`   Fase 3: ${phaseGrades.phase3 || 'N/A'}`);
    console.log(`   Fase 4: ${phaseGrades.phase4 || 'N/A'}\n`);
    
    const result = await sendFinalGradeEmail(
      studentData,
      finalGrade,
      phaseGrades
    );
    
    if (result.success) {
      console.log('✅ Email enviado exitosamente!');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.error('❌ Error al enviar email:', result.error || result.message);
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

async function testPlanEmail() {
  try {
    console.log('🧪 Probando envío de email de plan de mejoramiento...\n');
    
    if (!studentId) {
      console.error('❌ Error: Debes proporcionar un studentId');
      console.log('Uso: node test-email-system.js plan [studentId]');
      process.exit(1);
    }
    
    // Obtener datos del estudiante
    const [students] = await pool.query(`
      SELECT 
        s.id as student_id,
        s.contact_email,
        s.grade,
        u.name as student_name,
        u.email as student_email,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.id = ?
    `, [studentId]);
    
    if (students.length === 0) {
      console.error(`❌ Error: No se encontró estudiante con ID ${studentId}`);
      process.exit(1);
    }
    
    const student = students[0];
    
    // Obtener plan de mejoramiento más reciente
    const [plans] = await pool.query(`
      SELECT * FROM improvement_plans 
      WHERE student_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [studentId]);
    
    if (plans.length === 0) {
      console.error(`❌ Error: No se encontró plan de mejoramiento para estudiante ${studentId}`);
      process.exit(1);
    }
    
    const improvementPlan = plans[0];
    
    const studentData = {
      id: student.student_id,
      name: student.student_name,
      email: student.student_email,
      contact_email: student.contact_email,
      grade: student.grade,
      course_name: student.course_name
    };
    
    console.log('📧 Datos del email:');
    console.log(`   Estudiante: ${studentData.name}`);
    console.log(`   Email estudiante: ${studentData.email}`);
    console.log(`   Email acudiente: ${studentData.contact_email}`);
    console.log(`   Plan: ${improvementPlan.title}\n`);
    
    const result = await sendImprovementPlanEmail(
      studentData,
      improvementPlan
    );
    
    if (result.success) {
      console.log('✅ Email enviado exitosamente!');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.error('❌ Error al enviar email:', result.error || result.message);
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Ejecutar prueba según el tipo
console.log('🚀 Iniciando prueba del sistema de emails...\n');

switch (testType) {
  case 'phase':
    testPhaseEmail();
    break;
  case 'final':
    testFinalGradeEmail();
    break;
  case 'plan':
    testPlanEmail();
    break;
  default:
    console.error(`❌ Tipo de prueba inválido: ${testType}`);
    console.log('Tipos válidos: phase, final, plan');
    process.exit(1);
}
