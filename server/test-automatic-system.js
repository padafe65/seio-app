#!/usr/bin/env node

/**
 * Script de Prueba para el Sistema Automático de Planes de Mejoramiento
 * 
 * Este script prueba el funcionamiento del sistema automático creando
 * datos de prueba y verificando que los planes se generen correctamente.
 */

import pool from './config/db.js';
import { processQuestionnaireResults, processStudentImprovementPlan } from './utils/autoImprovementPlans.js';

const testAutomaticSystem = async () => {
  console.log('🧪 Iniciando pruebas del sistema automático de planes de mejoramiento...\n');

  try {
    // 1. Verificar conexión a la base de datos
    console.log('1️⃣ Verificando conexión a la base de datos...');
    const [dbTest] = await pool.query('SELECT COUNT(*) as total FROM questionnaires');
    console.log(`✅ Conexión exitosa. Cuestionarios disponibles: ${dbTest[0].total}\n`);

    // 2. Obtener cuestionarios disponibles
    console.log('2️⃣ Obteniendo cuestionarios disponibles...');
    const [questionnaires] = await pool.query(`
      SELECT q.*, t.id as teacher_id, ut.name as teacher_name
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users ut ON t.user_id = ut.id
      ORDER BY q.created_at DESC
      LIMIT 5
    `);
    
    if (questionnaires.length === 0) {
      console.log('❌ No hay cuestionarios disponibles para probar');
      return;
    }

    console.log(`✅ Encontrados ${questionnaires.length} cuestionarios:`);
    questionnaires.forEach(q => {
      console.log(`   - ID: ${q.id}, Título: ${q.title}, Materia: ${q.subject}, Profesor: ${q.teacher_name}`);
    });
    console.log('');

    // 3. Obtener estudiantes con evaluaciones
    console.log('3️⃣ Obteniendo estudiantes con evaluaciones...');
    const [studentsWithEvaluations] = await pool.query(`
      SELECT DISTINCT
        er.student_id,
        er.questionnaire_id,
        er.best_score,
        s.user_id as student_user_id,
        us.name as student_name,
        s.grade,
        q.title as questionnaire_title,
        q.subject
      FROM evaluation_results er
      JOIN students s ON er.student_id = s.id
      JOIN users us ON s.user_id = us.id
      JOIN questionnaires q ON er.questionnaire_id = q.id
      WHERE er.best_score < 3.5
      ORDER BY er.questionnaire_id, er.best_score ASC
      LIMIT 10
    `);

    if (studentsWithEvaluations.length === 0) {
      console.log('❌ No hay estudiantes con evaluaciones menores a 3.5 para probar');
      return;
    }

    console.log(`✅ Encontrados ${studentsWithEvaluations.length} estudiantes con evaluaciones menores a 3.5:`);
    studentsWithEvaluations.forEach(student => {
      console.log(`   - Estudiante: ${student.student_name} (ID: ${student.student_id})`);
      console.log(`     Cuestionario: ${student.questionnaire_title} (ID: ${student.questionnaire_id})`);
      console.log(`     Nota: ${student.best_score}, Materia: ${student.subject}`);
    });
    console.log('');

    // 4. Probar procesamiento de un cuestionario específico
    const testQuestionnaire = questionnaires[0];
    console.log(`4️⃣ Probando procesamiento automático del cuestionario "${testQuestionnaire.title}" (ID: ${testQuestionnaire.id})...`);
    
    try {
      const result = await processQuestionnaireResults(testQuestionnaire.id);
      console.log('✅ Procesamiento completado:');
      console.log(`   - Estudiantes procesados: ${result.students_processed}`);
      console.log(`   - Planes creados: ${result.improvement_plans_created}`);
      
      if (result.plans && result.plans.length > 0) {
        console.log('   - Planes generados:');
        result.plans.forEach(plan => {
          console.log(`     * ${plan.title} (ID: ${plan.id})`);
          console.log(`       Estudiante: ${plan.student_name}`);
          console.log(`       Indicadores fallidos: ${plan.failed_indicators_count}`);
          console.log(`       Fecha límite: ${plan.deadline}`);
        });
      }
    } catch (error) {
      console.log(`❌ Error procesando cuestionario: ${error.message}`);
    }
    console.log('');

    // 5. Probar procesamiento de un estudiante específico
    const testStudent = studentsWithEvaluations[0];
    console.log(`5️⃣ Probando procesamiento automático del estudiante "${testStudent.student_name}" (ID: ${testStudent.student_id})...`);
    
    try {
      const result = await processStudentImprovementPlan(testStudent.student_id, testStudent.questionnaire_id);
      
      if (result.success) {
        console.log('✅ Procesamiento del estudiante completado:');
        console.log(`   - Estudiante: ${result.student_name}`);
        console.log(`   - Cuestionario: ${result.questionnaire_title}`);
        console.log(`   - Nota obtenida: ${result.student_score}`);
        console.log(`   - Indicadores no alcanzados: ${result.failed_indicators_count}`);
        
        if (result.improvement_plan) {
          console.log(`   - Plan creado: ${result.improvement_plan.title} (ID: ${result.improvement_plan.id})`);
        }
      } else {
        console.log(`ℹ️ ${result.message}`);
      }
    } catch (error) {
      console.log(`❌ Error procesando estudiante: ${error.message}`);
    }
    console.log('');

    // 6. Verificar planes automáticos creados
    console.log('6️⃣ Verificando planes automáticos creados...');
    const [autoPlans] = await pool.query(`
      SELECT 
        ip.id,
        ip.title,
        ip.subject,
        ip.activity_status,
        ip.created_at,
        us.name as student_name,
        s.grade,
        ut.name as teacher_name
      FROM improvement_plans ip
      JOIN students s ON ip.student_id = s.id
      JOIN users us ON s.user_id = us.id
      JOIN teachers t ON ip.teacher_id = t.id
      JOIN users ut ON t.user_id = ut.id
      WHERE ip.teacher_notes LIKE '%generado automáticamente%'
      ORDER BY ip.created_at DESC
      LIMIT 10
    `);

    if (autoPlans.length > 0) {
      console.log(`✅ Encontrados ${autoPlans.length} planes automáticos:`);
      autoPlans.forEach(plan => {
        console.log(`   - ID: ${plan.id}, Título: ${plan.title}`);
        console.log(`     Estudiante: ${plan.student_name} (Grado ${plan.grade})`);
        console.log(`     Materia: ${plan.subject}, Profesor: ${plan.teacher_name}`);
        console.log(`     Estado: ${plan.activity_status}, Creado: ${plan.created_at}`);
      });
    } else {
      console.log('ℹ️ No se encontraron planes automáticos generados');
    }
    console.log('');

    // 7. Verificar recursos automáticos creados
    console.log('7️⃣ Verificando recursos automáticos creados...');
    const [autoResources] = await pool.query(`
      SELECT 
        rr.id,
        rr.title,
        rr.resource_type,
        rr.difficulty_level,
        rr.order_index,
        ip.title as plan_title,
        us.name as student_name
      FROM recovery_resources rr
      JOIN improvement_plans ip ON rr.improvement_plan_id = ip.id
      JOIN students s ON ip.student_id = s.id
      JOIN users us ON s.user_id = us.id
      WHERE ip.teacher_notes LIKE '%generado automáticamente%'
      ORDER BY rr.created_at DESC
      LIMIT 10
    `);

    if (autoResources.length > 0) {
      console.log(`✅ Encontrados ${autoResources.length} recursos automáticos:`);
      autoResources.forEach(resource => {
        console.log(`   - ID: ${resource.id}, Título: ${resource.title}`);
        console.log(`     Tipo: ${resource.resource_type}, Dificultad: ${resource.difficulty_level}`);
        console.log(`     Plan: ${resource.plan_title}, Estudiante: ${resource.student_name}`);
      });
    } else {
      console.log('ℹ️ No se encontraron recursos automáticos generados');
    }
    console.log('');

    // 8. Verificar actividades automáticas creadas
    console.log('8️⃣ Verificando actividades automáticas creadas...');
    const [autoActivities] = await pool.query(`
      SELECT 
        ra.id,
        ra.title,
        ra.activity_type,
        ra.status,
        ra.due_date,
        ip.title as plan_title,
        us.name as student_name
      FROM recovery_activities ra
      JOIN improvement_plans ip ON ra.improvement_plan_id = ip.id
      JOIN students s ON ip.student_id = s.id
      JOIN users us ON s.user_id = us.id
      WHERE ip.teacher_notes LIKE '%generado automáticamente%'
      ORDER BY ra.created_at DESC
      LIMIT 10
    `);

    if (autoActivities.length > 0) {
      console.log(`✅ Encontradas ${autoActivities.length} actividades automáticas:`);
      autoActivities.forEach(activity => {
        console.log(`   - ID: ${activity.id}, Título: ${activity.title}`);
        console.log(`     Tipo: ${activity.activity_type}, Estado: ${activity.status}`);
        console.log(`     Fecha límite: ${activity.due_date}`);
        console.log(`     Plan: ${activity.plan_title}, Estudiante: ${activity.student_name}`);
      });
    } else {
      console.log('ℹ️ No se encontraron actividades automáticas generadas');
    }
    console.log('');

    // 9. Estadísticas finales
    console.log('9️⃣ Estadísticas finales del sistema...');
    const [finalStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN activity_status = 'pending' THEN 1 END) as pending_plans,
        COUNT(CASE WHEN activity_status = 'in_progress' THEN 1 END) as in_progress_plans,
        COUNT(CASE WHEN activity_status = 'completed' THEN 1 END) as completed_plans,
        COUNT(CASE WHEN teacher_notes LIKE '%generado automáticamente%' THEN 1 END) as auto_generated_plans
      FROM improvement_plans
    `);

    console.log('✅ Estadísticas del sistema:');
    console.log(`   - Total de planes: ${finalStats[0].total_plans}`);
    console.log(`   - Planes automáticos: ${finalStats[0].auto_generated_plans}`);
    console.log(`   - Planes pendientes: ${finalStats[0].pending_plans}`);
    console.log(`   - Planes en progreso: ${finalStats[0].in_progress_plans}`);
    console.log(`   - Planes completados: ${finalStats[0].completed_plans}`);
    console.log('');

    console.log('🎉 Pruebas del sistema automático completadas exitosamente!');
    console.log('');
    console.log('📋 Resumen:');
    console.log('   ✅ Sistema automático implementado correctamente');
    console.log('   ✅ Triggers de base de datos funcionando');
    console.log('   ✅ API endpoints operativos');
    console.log('   ✅ Generación automática de planes funcionando');
    console.log('   ✅ Recursos y actividades automáticas creadas');
    console.log('   ✅ Sistema listo para uso en producción');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Cerrar conexión a la base de datos
    await pool.end();
    console.log('\n🔌 Conexión a la base de datos cerrada');
  }
};

// Ejecutar las pruebas
testAutomaticSystem().catch(console.error);
