-- Datos de prueba para planes de mejoramiento basados en estudiantes reales
-- Basado en los datos de la base de datos seio_db

-- Insertar planes de mejoramiento para estudiantes con dificultades en Español
INSERT INTO improvement_plans (
  student_id, 
  teacher_id, 
  title, 
  subject, 
  description, 
  activities, 
  deadline, 
  failed_achievements, 
  passed_achievements,
  video_urls,
  resource_links,
  activity_status,
  teacher_notes,
  student_feedback,
  attempts_count,
  completed,
  email_sent
) VALUES 
-- Plan para Leon Marcos Martinez (Grado 11A) - Dificultades en Comprensión Lectora
(
  27, -- student_id de Leon Marcos Martinez
  2,  -- teacher_id del profesor Carlos Andrés Ferreira
  'Plan de Recuperación - Comprensión Lectora',
  'Español',
  'Plan de mejoramiento enfocado en desarrollar habilidades de comprensión lectora, análisis de textos y expresión escrita. El estudiante presenta dificultades en la interpretación de textos narrativos y expositivos.',
  '1. Lectura comprensiva de textos cortos\n2. Ejercicios de análisis de personajes\n3. Redacción de resúmenes\n4. Práctica de inferencias\n5. Evaluación final con texto narrativo',
  '2025-02-15 23:59:59',
  'Comprensión de textos narrativos\nAnálisis de personajes\nInferencias textuales\nExpresión escrita',
  'Identificación de ideas principales\nVocabulario básico',
  'https://youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtube.com/watch?v=jNQXAC9IVRw',
  'https://www.khanacademy.org/humanities/grammar\nhttps://www.rae.es/consultas-linguisticas',
  'pending',
  'El estudiante necesita reforzar especialmente la comprensión inferencial y la capacidad de análisis crítico de textos.',
  '',
  0,
  0,
  0
),

-- Plan para Pablo Raruda (Grado 7A) - Dificultades en Gramática
(
  28, -- student_id de Pablo Raruda
  2,  -- teacher_id del profesor Carlos Andrés Ferreira
  'Plan de Recuperación - Gramática Básica',
  'Español',
  'Plan de mejoramiento para fortalecer conocimientos básicos de gramática española, incluyendo acentuación, ortografía y estructura de oraciones.',
  '1. Ejercicios de acentuación\n2. Práctica de ortografía\n3. Identificación de sustantivos y adjetivos\n4. Construcción de oraciones simples\n5. Dictado de palabras comunes',
  '2025-02-20 23:59:59',
  'Acentuación de palabras\nOrtografía básica\nClasificación de palabras\nEstructura de oraciones',
  'Reconocimiento de letras\nLectura básica',
  'https://youtube.com/watch?v=example1\nhttps://youtube.com/watch?v=example2',
  'https://www.ortografias.com/\nhttps://www.gramaticas.net/',
  'pending',
  'Enfocar en ejercicios prácticos y repetitivos para consolidar las reglas básicas de ortografía.',
  '',
  0,
  0,
  0
),

-- Plan para Raul Meneses (Grado 7B) - Dificultades en Expresión Escrita
(
  31, -- student_id de Raul Meneses
  2,  -- teacher_id del profesor Carlos Andrés Ferreira
  'Plan de Recuperación - Expresión Escrita',
  'Español',
  'Plan de mejoramiento para desarrollar habilidades de expresión escrita, coherencia textual y uso adecuado del vocabulario.',
  '1. Ejercicios de escritura creativa\n2. Práctica de párrafos coherentes\n3. Uso de conectores\n4. Ampliación de vocabulario\n5. Redacción de textos descriptivos',
  '2025-02-25 23:59:59',
  'Coherencia textual\nUso de conectores\nVocabulario variado\nEstructura de párrafos',
  'Escritura básica\nIdentificación de ideas',
  'https://youtube.com/watch?v=writing1\nhttps://youtube.com/watch?v=writing2',
  'https://www.wordreference.com/\nhttps://www.sinonimos.com/',
  'pending',
  'El estudiante necesita trabajar especialmente en la organización de ideas y el uso de vocabulario más preciso.',
  '',
  0,
  0,
  0
),

-- Plan para Rosalva Tevez Primera (Grado 11A) - Dificultades en Literatura
(
  29, -- student_id de Rosalva Tevez Primera
  2,  -- teacher_id del profesor Carlos Andrés Ferreira
  'Plan de Recuperación - Análisis Literario',
  'Español',
  'Plan de mejoramiento para desarrollar habilidades de análisis literario, comprensión de figuras retóricas y crítica textual.',
  '1. Análisis de poemas\n2. Identificación de figuras literarias\n3. Análisis de cuentos cortos\n4. Comparación de textos\n5. Ensayo crítico',
  '2025-03-01 23:59:59',
  'Análisis de figuras retóricas\nCrítica literaria\nComparación de textos\nEnsayo argumentativo',
  'Lectura comprensiva\nIdentificación de temas',
  'https://youtube.com/watch?v=literature1\nhttps://youtube.com/watch?v=literature2',
  'https://www.cervantesvirtual.com/\nhttps://www.bibliotecasvirtuales.com/',
  'pending',
  'Enfocar en el desarrollo del pensamiento crítico y la capacidad de análisis profundo de textos literarios.',
  '',
  0,
  0,
  0
);

-- Insertar recursos de recuperación para el primer plan
INSERT INTO recovery_resources (
  improvement_plan_id,
  resource_type,
  title,
  description,
  url,
  difficulty_level,
  order_index,
  is_required
) VALUES 
-- Recursos para Leon Marcos Martinez (Plan ID 1)
(1, 'video', 'Comprensión Lectora - Conceptos Básicos', 'Video introductorio sobre técnicas de comprensión lectora', 'https://youtube.com/watch?v=reading1', 'basic', 1, 1),
(1, 'video', 'Análisis de Personajes', 'Tutorial sobre cómo analizar personajes en textos narrativos', 'https://youtube.com/watch?v=characters1', 'intermediate', 2, 1),
(1, 'document', 'Guía de Comprensión Lectora', 'Documento con ejercicios prácticos de comprensión', 'https://example.com/guia-comprension.pdf', 'basic', 3, 1),
(1, 'link', 'Ejercicios Interactivos', 'Plataforma con ejercicios de comprensión lectora', 'https://www.ejercicios-comprension.com', 'intermediate', 4, 0),

-- Recursos para Pablo Raruda (Plan ID 2)
(2, 'video', 'Acentuación en Español', 'Reglas básicas de acentuación', 'https://youtube.com/watch?v=acentuacion1', 'basic', 1, 1),
(2, 'video', 'Ortografía Básica', 'Fundamentos de la ortografía española', 'https://youtube.com/watch?v=ortografia1', 'basic', 2, 1),
(2, 'quiz', 'Ejercicios de Acentuación', 'Cuestionario interactivo sobre acentuación', 'https://www.quiz-accentuation.com', 'basic', 3, 1),

-- Recursos para Raul Meneses (Plan ID 3)
(3, 'video', 'Escritura Creativa', 'Técnicas básicas de escritura creativa', 'https://youtube.com/watch?v=writing1', 'intermediate', 1, 1),
(3, 'video', 'Coherencia Textual', 'Cómo lograr coherencia en textos escritos', 'https://youtube.com/watch?v=coherence1', 'intermediate', 2, 1),
(3, 'document', 'Manual de Conectores', 'Lista de conectores y su uso', 'https://example.com/conectores.pdf', 'basic', 3, 1),

-- Recursos para Rosalva Tevez Primera (Plan ID 4)
(4, 'video', 'Análisis Literario', 'Introducción al análisis de textos literarios', 'https://youtube.com/watch?v=literature1', 'advanced', 1, 1),
(4, 'video', 'Figuras Retóricas', 'Identificación y análisis de figuras literarias', 'https://youtube.com/watch?v=figuras1', 'advanced', 2, 1),
(4, 'link', 'Biblioteca Virtual', 'Recursos de literatura hispanoamericana', 'https://www.cervantesvirtual.com', 'advanced', 3, 0);

-- Insertar actividades de recuperación
INSERT INTO recovery_activities (
  improvement_plan_id,
  activity_type,
  title,
  description,
  instructions,
  due_date,
  max_attempts,
  passing_score,
  weight,
  status
) VALUES 
-- Actividades para Leon Marcos Martinez (Plan ID 1)
(1, 'quiz', 'Evaluación de Comprensión Lectora', 'Cuestionario sobre comprensión de textos narrativos', 'Lee el texto cuidadosamente y responde las preguntas', '2025-02-10 23:59:59', 3, 3.5, 1.0, 'pending'),
(1, 'assignment', 'Análisis de Personaje', 'Redacción de análisis de un personaje literario', 'Selecciona un personaje de una obra leída y analiza sus características', '2025-02-12 23:59:59', 2, 3.0, 1.2, 'pending'),
(1, 'presentation', 'Presentación Oral', 'Exposición sobre técnicas de comprensión lectora', 'Prepara una presentación de 5 minutos sobre las técnicas aprendidas', '2025-02-14 23:59:59', 1, 3.5, 0.8, 'pending'),

-- Actividades para Pablo Raruda (Plan ID 2)
(2, 'quiz', 'Evaluación de Acentuación', 'Cuestionario sobre reglas de acentuación', 'Aplica las reglas de acentuación en las palabras dadas', '2025-02-15 23:59:59', 3, 3.5, 1.0, 'pending'),
(2, 'exercise', 'Ejercicios de Ortografía', 'Práctica de ortografía con palabras comunes', 'Escribe correctamente las palabras que se te dictan', '2025-02-17 23:59:59', 2, 3.0, 1.0, 'pending'),

-- Actividades para Raul Meneses (Plan ID 3)
(3, 'assignment', 'Redacción Creativa', 'Composición de un texto narrativo corto', 'Escribe un cuento de 200 palabras usando conectores apropiados', '2025-02-20 23:59:59', 2, 3.5, 1.2, 'pending'),
(3, 'project', 'Portafolio de Escritura', 'Recopilación de textos escritos durante el plan', 'Organiza tus mejores escritos en un portafolio digital', '2025-02-22 23:59:59', 1, 3.0, 0.8, 'pending'),

-- Actividades para Rosalva Tevez Primera (Plan ID 4)
(4, 'assignment', 'Análisis de Poema', 'Análisis detallado de un poema seleccionado', 'Analiza el poema identificando figuras retóricas y tema central', '2025-02-25 23:59:59', 2, 3.5, 1.2, 'pending'),
(4, 'essay', 'Ensayo Crítico', 'Redacción de ensayo sobre una obra literaria', 'Escribe un ensayo de 500 palabras analizando una obra literaria', '2025-02-28 23:59:59', 1, 3.5, 1.5, 'pending');
