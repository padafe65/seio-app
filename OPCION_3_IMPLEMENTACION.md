# Implementación Opción 3: Sincronización Automática de subject_categories

## Resumen
Se implementó la **Opción 3** para mantener sincronizadas las tablas `questionnaires` y `subject_categories` automáticamente, evitando desincronización y permitiendo que funcionen los dropdowns correctamente.

## Cambios Realizados

### 1. Backend - Utilidad de Sincronización
**Archivo:** `server/utils/syncSubjectCategories.js`

- ✅ Función `syncSubjectCategories()`: Sincroniza todas las combinaciones existentes en `questionnaires` a `subject_categories`
- ✅ Función `ensureSubjectCategoryExists()`: Asegura que una combinación específica exista en `subject_categories`

### 2. Backend - Rutas de Cuestionarios
**Archivo:** `server/routes/questionnaireRoutes.js`

- ✅ **GET /:id** - Al obtener un cuestionario, automáticamente crea el registro en `subject_categories` si no existe
- ✅ **POST /** - Al crear un cuestionario, crea la combinación subject-category en `subject_categories`
- ✅ **PUT /:id** - Al actualizar un cuestionario, crea/actualiza la combinación en `subject_categories`

### 3. Backend - Servidor
**Archivo:** `server/server.js`

- ✅ Al iniciar el servidor, ejecuta `syncSubjectCategories()` automáticamente
- ✅ Esto sincroniza todas las combinaciones existentes de `questionnaires` a `subject_categories`

### 4. Script de Migración SQL
**Archivo:** `server/migrations/20251014_sync_subject_categories.sql`

- ✅ Script SQL para ejecutar manualmente si se necesita sincronizar las tablas
- ✅ Usa `INSERT IGNORE` para evitar duplicados

## Cómo Funciona

### Flujo Automático:

1. **Al iniciar el servidor:**
   - Se ejecuta `syncSubjectCategories()`
   - Se sincronizan todas las combinaciones de `questionnaires` → `subject_categories`
   - Se muestran logs indicando cuántos registros se agregaron

2. **Al editar un cuestionario:**
   - Frontend carga el cuestionario (GET `/api/questionnaires/:id`)
   - Backend verifica si `subject` + `category` existe en `subject_categories`
   - Si NO existe, lo crea automáticamente
   - Frontend carga las categorías de esa materia
   - Ahora la categoría aparece en el dropdown ✅

3. **Al crear un cuestionario:**
   - Frontend envía `subject` + `category`
   - Backend crea el cuestionario
   - Backend también crea/verifica que exista en `subject_categories`

4. **Al actualizar un cuestionario:**
   - Similar al crear, se asegura que la combinación exista en `subject_categories`

## Ejemplo Práctico

### Caso: Cuestionario "Física 1_1" con subject="Física 1" y category="cinemática"

**Antes de la Opción 3:**
- ❌ `questionnaires` tiene: subject="Física 1", category="cinemática"
- ❌ `subject_categories` NO tiene: ("Física 1", "cinemática")
- ❌ Al editar, el dropdown de categorías está vacío

**Después de la Opción 3:**
- ✅ Al iniciar el servidor o al cargar el cuestionario
- ✅ Se crea automáticamente en `subject_categories`: ("Física 1", "cinemática")
- ✅ Al editar, el dropdown muestra "cinemática" correctamente

## Ventajas

1. ✅ **No requiere cambios en la estructura de BD**
2. ✅ **Sincronización automática** - No hay que preocuparse por inconsistencias
3. ✅ **Backward compatible** - Funciona con datos existentes
4. ✅ **Permite pre-crear** subject/categories si se desea
5. ✅ **Mínimos cambios en el código**

## Logs del Servidor

Al iniciar, verás:
```
🚀 Servidor corriendo en el puerto 5000
🔄 Sincronizando subject_categories con questionnaires...
✅ Se agregaron X nuevas combinaciones a subject_categories
📊 Total de combinaciones en subject_categories: Y
```

## Próximos Pasos

1. ✅ Reiniciar el servidor backend (ya hecho)
2. ✅ Verificar en la consola del servidor que se ejecutó la sincronización
3. ✅ Probar editando el cuestionario "Física 1_1"
4. ✅ Verificar que ahora aparezca "cinemática" en el dropdown

## Archivos Modificados

- ✅ `server/utils/syncSubjectCategories.js` (nuevo)
- ✅ `server/routes/questionnaireRoutes.js` (modificado)
- ✅ `server/server.js` (modificado)
- ✅ `server/migrations/20251014_sync_subject_categories.sql` (nuevo)

