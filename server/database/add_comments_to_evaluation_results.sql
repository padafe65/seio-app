-- Agregar la columna comments a la tabla evaluation_results
ALTER TABLE evaluation_results 
ADD COLUMN comments TEXT 
COMMENT 'Comentarios u observaciones adicionales sobre el resultado de la evaluación' 
AFTER status;
