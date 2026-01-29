# Sistema de Auditoría - SEIO

## 📋 Descripción

El sistema de auditoría permite rastrear **quién** (administrador, super_administrador o docente) realizó **qué cambios** en el sistema, **cuándo** y **desde dónde**.

## 🗄️ Estructura de la Base de Datos

### Tabla `audit_logs`

Almacena todos los registros de auditoría del sistema.

```sql
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(50) NOT NULL,           -- Acción: CREATE, UPDATE, DELETE, LOGIN, etc.
  table_name VARCHAR(50) NOT NULL,       -- Tabla afectada
  record_id INT,                         -- ID del registro afectado
  user_id INT NOT NULL,                  -- ID del usuario que realizó la acción
  user_role VARCHAR(50),                 -- Rol: super_administrador, administrador, docente
  user_name VARCHAR(255),                -- Nombre del usuario
  description TEXT,                      -- Descripción legible de la acción
  old_values JSON,                       -- Valores anteriores (antes del cambio)
  new_values JSON,                       -- Valores nuevos (después del cambio)
  ip_address VARCHAR(45),                -- Dirección IP del usuario
  user_agent TEXT,                       -- Navegador/dispositivo
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Campos de Auditoría Agregados a Tablas

Se agregaron los siguientes campos a las tablas principales:

- `users`: `created_by`, `updated_by`, `updated_at`
- `students`: `created_by`, `updated_by`, `updated_at`
- `teachers`: `created_by`, `updated_by`, `updated_at`
- `courses`: `created_by`, `updated_by`, `updated_at`
- `questionnaires`: `updated_by`, `updated_at` (ya tenía `created_by`)

## 🚀 Instalación

### 1. Ejecutar la migración

```bash
# Desde la carpeta server
mysql -u root -p seio_db < migrations/20260128_create_audit_logs.sql
```

### 2. Verificar que la tabla se creó correctamente

```sql
USE seio_db;
SHOW TABLES LIKE 'audit_logs';
DESCRIBE audit_logs;
```

## 📝 Uso del Sistema de Auditoría

### En el Backend

#### Importar el módulo de auditoría

```javascript
import { logCreate, logUpdate, logDelete, logLogin, logLogout } from '../utils/auditLogger.js';
```

#### Registrar creación de un registro

```javascript
await logCreate(
  'users',                    // Nombre de la tabla
  newUserId,                  // ID del registro creado
  req.user.id,                // ID del usuario que creó
  req.user.role,              // Rol del usuario
  req.user.name,              // Nombre del usuario
  { name, email, role },      // Valores del nuevo registro
  req                         // Objeto request (para IP y user agent)
);
```

#### Registrar actualización de un registro

```javascript
await logUpdate(
  'users',                    // Nombre de la tabla
  userId,                     // ID del registro actualizado
  req.user.id,                // ID del usuario que actualizó
  req.user.role,              // Rol del usuario
  req.user.name,              // Nombre del usuario
  oldValues,                  // Valores anteriores
  newValues,                  // Valores nuevos
  req                         // Objeto request
);
```

#### Registrar eliminación de un registro

```javascript
await logDelete(
  'users',                    // Nombre de la tabla
  userId,                     // ID del registro eliminado
  req.user.id,                // ID del usuario que eliminó
  req.user.role,              // Rol del usuario
  req.user.name,              // Nombre del usuario
  deletedUserData,            // Datos del registro eliminado
  req                         // Objeto request
);
```

#### Registrar inicio de sesión

```javascript
await logLogin(
  user.id,                    // ID del usuario
  user.role,                  // Rol del usuario
  user.name,                  // Nombre del usuario
  true,                       // true = éxito, false = fallo
  req                         // Objeto request
);
```

## 🔍 Consultar Logs de Auditoría

### API Endpoints (Solo super_administrador)

#### 1. Obtener todos los logs con filtros

```http
GET /api/audit/logs?tableName=users&userId=37&limit=50
```

**Parámetros opcionales:**
- `tableName`: Filtrar por tabla (ej: 'users', 'students')
- `userId`: Filtrar por usuario que realizó la acción
- `action`: Filtrar por tipo de acción (CREATE, UPDATE, DELETE)
- `startDate`: Fecha de inicio (YYYY-MM-DD)
- `endDate`: Fecha de fin (YYYY-MM-DD)
- `limit`: Número máximo de resultados (default: 100)

**Respuesta:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": 1,
      "action": "CREATE",
      "table_name": "users",
      "record_id": 45,
      "user_id": 37,
      "user_role": "administrador",
      "user_name": "Juan Pérez",
      "description": "Creó un nuevo registro en users (ID: 45)",
      "old_values": null,
      "new_values": "{\"name\":\"María López\",\"email\":\"maria@example.com\",\"role\":\"estudiante\"}",
      "ip_address": "192.168.1.100",
      "created_at": "2026-01-28T10:30:00.000Z"
    }
  ]
}
```

#### 2. Obtener historial de un registro específico

```http
GET /api/audit/history/users/45
```

Retorna todos los cambios realizados al usuario con ID 45.

### Consultas SQL Directas

#### Ver últimos 20 cambios en el sistema

```sql
SELECT * FROM audit_logs_with_user 
ORDER BY created_at DESC 
LIMIT 20;
```

#### Ver todos los cambios realizados por un usuario específico

```sql
SELECT * FROM audit_logs_with_user 
WHERE user_id = 37 
ORDER BY created_at DESC;
```

#### Ver historial de cambios de un usuario específico

```sql
SELECT * FROM audit_logs_with_user 
WHERE table_name = 'users' AND record_id = 45 
ORDER BY created_at DESC;
```

#### Ver cambios realizados en un rango de fechas

```sql
SELECT * FROM audit_logs_with_user 
WHERE created_at BETWEEN '2026-01-01' AND '2026-01-31'
ORDER BY created_at DESC;
```

#### Ver estadísticas de acciones por usuario

```sql
SELECT 
  user_name,
  user_role,
  action,
  COUNT(*) as total_acciones
FROM audit_logs
GROUP BY user_name, user_role, action
ORDER BY total_acciones DESC;
```

## 📊 Reportes Útiles

### 1. Usuarios más activos

```sql
SELECT 
  user_name,
  user_role,
  COUNT(*) as total_acciones,
  COUNT(DISTINCT table_name) as tablas_afectadas
FROM audit_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY user_id, user_name, user_role
ORDER BY total_acciones DESC
LIMIT 10;
```

### 2. Actividad por tabla

```sql
SELECT 
  table_name,
  action,
  COUNT(*) as total
FROM audit_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY table_name, action
ORDER BY total DESC;
```

### 3. Eliminaciones recientes

```sql
SELECT 
  table_name,
  record_id,
  user_name,
  user_role,
  description,
  old_values,
  created_at
FROM audit_logs_with_user
WHERE action = 'DELETE'
ORDER BY created_at DESC
LIMIT 20;
```

## 🔐 Seguridad

- Solo el **super_administrador** puede acceder a los logs de auditoría vía API
- Los logs NO pueden ser modificados ni eliminados desde la aplicación
- Se recomienda hacer respaldos periódicos de la tabla `audit_logs`
- Los logs incluyen IP y user agent para trazabilidad completa

## 📌 Notas Importantes

1. Los logs de auditoría se crean automáticamente al usar las funciones del módulo `auditLogger.js`
2. Los errores en el registro de auditoría NO interrumpen la operación principal
3. Los valores JSON en `old_values` y `new_values` pueden ser consultados con funciones JSON de MySQL
4. La vista `audit_logs_with_user` facilita las consultas incluyendo información del usuario

## 🎯 Próximos Pasos

Para extender el sistema de auditoría a otras tablas:

1. Importar `logCreate`, `logUpdate`, `logDelete` en la ruta correspondiente
2. Agregar las llamadas después de cada operación CRUD
3. Agregar campos `created_by`, `updated_by`, `updated_at` a la tabla si es necesario

## 📞 Soporte

Para más información sobre el sistema de auditoría, consultar:
- `server/utils/auditLogger.js` - Módulo principal
- `server/routes/auditRoutes.js` - Endpoints de consulta
- `server/migrations/20260128_create_audit_logs.sql` - Estructura de BD
