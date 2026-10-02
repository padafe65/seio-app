/**
 * Plantillas por asignatura (Micro-SaaS).
 * Cada asignatura tiene indicadores sugeridos (description, category, phase).
 * Al "aplicar plantilla" se crean indicadores para el docente.
 */

export const SUBJECT_TEMPLATES = {
  Matemáticas: [
    { description: 'El estudiante representa situaciones de su entorno con números, operaciones, tablas, expresiones o gráficas, y explica por qué el procedimiento elegido permite resolverlas.', category: 'Razonamiento', phase: 1 },
    { description: 'El estudiante selecciona y ejecuta operaciones con números naturales, enteros, racionales o reales, respeta la jerarquía de operaciones y comprueba si el resultado es razonable.', category: 'Cálculo', phase: 1 },
    { description: 'El estudiante identifica propiedades de figuras y cuerpos geométricos, calcula longitudes, perímetros, áreas o volúmenes y comunica las unidades utilizadas.', category: 'Geometría', phase: 1 },
    { description: 'El estudiante organiza datos, calcula e interpreta medidas estadísticas y utiliza principios de probabilidad para justificar conclusiones sobre una situación.', category: 'Estadística', phase: 2 },
    { description: 'El estudiante expresa relaciones mediante lenguaje algebraico, simplifica expresiones y transforma ecuaciones conservando la igualdad para determinar valores desconocidos.', category: 'Álgebra', phase: 2 },
    { description: 'El estudiante construye e interpreta tablas y gráficas de funciones, identifica variables, dominio, recorrido y cambios, y explica la relación representada.', category: 'Funciones', phase: 3 },
    { description: 'El estudiante relaciona ángulos y lados en figuras y situaciones periódicas, aplica razones e identidades trigonométricas pertinentes y verifica sus resultados.', category: 'Trigonometría', phase: 3 },
    { description: 'El estudiante formula un modelo matemático para una situación real, declara sus supuestos, resuelve el modelo e interpreta sus límites y resultados en contexto.', category: 'Modelación', phase: 4 }
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
  ],
  'Cálculo Diferencial 1': [
    { description: 'El estudiante determina dominio, recorrido y comportamiento de funciones elementales, y selecciona representaciones algebraicas, tabulares o gráficas para describirlas.', category: 'Funciones', phase: 1 },
    { description: 'El estudiante estima límites mediante tablas y gráficas, aplica propiedades algebraicas de límites y justifica cuándo una indeterminación requiere transformación.', category: 'Límites', phase: 1 },
    { description: 'El estudiante verifica continuidad en un punto e intervalo y relaciona discontinuidades con las condiciones de existencia del límite y el valor de la función.', category: 'Continuidad', phase: 2 },
    { description: 'El estudiante interpreta la derivada como razón de cambio instantánea y pendiente de la recta tangente, conectando su definición con situaciones de variación.', category: 'Derivada', phase: 2 },
    { description: 'El estudiante calcula derivadas de funciones algebraicas, trigonométricas, exponenciales y logarítmicas aplicando reglas de derivación y regla de la cadena.', category: 'Reglas de derivación', phase: 3 },
    { description: 'El estudiante utiliza la derivada para analizar crecimiento, extremos, concavidad y puntos de inflexión, y construye un bosquejo coherente de la gráfica.', category: 'Análisis de funciones', phase: 3 },
    { description: 'El estudiante plantea y resuelve problemas de optimización o tasas relacionadas, define las variables, interpreta la solución y verifica que responda a las restricciones.', category: 'Aplicaciones', phase: 4 }
  ],
  Seguros: [
    { description: 'El estudiante identifica exposición, amenaza, probabilidad e impacto para describir un riesgo asegurable y distinguirlo de una pérdida ya ocurrida.', category: 'Gestión del riesgo', phase: 1 },
    { description: 'El estudiante interpreta coberturas, exclusiones, límites, deducibles y obligaciones de una póliza para decidir si un caso está amparado.', category: 'Pólizas', phase: 1 },
    { description: 'El estudiante calcula primas, deducibles e indemnizaciones en escenarios sencillos y explica cómo cambian al modificar cobertura, frecuencia o severidad.', category: 'Cálculo de seguros', phase: 2 },
    { description: 'El estudiante utiliza datos y conceptos de probabilidad para comparar frecuencia y severidad de siniestros, reconocer incertidumbre y sustentar una estimación.', category: 'Probabilidad', phase: 3 },
    { description: 'El estudiante compara alternativas de aseguramiento considerando costo, cobertura, exclusiones y perfil de riesgo, y argumenta una recomendación adecuada al caso.', category: 'Análisis de alternativas', phase: 4 }
  ]
};

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .replace(/\s+/g, ' ')
  .trim();

const SUBJECT_ALIASES = {
  'matematicas 2': 'Matemáticas',
  'calculo': 'Cálculo Diferencial 1',
  'calculo diferencial': 'Cálculo Diferencial 1',
  'seguros basico': 'Seguros'
};

const GRADE_SIX_MATH = [
  { description: 'El estudiante aplica las propiedades conmutativa, asociativa y distributiva de la adición y la multiplicación, y resuelve expresiones con sumas, restas, productos, divisiones exactas y potencias respetando los signos de agrupación y la jerarquía de operaciones.', category: 'Operaciones y propiedades', phase: 1 },
  { description: 'El estudiante compara, ordena y representa números naturales, fracciones y decimales en la recta numérica, justificando el valor posicional y la equivalencia entre representaciones.', category: 'Sistemas numéricos', phase: 1 },
  { description: 'El estudiante resuelve problemas de varias etapas con números naturales, fracciones y decimales, estima el resultado y comprueba la operación inversa o una estrategia alternativa.', category: 'Resolución de problemas', phase: 1 },
  { description: 'El estudiante determina múltiplos, divisores, números primos y compuestos, y utiliza criterios de divisibilidad y descomposición en factores para hallar MCD o m.c.m. en situaciones concretas.', category: 'Divisibilidad', phase: 2 },
  { description: 'El estudiante representa y simplifica expresiones aritméticas con letras como variables, identifica términos semejantes y usa la propiedad distributiva para expandir o factorizar casos sencillos.', category: 'Pensamiento algebraico', phase: 2 },
  { description: 'El estudiante calcula perímetros y áreas de triángulos y cuadriláteros a partir de medidas conocidas, selecciona la fórmula adecuada y expresa el resultado con unidades cuadradas.', category: 'Geometría y medición', phase: 2 },
  { description: 'El estudiante organiza datos en tablas y gráficos, calcula e interpreta media, mediana y moda, y formula conclusiones que se apoyan en la información presentada.', category: 'Estadística', phase: 3 },
  { description: 'El estudiante identifica resultados posibles de un experimento aleatorio, compara su probabilidad y la expresa como fracción, decimal o porcentaje en contextos cotidianos.', category: 'Probabilidad', phase: 4 }
];

export function getTemplateSubjects() {
  return Object.keys(SUBJECT_TEMPLATES).sort();
}

export function getTemplateIndicators(subject, grade = null) {
  const normalized = normalize(subject);
  const alias = SUBJECT_ALIASES[normalized];
  const key = alias || Object.keys(SUBJECT_TEMPLATES).find((item) => normalize(item) === normalized);
  if (!key) return [];
  if (normalize(key) === 'matematicas' && Number(grade) === 6) return GRADE_SIX_MATH;
  return SUBJECT_TEMPLATES[key] || [];
}
