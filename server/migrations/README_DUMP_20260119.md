# Dump de Base de Datos - 2026-01-19

## Información del Dump

- **Fecha**: 2026-01-19
- **Base de Datos**: `seio_db`
- **Versión de MariaDB**: 10.4.32-MariaDB
- **Sistema**: Windows (AMD64)

## Estado de la Base de Datos

Este dump representa el estado completo de la base de datos `seio_db` al 19 de enero de 2026, incluyendo:

### Tablas Principales

1. **Usuarios y Autenticación**
   - `users` - Usuarios del sistema
   - `password_reset_tokens` - Tokens para recuperación de contraseña
   - `roles` - Roles del sistema
   - `user_roles` - Asignación de roles a usuarios

2. **Estudiantes y Docentes**
   - `students` - Información de estudiantes
   - `teachers` - Información de docentes
   - `teacher_students` - Relaciones docente-estudiante
   - `teacher_courses` - Cursos asignados a docentes
   - `teacher_institutions` - Licencias de docentes por institución

3. **Cursos y Evaluaciones**
   - `courses` - Cursos disponibles
   - `grades` - Calificaciones de estudiantes
   - `questionnaires` - Cuestionarios/evaluaciones
   - `questions` - Preguntas de cuestionarios
   - `quiz_attempts` - Intentos de evaluación
   - `evaluation_results` - Resultados de evaluaciones

4. **Indicadores y Logros**
   - `indicators` - Indicadores de logro
   - `student_indicators` - Indicadores por estudiante
   - `questionnaire_indicators` - Indicadores asociados a cuestionarios
   - `auditoria_indicadores` - Auditoría de cambios en indicadores

5. **Planes de Mejora**
   - `improvement_plans` - Planes de recuperación
   - `recovery_activities` - Actividades de recuperación
   - `recovery_resources` - Recursos para recuperación
   - `recovery_progress` - Progreso en recuperación

6. **Recursos Educativos**
   - `educational_resources` - Recursos educativos
   - `student_resource_usage` - Uso de recursos por estudiantes
   - `subject_categories` - Categorías por materia

7. **Mensajería**
   - `messages` - Mensajes individuales
   - `message_attachments` - Adjuntos de mensajes
   - `group_messages` - Mensajes grupales
   - `group_message_recipients` - Destinatarios de mensajes grupales

8. **Promedios y Estadísticas**
   - `phase_averages` - Promedios por fase

## Notas Importantes

- El dump completo contiene datos de prueba y producción
- Las contraseñas están hasheadas con bcrypt
- Los tokens de recuperación de contraseña tienen expiración de 1 hora
- Las licencias de docentes pueden tener múltiples instituciones activas
- El sistema de mensajería soporta mensajes individuales y grupales

## Uso del Dump

Para restaurar este dump en una base de datos MariaDB/MySQL:

```bash
mysql -u usuario -p seio_db < 20260119_seio_db_dump.sql
```

O desde phpMyAdmin:
1. Seleccionar la base de datos `seio_db`
2. Ir a la pestaña "Importar"
3. Seleccionar el archivo SQL
4. Ejecutar

## Migraciones Aplicadas

Este dump incluye todas las migraciones hasta el 2026-01-19:
- `20250120_create_messages_system.sql`
- `20250120_create_password_reset_tokens.sql`
- `20250129_create_teacher_institutions_licenses.sql`
- Y todas las migraciones anteriores

## Próximos Pasos

Al continuar el desarrollo mañana, tener en cuenta:
- El estado actual de todas las tablas
- Las relaciones entre tablas
- Los triggers y procedimientos almacenados
- Los índices y claves foráneas
