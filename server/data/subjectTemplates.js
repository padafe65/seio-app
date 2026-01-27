/**
 * Plantillas por asignatura (Micro-SaaS).
 * Cada asignatura tiene indicadores sugeridos (description, category, phase).
 * Al "aplicar plantilla" se crean indicadores para el docente.
 */

export const SUBJECT_TEMPLATES = {
  Matemáticas: [
    { description: 'Razonamiento y resolución de problemas', category: 'Razonamiento', phase: 1 },
    { description: 'Cálculo y operaciones básicas', category: 'Cálculo', phase: 1 },
    { description: 'Geometría y medición', category: 'Geometría', phase: 1 },
    { description: 'Estadística y probabilidad', category: 'Estadística', phase: 2 },
    { description: 'Álgebra y expresiones', category: 'Álgebra', phase: 2 },
    { description: 'Funciones y gráficas', category: 'Cálculo', phase: 3 },
    { description: 'Trigonometría básica', category: 'Trigonometría', phase: 3 },
    { description: 'Aplicaciones y modelación', category: 'Razonamiento', phase: 4 }
  ],
  Inglés: [
    { description: 'Comprensión de lectura (Reading)', category: 'Reading', phase: 1 },
    { description: 'Comprensión auditiva (Listening)', category: 'Listening', phase: 1 },
    { description: 'Expresión escrita (Writing)', category: 'Writing', phase: 2 },
    { description: 'Expresión oral (Speaking)', category: 'Speaking', phase: 2 },
    { description: 'Gramática y vocabulario', category: 'Grammar', phase: 3 },
    { description: 'Uso del idioma en contexto', category: 'Use of English', phase: 4 }
  ],
  Español: [
    { description: 'Comprensión lectora', category: 'Comprensión', phase: 1 },
    { description: 'Producción de textos', category: 'Producción', phase: 1 },
    { description: 'Gramática y ortografía', category: 'Gramática', phase: 2 },
    { description: 'Análisis literario', category: 'Literatura', phase: 2 },
    { description: 'Expresión oral y argumentación', category: 'Comunicación', phase: 3 },
    { description: 'Comprensión de medios y discursos', category: 'Medios', phase: 4 }
  ],
  'Física 1': [
    { description: 'Cinemática: movimiento rectilíneo', category: 'Cinemática', phase: 1 },
    { description: 'Dinámica: leyes de Newton', category: 'Dinámica', phase: 1 },
    { description: 'Trabajo y energía', category: 'Energía', phase: 2 },
    { description: 'Ondas y sonido', category: 'Ondas', phase: 3 },
    { description: 'Electricidad básica', category: 'Electricidad', phase: 4 }
  ],
  Química: [
    { description: 'Estructura atómica y tabla periódica', category: 'Estructura', phase: 1 },
    { description: 'Enlaces químicos', category: 'Enlaces', phase: 1 },
    { description: 'Reacciones y estequiometría', category: 'Reacciones', phase: 2 },
    { description: 'Disoluciones y concentración', category: 'Disoluciones', phase: 3 },
    { description: 'Ácidos y bases', category: 'Equilibrio', phase: 4 }
  ]
};

export function getTemplateSubjects() {
  return Object.keys(SUBJECT_TEMPLATES).sort();
}

export function getTemplateIndicators(subject) {
  return SUBJECT_TEMPLATES[subject] || [];
}
