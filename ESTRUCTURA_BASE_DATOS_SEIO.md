# Estructura de Base de Datos SEIO - Análisis y Mejoras

## Resumen de Relaciones Clave

Basándome en el análisis del script de la base de datos `seio_db`, he identificado las siguientes relaciones críticas:

### 1. Relaciones Principales

```
users (id) 
├── teachers (user_id) → teachers.id
├── students (user_id) → students.id
└── user_roles (user_id)

teachers (id) 
├── questionnaires (created_by) → questionnaires.id
├── indicators (teacher_id) → indicators.id
├── teacher_courses (teacher_id)
└── teacher_students (teacher_id)

questionnaires (id)
├── questions (questionnaire_id) → questions.id
├── questionnaire_indicators (questionnaire_id)
└── quiz_attempts (questionnaire_id)

students (id)
├── student_indicators (student_id)
├── quiz_attempts (student_id)
└── evaluation_results (student_id)
```

### 2. Flujo de Consultas Típico

1. **Usuario autenticado** → Obtener `user_id`
2. **user_id** → Buscar en `teachers` para obtener `teacher_id`
3. **teacher_id** → Consultar `questionnaires` donde `created_by = teacher_id`
4. **questionnaire_id** → Consultar `questions` donde `questionnaire_id = id`

## Problemas Identificados y Solucionados

### Problema 1: Filtrado Inadecuado de Cuestionarios
**Descripción**: El componente `EditarPreguntas.js` cargaba todos los cuestionarios sin filtrar por el docente autenticado.

**Solución Implementada**:
- Modificado el `useEffect` para obtener el `user_id` del localStorage
- Agregado filtro `created_by=${userId}` en la consulta a `/api/questionnaires`
- Agregada validación de autenticación antes de cargar cuestionarios

### Problema 2: Falta de Validación de Seguridad
**Descripción**: No había validación para asegurar que un docente solo pudiera editar preguntas de sus propios cuestionarios.

**Solución Implementada**:
- Agregada validación en el frontend antes de enviar la actualización
- Implementada validación en el backend en la ruta `PUT /api/questions/:id`
- Verificación de que el cuestionario original pertenece al docente autenticado
- Verificación de que el nuevo cuestionario (si se cambia) también pertenece al docente

### Problema 3: Inconsistencia en el Manejo de questionnaire_id
**Descripción**: La actualización de preguntas no manejaba correctamente el cambio de cuestionario.

**Solución Implementada**:
- Agregado manejo del campo `questionnaire_id` en la actualización
- Validación de permisos para el nuevo cuestionario si se cambia
- Actualización correcta del campo en la base de datos

## Código Modificado

### Frontend: `client/src/components/EditarPreguntas.js`

```javascript
// Antes: Cargaba todos los cuestionarios
const res = await axios.get(`${API_URL}/api/questionnaires`, config);

// Después: Filtra por docente autenticado
const res = await axios.get(`${API_URL}/api/questionnaires?created_by=${userId}`, config);
```

### Backend: `server/routes/questionRoutes.js`

```javascript
// Agregada validación de permisos
const [questionnaireCheck] = await pool.query(`
  SELECT q.created_by, t.user_id 
  FROM questionnaires q 
  JOIN teachers t ON q.created_by = t.id 
  WHERE q.id = ?
`, [existingQuestion[0].questionnaire_id]);

if (questionnaireCheck.length === 0 || questionnaireCheck[0].user_id !== requestingUserId) {
  return res.status(403).json({ 
    success: false, 
    message: 'No tienes permisos para editar esta pregunta' 
  });
}
```

## Estructura de Tablas Relevantes

### Tabla `users`
- `id` (PK) - Identificador único del usuario
- `name`, `email`, `phone` - Información personal
- `role` - Rol del usuario (estudiante, docente, admin)

### Tabla `teachers`
- `id` (PK) - Identificador único del profesor
- `user_id` (FK) - Referencia a users.id
- `subject` - Materia que enseña
- `institution` - Institución educativa

### Tabla `questionnaires`
- `id` (PK) - Identificador único del cuestionario
- `created_by` (FK) - Referencia a teachers.id
- `title`, `category`, `subject` - Información del cuestionario
- `grade`, `phase` - Nivel educativo y fase

### Tabla `questions`
- `id` (PK) - Identificador único de la pregunta
- `questionnaire_id` (FK) - Referencia a questionnaires.id
- `question_text` - Texto de la pregunta
- `option1`, `option2`, `option3`, `option4` - Opciones de respuesta
- `correct_answer` - Respuesta correcta (1-4)
- `category` - Categoría de la pregunta
- `image_url` - URL de imagen opcional

## Mejoras de Seguridad Implementadas

1. **Validación de Propiedad**: Solo el docente propietario puede editar sus preguntas
2. **Filtrado por Usuario**: Los cuestionarios se filtran automáticamente por el docente autenticado
3. **Validación de Cambios**: Se verifica que cualquier cambio de cuestionario sea válido
4. **Manejo de Errores**: Mensajes de error claros para diferentes escenarios

## Próximos Pasos Recomendados

1. **Pruebas**: Probar la funcionalidad de edición con diferentes usuarios
2. **Auditoría**: Revisar otras rutas similares para aplicar las mismas validaciones
3. **Documentación**: Actualizar la documentación de la API
4. **Monitoreo**: Implementar logs para rastrear intentos de acceso no autorizado

## Consideraciones de Rendimiento

- Las consultas utilizan índices apropiados en las tablas relacionadas
- Se evitan consultas N+1 mediante JOINs eficientes
- La validación se realiza una sola vez por operación
- Se mantiene la información del usuario en el token para evitar consultas adicionales
