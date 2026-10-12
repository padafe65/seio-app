#!/usr/bin/env node
/** Recalculate questionnaire outcomes and automatic plans by academic year in seio_db_pruebas only. */
import pool from '../config/db.js';
import { evaluateStudentIndicators } from '../utils/evaluateIndicators.js';
import { processStudentImprovementPlan } from '../utils/autoImprovementPlans.js';

async function run() {
  try {
    const [databaseRows] = await pool.query('SELECT DATABASE() AS database_name');
    if (databaseRows[0]?.database_name !== 'seio_db_pruebas') {
      throw new Error(`Safety stop: connected database is "${databaseRows[0]?.database_name || 'unknown'}". Expected "seio_db_pruebas".`);
    }

    const [evaluations] = await pool.query(`
      SELECT DISTINCT er.student_id, er.questionnaire_id,
             COALESCE(er.academic_year, YEAR(er.recorded_at)) AS academic_year
      FROM evaluation_results er
      JOIN questionnaire_indicators qi ON qi.questionnaire_id = er.questionnaire_id
      WHERE COALESCE(er.academic_year, YEAR(er.recorded_at)) IS NOT NULL
      ORDER BY academic_year, er.questionnaire_id, er.student_id
    `);

    let reconciled = 0;
    let plansCreatedOrUpdated = 0;
    for (const evaluation of evaluations) {
      const year = Number(evaluation.academic_year);
      const outcome = await evaluateStudentIndicators(evaluation.student_id, evaluation.questionnaire_id, year);
      if (!outcome.success) continue;
      const planResult = await processStudentImprovementPlan(evaluation.student_id, evaluation.questionnaire_id, year);
      reconciled += 1;
      if (planResult.improvement_plan || planResult.resolved) plansCreatedOrUpdated += 1;
    }

    console.log(`Reconciled ${reconciled} student-questionnaire-year results across ${new Set(evaluations.map(row => row.academic_year)).size} academic year(s).`);
    console.log(`Created, updated, or resolved ${plansCreatedOrUpdated} questionnaire plans.`);
  } catch (error) {
    console.error('Indicator reconciliation failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
