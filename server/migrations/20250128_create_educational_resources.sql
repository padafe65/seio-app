-- Migración para crear tablas de recursos educativos
-- Fecha: 2025-01-28
-- Descripción: Sistema de recursos educativos para apoyo al aprendizaje

-- Tabla principal de recursos educativos
CREATE TABLE IF NOT EXISTS educational_resources (
  id INT PRIMARY KEY AUTO_INCREMENT,
  subject VARCHAR(100) NOT NULL COMMENT 'Materia: Matemáticas, Español, Ciencias, etc.',
  area VARCHAR(100) NOT NULL COMMENT 'Área: Aritmética, Geometría, Gramática, etc.',
  topic VARCHAR(200) COMMENT 'Tema específico: Sistemas Numéricos, Interpretación de Textos, etc.',
  title VARCHAR(255) NOT NULL COMMENT 'Título del recurso',
  description TEXT COMMENT 'Descripción detallada del recurso',
  url VARCHAR(500) NOT NULL COMMENT 'URL del recurso educativo',
  resource_type ENUM('video', 'articulo', 'ejercicio', 'simulador', 'guia', 'otro') DEFAULT 'otro' COMMENT 'Tipo de recurso',
  grade_level VARCHAR(50) COMMENT 'Niveles de grado: "6-9", "10-11", "Todos", etc.',
  phase INT COMMENT 'Fase específica (1-4) o NULL para todas las fases',
  difficulty ENUM('basico', 'intermedio', 'avanzado') DEFAULT 'intermedio' COMMENT 'Nivel de dificultad',
  language VARCHAR(10) DEFAULT 'es' COMMENT 'Idioma del recurso',
  institution_id INT COMMENT 'ID de institución específica o NULL para todas',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Indica si el recurso está activo',
  views_count INT DEFAULT 0 COMMENT 'Contador de visualizaciones',
  rating DECIMAL(3,2) COMMENT 'Calificación promedio (1-5)',
  created_by INT COMMENT 'ID del usuario que creó el recurso',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_subject_area (subject, area),
  INDEX idx_grade_phase (grade_level, phase),
  INDEX idx_subject_grade (subject, grade_level),
  INDEX idx_institution_active (institution_id, is_active),
  INDEX idx_resource_type (resource_type),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para rastrear el uso de recursos por estudiantes
CREATE TABLE IF NOT EXISTS student_resource_usage (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL COMMENT 'ID del estudiante',
  resource_id INT NOT NULL COMMENT 'ID del recurso educativo',
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de visualización',
  time_spent_minutes INT DEFAULT 0 COMMENT 'Tiempo dedicado en minutos',
  rating INT COMMENT 'Calificación del estudiante (1-5 estrellas)',
  notes TEXT COMMENT 'Notas del estudiante sobre el recurso',
  is_bookmarked BOOLEAN DEFAULT FALSE COMMENT 'Indica si el recurso está marcado como favorito',
  completion_status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (resource_id) REFERENCES educational_resources(id) ON DELETE CASCADE,
  INDEX idx_student_resource (student_id, resource_id),
  INDEX idx_viewed_at (viewed_at),
  INDEX idx_bookmarked (student_id, is_bookmarked),
  UNIQUE KEY unique_student_resource (student_id, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar algunos recursos de ejemplo
INSERT INTO educational_resources (subject, area, topic, title, description, url, resource_type, grade_level, phase, difficulty, created_by) VALUES
-- Matemáticas - Aritmética
('Matemáticas', 'Aritmética', 'Sistemas Numéricos', 'Introducción a los Números Naturales', 'Recurso educativo sobre el sistema de números naturales, sus propiedades y operaciones básicas.', 'https://www.khanacademy.org/math/arithmetic', 'video', '6-9', 1, 'basico', NULL),
('Matemáticas', 'Aritmética', 'Operaciones Básicas', 'Suma, Resta, Multiplicación y División', 'Guía completa sobre las cuatro operaciones fundamentales de la aritmética.', 'https://www.khanacademy.org/math/arithmetic/arith-review-add-subtract', 'guia', '6-9', 1, 'basico', NULL),
('Matemáticas', 'Aritmética', 'Fracciones', 'Fracciones y Decimales', 'Aprende a trabajar con fracciones, conversión a decimales y operaciones.', 'https://www.khanacademy.org/math/arithmetic/fraction-arithmetic', 'video', '6-9', 2, 'intermedio', NULL),

-- Matemáticas - Geometría
('Matemáticas', 'Geometría', 'Figuras Planas', 'Triángulos, Cuadriláteros y Círculos', 'Conceptos básicos sobre figuras planas, perímetros y áreas.', 'https://www.khanacademy.org/math/geometry', 'video', '6-9', 2, 'basico', NULL),
('Matemáticas', 'Geometría', 'Áreas y Perímetros', 'Cálculo de Áreas y Perímetros', 'Fórmulas y ejercicios prácticos para calcular áreas y perímetros de diferentes figuras.', 'https://www.khanacademy.org/math/geometry/basic-geometry', 'ejercicio', '6-9', 2, 'intermedio', NULL),
('Matemáticas', 'Geometría', 'Sólidos Geométricos', 'Cubos, Esferas y Cilindros', 'Introducción a los sólidos geométricos, volumen y área superficial.', 'https://www.khanacademy.org/math/geometry/hs-geo-solids', 'video', '10-11', 3, 'intermedio', NULL),

-- Matemáticas - Estadística
('Matemáticas', 'Estadística', 'Tablas y Gráficos', 'Representación de Datos', 'Cómo crear y leer tablas de frecuencia, gráficos de barras y circulares.', 'https://www.khanacademy.org/math/statistics-probability', 'video', '6-9', 3, 'basico', NULL),
('Matemáticas', 'Estadística', 'Medidas de Tendencia Central', 'Media, Mediana y Moda', 'Aprende a calcular e interpretar las medidas de tendencia central.', 'https://www.khanacademy.org/math/statistics-probability/summarizing-quantitative-data', 'articulo', '10-11', 3, 'intermedio', NULL),

-- Matemáticas - Trigonometría
('Matemáticas', 'Trigonometría', 'Razones Trigonométricas', 'Seno, Coseno y Tangente', 'Fundamentos de las razones trigonométricas en triángulos rectángulos.', 'https://www.khanacademy.org/math/trigonometry', 'video', '10-11', 4, 'intermedio', NULL),
('Matemáticas', 'Trigonometría', 'Identidades Trigonométricas', 'Identidades Fundamentales', 'Aprende las identidades trigonométricas más importantes y cómo usarlas.', 'https://www.khanacademy.org/math/trigonometry/trig-equations-and-identities', 'guia', '10-11', 4, 'avanzado', NULL),

-- Matemáticas - Cálculo
('Matemáticas', 'Cálculo', 'Límites', 'Introducción a los Límites', 'Concepto de límite, propiedades y cálculo básico de límites.', 'https://www.khanacademy.org/math/ap-calculus-ab', 'video', '10-11', 4, 'avanzado', NULL),
('Matemáticas', 'Cálculo', 'Derivadas', 'Derivación de Funciones', 'Aprende a calcular derivadas y aplicar las reglas de derivación.', 'https://www.khanacademy.org/math/ap-calculus-ab/ab-differentiation-1-new', 'video', '10-11', 4, 'avanzado', NULL),
('Matemáticas', 'Cálculo', 'Integrales', 'Integración de Funciones', 'Conceptos básicos de integración y métodos de integración.', 'https://www.khanacademy.org/math/ap-calculus-ab/ab-integration-new', 'video', '10-11', 4, 'avanzado', NULL),

-- Español - Gramática
('Español', 'Gramática', 'Reglas Ortográficas', 'Ortografía Básica', 'Reglas fundamentales de ortografía: acentuación, mayúsculas, puntuación.', 'https://www.rae.es/diccionario-panhispanico-de-dudas', 'guia', '6-9', 1, 'basico', NULL),
('Español', 'Gramática', 'Sintaxis', 'Estructura de las Oraciones', 'Análisis sintáctico: sujeto, predicado, complementos.', 'https://www.rae.es/gramatica', 'articulo', '6-9', 2, 'intermedio', NULL),
('Español', 'Gramática', 'Morfología', 'Clasificación de Palabras', 'Sustantivos, verbos, adjetivos, adverbios y su función en la oración.', 'https://www.rae.es/gramatica/morfologia', 'guia', '6-9', 2, 'basico', NULL),

-- Español - Interpretación de Textos
('Español', 'Interpretación de Textos', 'Comprensión Lectora', 'Técnicas de Lectura', 'Estrategias para mejorar la comprensión lectora y análisis de textos.', 'https://www.educacionyfp.gob.es', 'guia', '6-9', 3, 'intermedio', NULL),
('Español', 'Interpretación de Textos', 'Análisis Literario', 'Elementos del Texto Narrativo', 'Personajes, trama, ambiente, tema y otros elementos literarios.', 'https://www.rae.es/academia/recursos', 'articulo', '10-11', 3, 'intermedio', NULL),
('Español', 'Interpretación de Textos', 'Textos Argumentativos', 'Análisis de Argumentos', 'Cómo identificar tesis, argumentos y contraargumentos en textos.', 'https://www.rae.es/academia', 'ejercicio', '10-11', 4, 'avanzado', NULL);

-- Mensaje de confirmación
SELECT 'Tablas educational_resources y student_resource_usage creadas exitosamente' AS mensaje;
