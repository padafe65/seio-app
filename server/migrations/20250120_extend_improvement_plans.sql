-- Migración para extender la tabla improvement_plans con campos de recuperación
-- Fecha: 2025-01-20
-- Descripción: Agregar campos para gestión de recursos multimedia y seguimiento de actividades

-- Extender la tabla improvement_plans existente
ALTER TABLE `improvement_plans` 
ADD COLUMN `video_urls` TEXT DEFAULT NULL COMMENT 'URLs de videos separadas por comas (YouTube, Vimeo, etc.)',
ADD COLUMN `resource_links` TEXT DEFAULT NULL COMMENT 'Enlaces a recursos externos separados por comas',
ADD COLUMN `activity_status` ENUM('pending', 'in_progress', 'completed', 'failed') DEFAULT 'pending' COMMENT 'Estado del plan de recuperación',
ADD COLUMN `completion_date` DATETIME DEFAULT NULL COMMENT 'Fecha de finalización del plan',
ADD COLUMN `teacher_notes` TEXT DEFAULT NULL COMMENT 'Notas adicionales del profesor',
ADD COLUMN `student_feedback` TEXT DEFAULT NULL COMMENT 'Comentarios del estudiante sobre el plan',
ADD COLUMN `attempts_count` INT DEFAULT 0 COMMENT 'Número de intentos del estudiante',
ADD COLUMN `last_activity_date` DATETIME DEFAULT NULL COMMENT 'Última fecha de actividad del estudiante';

-- Crear tabla para recursos de recuperación detallados
CREATE TABLE `recovery_resources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `improvement_plan_id` int(11) NOT NULL,
  `resource_type` enum('video', 'document', 'link', 'quiz', 'exercise', 'presentation') NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `url` text NOT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `duration_minutes` int(11) DEFAULT NULL COMMENT 'Duración en minutos para videos',
  `difficulty_level` enum('basic', 'intermediate', 'advanced') DEFAULT 'basic',
  `order_index` int(11) DEFAULT 0,
  `is_required` tinyint(1) DEFAULT 1,
  `viewed` tinyint(1) DEFAULT 0,
  `viewed_at` datetime DEFAULT NULL,
  `completion_percentage` decimal(5,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_improvement_plan` (`improvement_plan_id`),
  KEY `idx_resource_type` (`resource_type`),
  KEY `idx_order` (`order_index`),
  CONSTRAINT `fk_recovery_resources_improvement_plan` 
    FOREIGN KEY (`improvement_plan_id`) REFERENCES `improvement_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Crear tabla para actividades de recuperación específicas
CREATE TABLE `recovery_activities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `improvement_plan_id` int(11) NOT NULL,
  `indicator_id` int(11) DEFAULT NULL,
  `questionnaire_id` int(11) DEFAULT NULL,
  `activity_type` enum('quiz', 'assignment', 'presentation', 'project', 'exercise', 'discussion') NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `instructions` text DEFAULT NULL,
  `due_date` datetime NOT NULL,
  `max_attempts` int(11) DEFAULT 3,
  `passing_score` decimal(5,2) DEFAULT 3.5,
  `weight` decimal(3,2) DEFAULT 1.00 COMMENT 'Peso de la actividad en el plan',
  `status` enum('pending', 'in_progress', 'completed', 'failed', 'overdue') DEFAULT 'pending',
  `student_score` decimal(5,2) DEFAULT NULL,
  `attempts_count` int(11) DEFAULT 0,
  `completed_at` datetime DEFAULT NULL,
  `teacher_feedback` text DEFAULT NULL,
  `student_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_improvement_plan` (`improvement_plan_id`),
  KEY `idx_indicator` (`indicator_id`),
  KEY `idx_questionnaire` (`questionnaire_id`),
  KEY `idx_status` (`status`),
  KEY `idx_due_date` (`due_date`),
  CONSTRAINT `fk_recovery_activities_improvement_plan` 
    FOREIGN KEY (`improvement_plan_id`) REFERENCES `improvement_plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recovery_activities_indicator` 
    FOREIGN KEY (`indicator_id`) REFERENCES `indicators` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_recovery_activities_questionnaire` 
    FOREIGN KEY (`questionnaire_id`) REFERENCES `questionnaires` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Crear tabla para seguimiento de progreso del estudiante
CREATE TABLE `recovery_progress` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `improvement_plan_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `resource_id` int(11) DEFAULT NULL,
  `activity_id` int(11) DEFAULT NULL,
  `progress_type` enum('resource_viewed', 'activity_completed', 'quiz_attempted', 'feedback_given') NOT NULL,
  `progress_data` json DEFAULT NULL COMMENT 'Datos específicos del progreso',
  `score` decimal(5,2) DEFAULT NULL,
  `time_spent_minutes` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_improvement_plan` (`improvement_plan_id`),
  KEY `idx_student` (`student_id`),
  KEY `idx_resource` (`resource_id`),
  KEY `idx_activity` (`activity_id`),
  KEY `idx_progress_type` (`progress_type`),
  CONSTRAINT `fk_recovery_progress_improvement_plan` 
    FOREIGN KEY (`improvement_plan_id`) REFERENCES `improvement_plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recovery_progress_student` 
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recovery_progress_resource` 
    FOREIGN KEY (`resource_id`) REFERENCES `recovery_resources` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recovery_progress_activity` 
    FOREIGN KEY (`activity_id`) REFERENCES `recovery_activities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Crear índices adicionales para optimizar consultas
CREATE INDEX `idx_improvement_plans_status` ON `improvement_plans` (`activity_status`);
CREATE INDEX `idx_improvement_plans_completion` ON `improvement_plans` (`completion_date`);
CREATE INDEX `idx_recovery_resources_viewed` ON `recovery_resources` (`viewed`);
CREATE INDEX `idx_recovery_activities_due_status` ON `recovery_activities` (`due_date`, `status`);

-- Insertar datos de ejemplo para testing (opcional)
-- INSERT INTO recovery_resources (improvement_plan_id, resource_type, title, description, url, order_index) 
-- VALUES (1, 'video', 'Video de Repaso - Matemáticas Básicas', 'Conceptos fundamentales de álgebra', 'https://youtube.com/watch?v=example', 1);

-- Comentarios sobre la implementación:
-- 1. La tabla improvement_plans se extiende manteniendo compatibilidad
-- 2. recovery_resources permite gestión detallada de recursos multimedia
-- 3. recovery_activities permite seguimiento específico de actividades
-- 4. recovery_progress permite análisis detallado del progreso del estudiante
-- 5. Todos los índices están optimizados para consultas frecuentes
