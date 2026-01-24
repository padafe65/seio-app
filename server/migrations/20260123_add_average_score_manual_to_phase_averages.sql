-- Add average_score_manual to phase_averages (nullable).
-- Definitive = average_score when NULL; else (average_score + average_score_manual) / 2.
--
-- Run manually if needed, e.g.:
--   mysql -u USER -p seio_db < server/migrations/20260123_add_average_score_manual_to_phase_averages.sql
-- or from MySQL/MariaDB client: USE seio_db; SOURCE path/to/20260123_add_average_score_manual_to_phase_averages.sql;

ALTER TABLE phase_averages
  ADD COLUMN average_score_manual DECIMAL(5,2) DEFAULT NULL
    COMMENT 'Nota manual del docente para la fase. Si no es NULL, la definitiva se promedia con average_score.'
    AFTER average_score;
