# 📋 Instrucciones para Agregar Campo Institution

## 🎯 Recomendación Final

**Agregar el campo `institution` en la tabla `users`** es la mejor opción porque:

1. ✅ **Todos los usuarios pueden tener institución**: estudiantes, docentes, administradores
2. ✅ **Fácil de filtrar**: Una sola consulta por `users.institution`
3. ✅ **Evita duplicación**: No necesitas mantener institution en múltiples tablas
4. ✅ **Escalable**: Fácil agregar más instituciones en el futuro

## 📝 Script SQL para Ejecutar

**Archivo**: `server/migrations/20250106_add_institution_to_users_FINAL.sql`

### Pasos:

1. **Abre phpMyAdmin** (o tu cliente MySQL)
2. **Selecciona la base de datos**: `seio_db`
3. **Ve a la pestaña "SQL"**
4. **Copia y pega TODO el contenido** del archivo `20250106_add_institution_to_users_FINAL.sql`
5. **Haz clic en "Ejecutar"**

## ✅ Qué Hace el Script

1. **Agrega `institution VARCHAR(100) NULL` a la tabla `users`**
2. **Migra datos existentes** desde `teachers.institution` → `users.institution` (para docentes que ya tienen institución)
3. **Agrega `institution VARCHAR(100) NULL` a la tabla `students`** (para facilitar consultas)
4. **Sincroniza** `users.institution` → `students.institution` (para estudiantes existentes)
5. **Crea índices** para mejorar búsquedas por institución

## 🔍 Verificación Después de Ejecutar

Ejecuta estas consultas en phpMyAdmin para verificar:

```sql
-- Verificar que el campo existe en users
DESCRIBE users;
-- Deberías ver una columna "institution" tipo VARCHAR(100)

-- Verificar que el campo existe en students
DESCRIBE students;
-- Deberías ver una columna "institution" tipo VARCHAR(100)

-- Verificar datos migrados (para docentes)
SELECT u.id, u.name, u.role, u.institution, t.institution as teacher_institution
FROM users u
LEFT JOIN teachers t ON u.id = t.user_id
WHERE u.role = 'docente';
```

## 📊 Estructura Final

Después de ejecutar el script:

```
users
├── id
├── name
├── email
├── phone
├── institution  ← NUEVO (VARCHAR(100) NULL)
├── password
├── role
├── estado
└── created_at

students
├── id
├── user_id
├── contact_phone
├── contact_email
├── age
├── grade
├── course_id
├── institution  ← NUEVO (VARCHAR(100) NULL)
└── created_at

teachers
├── id
├── user_id
├── subject
├── institution  ← Ya existe (se mantiene por compatibilidad)
└── created_at
```

## ⚠️ Importante

- El campo `institution` en `users` es la **fuente principal**
- El campo `institution` en `students` se sincroniza automáticamente desde `users`
- El campo `institution` en `teachers` se mantiene por compatibilidad, pero el de `users` tiene prioridad

## 🚀 Después de Ejecutar el Script

1. **Reinicia el servidor backend** (si no usa nodemon)
2. **El código ya está preparado** para usar el campo `institution`
3. **Podrás**:
   - Asignar institución al crear/editar usuarios
   - Filtrar datos por institución en dashboards
   - Gestionar múltiples instituciones en el mismo sistema
