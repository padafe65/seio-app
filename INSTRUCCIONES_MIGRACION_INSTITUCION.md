# Instrucciones para Migración de Campo Institution

## Resumen de Cambios

Se está implementando la gestión de instituciones para permitir que múltiples instituciones educativas usen el mismo sistema, filtrando los datos por institución.

### Cambios en la Base de Datos

1. **Agregar campo `institution` a tabla `users`**
2. **Agregar campo `institution` a tabla `students`**
3. **Migrar datos existentes de `teachers.institution` a `users.institution`**
4. **Sincronizar `users.institution` con `students.institution`**

## Pasos para Ejecutar la Migración

### Paso 1: Ejecutar el Script SQL

1. Abre phpMyAdmin o tu cliente MySQL preferido
2. Selecciona la base de datos `seio_db`
3. Ve a la pestaña "SQL"
4. Copia y pega el contenido del archivo:
   `server/migrations/20250106_add_institution_to_users.sql`
5. Haz clic en "Ejecutar"

### Paso 2: Verificar que la Migración Funcionó

Ejecuta estas consultas para verificar:

```sql
-- Verificar que el campo existe en users
DESCRIBE users;

-- Verificar que el campo existe en students
DESCRIBE students;

-- Verificar que los datos se migraron correctamente
SELECT u.id, u.name, u.institution, t.institution as teacher_institution
FROM users u
LEFT JOIN teachers t ON u.id = t.user_id
WHERE u.role = 'docente';
```

### Paso 3: Reiniciar el Servidor Backend

Después de ejecutar la migración, reinicia el servidor backend para que los cambios se apliquen:

```bash
cd server
npm run start:dev
```

## Cambios en el Código

### Frontend

1. **UserForm.js**: Agregado campo `institution` para crear/editar usuarios
2. **CompleteStudent.js**: Corregida lógica para que los combos funcionen cuando Super Admin completa registros
3. **UsersManagement.js**: Agregada funcionalidad para detectar y completar registros incompletos

### Backend

1. **usersRoutes.js**: Actualizado para incluir `institution` en CREATE, UPDATE y SELECT
2. **server.js**: Actualizado endpoints de estudiantes para sincronizar `institution` con `users.institution`

## Notas Importantes

- El campo `institution` en `users` es la fuente principal de verdad
- El campo `institution` en `students` se sincroniza automáticamente desde `users.institution`
- El campo `institution` en `teachers` se mantiene por compatibilidad, pero se puede migrar a `users` en el futuro

## Próximos Pasos (Pendientes)

1. Agregar filtrado por institución en los dashboards
2. Actualizar queries para filtrar por institución según el usuario autenticado
3. Crear endpoint para obtener lista de instituciones disponibles
4. Agregar validación para asegurar que docentes solo vean estudiantes de su misma institución
