#!/usr/bin/env node
/**
 * Removes exact duplicate indicators only when no assessment or questionnaire
 * relation depends on the row. Linked historical records are reported and kept.
 */
import pool from '../config/db.js';

async function run() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [groups] = await connection.query(`
      SELECT teacher_id, subject, description, category, phase, grade, course_id, institution
      FROM indicators
      GROUP BY teacher_id, subject, description, category, phase, grade, course_id, institution
      HAVING COUNT(*) > 1
    `);

    let deleted = 0;
    let retainedForHistory = 0;
    for (const group of groups) {
      const [rows] = await connection.query(
        `SELECT id, questionnaire_id, from_template
         FROM indicators
         WHERE teacher_id = ? AND subject = ? AND description = ?
           AND category <=> ? AND phase = ? AND grade <=> ?
           AND course_id <=> ? AND institution <=> ?
         ORDER BY id FOR UPDATE`,
        [group.teacher_id, group.subject, group.description, group.category, group.phase, group.grade,
          group.course_id, group.institution]
      );

      // Keep the oldest row as the canonical indicator and examine later exact copies.
      for (const duplicate of rows.slice(1)) {
        if (Number(duplicate.from_template) !== 1) continue;
        const [references] = await connection.query(
          `SELECT
             (SELECT COUNT(*) FROM student_indicators WHERE indicator_id = ?) AS student_results,
             (SELECT COUNT(*) FROM questionnaire_indicators WHERE indicator_id = ?) AS questionnaire_links,
             (SELECT COUNT(*) FROM recovery_activities WHERE indicator_id = ?) AS recovery_links`,
          [duplicate.id, duplicate.id, duplicate.id]
        );
        const refs = references[0];
        if (duplicate.questionnaire_id != null || Number(refs.student_results) > 0
          || Number(refs.questionnaire_links) > 0 || Number(refs.recovery_links) > 0) {
          retainedForHistory += 1;
          continue;
        }
        await connection.query('DELETE FROM indicators WHERE id = ?', [duplicate.id]);
        deleted += 1;
      }
    }

    await connection.commit();
    console.log(`Indicadores duplicados sin relaciones eliminados: ${deleted}`);
    console.log(`Duplicados conservados por vínculos o historial: ${retainedForHistory}`);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al deduplicar indicadores:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

run();
