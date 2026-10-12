-- SEIO-authored indicator template catalog with source provenance.
-- Apply only to seio_db_pruebas until the schema and seeded content are reviewed.

CREATE TABLE IF NOT EXISTS indicator_template_packages (
  id INT NOT NULL AUTO_INCREMENT,
  package_key VARCHAR(160) NOT NULL,
  title VARCHAR(180) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  education_level VARCHAR(40) NOT NULL COMMENT 'school, technical_professional, technological, professional, or general',
  assessment_framework VARCHAR(40) NOT NULL DEFAULT 'none' COMMENT 'MEN_DBA, MEN_STANDARDS, ICFES_SABER_11, ICFES_SABER_TYT, ICFES_SABER_PRO, or none',
  grade_label VARCHAR(40) NOT NULL DEFAULT 'general' COMMENT 'Specific grade/semester label. General is not shown for a specific grade',
  program_area VARCHAR(120) DEFAULT NULL,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT 'draft, published, archived',
  authorship_label VARCHAR(180) NOT NULL DEFAULT 'Propuesta SEIO',
  editorial_note TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_indicator_template_package (package_key, version),
  KEY idx_indicator_template_lookup (subject, education_level, assessment_framework, grade_label, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS indicator_template_items (
  id INT NOT NULL AUTO_INCREMENT,
  package_id INT NOT NULL,
  description TEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  category VARCHAR(100) DEFAULT NULL,
  phase INT NOT NULL,
  competency VARCHAR(180) DEFAULT NULL,
  authoring_note TEXT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'published' COMMENT 'draft, published, archived',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_template_items_package (package_id, status),
  UNIQUE KEY uq_template_item_content (package_id, content_hash),
  CONSTRAINT fk_template_items_package FOREIGN KEY (package_id)
    REFERENCES indicator_template_packages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS indicator_template_sources (
  id INT NOT NULL AUTO_INCREMENT,
  source_key VARCHAR(120) NOT NULL,
  organization VARCHAR(180) NOT NULL,
  title VARCHAR(255) NOT NULL,
  url VARCHAR(1000) DEFAULT NULL,
  document_version VARCHAR(120) DEFAULT NULL,
  published_on DATE DEFAULT NULL,
  checked_on DATE DEFAULT NULL,
  license_name VARCHAR(180) DEFAULT NULL,
  license_url VARCHAR(1000) DEFAULT NULL,
  reuse_status VARCHAR(32) NOT NULL DEFAULT 'review_required' COMMENT 'reference_only, concepts_only, permission_required, open_license_verified, internal',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_indicator_template_source_key (source_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS indicator_template_item_sources (
  template_item_id INT NOT NULL,
  source_id INT NOT NULL,
  relationship_type VARCHAR(32) NOT NULL DEFAULT 'conceptual_alignment' COMMENT 'internal_authorship, conceptual_alignment, authorized_adaptation, or quotation',
  locator VARCHAR(255) DEFAULT NULL COMMENT 'Page, section, module, or learning outcome reference',
  PRIMARY KEY (template_item_id, source_id),
  CONSTRAINT fk_template_item_sources_item FOREIGN KEY (template_item_id)
    REFERENCES indicator_template_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_template_item_sources_source FOREIGN KEY (source_id)
    REFERENCES indicator_template_sources (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teacher_indicator_template_copies (
  indicator_id INT NOT NULL,
  template_item_id INT NOT NULL,
  package_id INT NOT NULL,
  package_version INT NOT NULL,
  applied_by_user_id INT DEFAULT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (indicator_id),
  KEY idx_teacher_template_copy_package (package_id, package_version),
  CONSTRAINT fk_teacher_template_copy_indicator FOREIGN KEY (indicator_id)
    REFERENCES indicators (id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_template_copy_item FOREIGN KEY (template_item_id)
    REFERENCES indicator_template_items (id) ON DELETE RESTRICT,
  CONSTRAINT fk_teacher_template_copy_package FOREIGN KEY (package_id)
    REFERENCES indicator_template_packages (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questionnaire_indicator_reminders (
  questionnaire_id INT NOT NULL,
  teacher_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dismissed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (questionnaire_id),
  KEY idx_questionnaire_indicator_reminder_teacher (teacher_id, dismissed_at),
  CONSTRAINT fk_questionnaire_indicator_reminder_questionnaire
    FOREIGN KEY (questionnaire_id) REFERENCES questionnaires (id) ON DELETE CASCADE,
  CONSTRAINT fk_questionnaire_indicator_reminder_teacher
    FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO indicator_template_sources
  (source_key, organization, title, url, document_version, reuse_status, notes)
VALUES
  ('men-dba-matematicas', 'Ministerio de Educación Nacional / Colombia Aprende', 'Derechos Básicos de Aprendizaje de Matemáticas', 'https://colombiaaprende.edu.co/recurso-coleccion/derechos-basicos-de-aprendizaje-matematicas', 'Consulta web. Verificar versión del anexo antes de cada publicación', 'concepts_only', 'Referencia conceptual para redactar propuestas SEIO originales. No almacenar ni reproducir el texto oficial.'),
  ('men-estandares-basicos', 'Ministerio de Educación Nacional', 'Estándares Básicos de Competencias', 'https://www.mineducacion.gov.co/portal/340021:Estandares-Basicos-de-competencia', 'Consulta web. Verificar documento y condiciones vigentes', 'concepts_only', 'Referencia conceptual. Cada paquete debe documentar área, grupo de grados y sección revisada.'),
  ('icfes-saber-11', 'ICFES', 'Marcos de referencia del examen Saber 11', 'https://www.icfes.gov.co/evaluaciones-icfes/saber-11/marcos-de-referencia-examen-saber-11/', 'Actualizar según la publicación del ICFES', 'reference_only', 'Usar para orientar competencias evaluadas. No copiar preguntas ni materiales de práctica.'),
  ('icfes-saber-tyt', 'ICFES', 'Examen Saber TyT', 'https://www.icfes.gov.co/evaluaciones-icfes/examen-saber-tyt/', 'Actualizar según la publicación del ICFES', 'reference_only', 'Los módulos y su oferta pueden variar. Documentar el ciclo consultado.'),
  ('icfes-saber-pro', 'ICFES', 'Examen Saber Pro', 'https://www.icfes.gov.co/evaluaciones-icfes/acerca-del-examen-saber-pro/', 'Actualizar según la publicación del ICFES', 'reference_only', 'Los módulos específicos dependen del programa y de la oferta vigente.'),
  ('seio-legacy-templates', 'SEIO', 'Paquetes internos preexistentes', NULL, 'Migración de catálogo legado', 'internal', 'Contenido que ya existía en el proyecto. Conservar como propuesta interna pendiente de revisión editorial y de fuentes.')
ON DUPLICATE KEY UPDATE
  organization = VALUES(organization), title = VALUES(title), url = VALUES(url),
  document_version = VALUES(document_version), reuse_status = VALUES(reuse_status),
  notes = VALUES(notes);
