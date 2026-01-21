# 📊 Análisis: Requerimientos vs Estado Actual del Sistema SEIO

**Fecha de análisis:** 2026-01-19  
**Sin modificaciones al código** - Solo análisis comparativo

---

## 🎯 Resumen Ejecutivo

Este documento compara los requerimientos del usuario con el estado actual del sistema SEIO, identificando qué funcionalidades ya existen, cuáles están parcialmente implementadas y cuáles faltan por desarrollar.

---

## ✅ REQUERIMIENTOS vs ESTADO ACTUAL

### 1. **Gestión de Licencias por Institución y Materia**

#### Requerimiento:
> "El docente gestiona una licencia por institución y por materia"

#### Estado Actual: ✅ **IMPLEMENTADO**
- **Tabla `teacher_institutions`** existe y gestiona múltiples licencias por docente
- **Campos:** `teacher_id`, `institution`, `license_status`, `expiration_date`
- **Rutas API:** `/api/teacher-licenses` con endpoints completos
- **Funcionalidades:**
  - ✅ Crear/agregar licencias por institución
  - ✅ Ver licencias activas/vencidas
  - ✅ Validación de licencias por institución
  - ✅ Gestión de múltiples licencias por docente

#### Nota:
- ✅ Sistema completo y funcional
- ⚠️ **Falta:** Validación automática de licencia por materia (actualmente solo por institución)

---

### 2. **Registro de Estudiantes**

#### Requerimiento:
> "El estudiante puede registrarse a sí mismo o puede ser registrado por un docente"

#### Estado Actual: ✅ **IMPLEMENTADO**
- **Auto-registro:** 
  - ✅ Ruta `/api/auth/register` permite registro público (solo como 'estudiante')
  - ✅ Formulario de registro en frontend
- **Registro por docente:**
  - ✅ Ruta `/api/students` permite crear estudiantes con `teacher_id`
  - ✅ Componente `CompleteStudent.js` para completar datos
  - ✅ Relación `teacher_students` se crea automáticamente

#### Funcionalidades:
- ✅ Creación de usuario + estudiante en una transacción
- ✅ Asignación automática a docente
- ✅ Validación de datos

---

### 3. **Creación de Cuestionarios y Preguntas**

#### Requerimiento:
> "El docente puede hacer sus propios cuestionarios y agregar preguntas que encuentre (gratis o de pago) o crear sus propias preguntas"

#### Estado Actual: ⚠️ **PARCIALMENTE IMPLEMENTADO**

**Lo que SÍ existe:**
- ✅ Creación de cuestionarios por docente (`/api/questionnaires`)
- ✅ Agregar preguntas propias a cuestionarios (`/api/questions/question`)
- ✅ Validación de permisos (solo el docente puede editar sus cuestionarios)
- ✅ Sistema de categorías y materias

**Lo que FALTA:**
- ❌ **Banco de preguntas compartido** (biblioteca de preguntas)
- ❌ **Sistema de preguntas gratuitas vs pagas**
- ❌ **Búsqueda y selección de preguntas de otros docentes/administradores**
- ❌ **Sistema de compra/licencia de preguntas**
- ❌ **Atribución de autoría de preguntas**

#### Recomendación:
Necesita implementar:
1. Tabla `question_bank` o `shared_questions` con campos:
   - `is_free` (boolean)
   - `price` (decimal, nullable)
   - `author_id` (teacher_id o admin_id)
   - `is_public` (boolean)
2. Sistema de búsqueda/filtrado de preguntas
3. Endpoint para "agregar pregunta desde banco" a cuestionario

---

### 4. **Múltiples Evaluaciones por Fase y Promedio**

#### Requerimiento:
> "No importa que el docente haga una, dos, tres, cinco evaluaciones por fase o más, pero el programa al final promedia y muestra un resultado por fase"

#### Estado Actual: ✅ **IMPLEMENTADO**
- ✅ Tabla `evaluation_results` almacena mejor nota por cuestionario
- ✅ Tabla `grades` tiene columnas `phase1`, `phase2`, `phase3`, `phase4`
- ✅ Tabla `phase_averages` almacena promedio por fase
- ✅ **Cálculo automático:** En `server/routes/quiz.js` (líneas 115-131)
  - Calcula promedio de todas las evaluaciones de una fase
  - Actualiza `grades.phase1/2/3/4` automáticamente
- ✅ Función `recalculatePhaseAverages()` para recalcular promedios

#### Funcionalidades:
- ✅ Múltiples cuestionarios por fase permitidos
- ✅ Promedio automático de todas las evaluaciones de la fase
- ✅ Actualización en tiempo real al completar cuestionario

---

### 5. **Cuatro Fases/Períodos y Nota Final**

#### Requerimiento:
> "Se crean cuatro fases o cuatro períodos para obtener la nota final del estudiante"

#### Estado Actual: ✅ **IMPLEMENTADO**
- ✅ Sistema de 4 fases (`phase1`, `phase2`, `phase3`, `phase4`)
- ✅ Tabla `grades` con columnas para cada fase
- ✅ Campo `average` calcula promedio de las 4 fases
- ✅ Cálculo automático en `server/routes/quiz.js` (líneas 162-168)

#### Funcionalidades:
- ✅ Almacenamiento de notas por fase
- ✅ Cálculo de promedio general automático
- ✅ Filtrado por año académico (`academic_year`)

---

### 6. **Envío de Nota Final por Email (Aprobado/Reprobado)**

#### Requerimiento:
> "Se envía la nota final al email del estudiante. Si pasó o perdió. La nota mínima para pasar es 3.5"

#### Estado Actual: ❌ **NO IMPLEMENTADO**

**Lo que SÍ existe:**
- ✅ Servicio de email (`server/utils/emailService.js`)
- ✅ Configuración SMTP/Gmail
- ✅ Función `sendPasswordResetEmail()` como ejemplo
- ✅ Campo `contact_email` en tabla `students` (email del acudiente)
- ✅ Campo `email` en tabla `users` (email del estudiante, relacionado por `students.user_id`)
- ✅ Cálculo de nota final (`grades.average`)

**Lo que FALTA:**
- ❌ **Función para enviar email con nota final**
- ❌ **Trigger o proceso automático al finalizar fase 4**
- ❌ **Template de email con resultado (aprobado/reprobado)**
- ❌ **Validación de nota mínima 3.5 para aprobar**

#### Recomendación:
Necesita implementar:
1. Función `sendFinalGradeEmail(studentId, finalGrade, passed)` en `emailService.js` que:
   - Obtenga `users.email` (email del estudiante) desde `students.user_id`
   - Obtenga `students.contact_email` (email del acudiente)
   - Envíe email a ambos destinatarios
2. Trigger o proceso que se ejecute cuando:
   - Se complete la fase 4
   - O se calcule la nota final
3. Template HTML para email con:
   - Nota final
   - Estado (Aprobado/Reprobado)
   - Desglose por fases

---

### 7. **Indicadores por Fase y Verificación**

#### Requerimiento:
> "El programa verifica por fase si el estudiante perdió una fase. Los indicadores que el docente creó para ese curso o grado. Si es séptimo grado, entonces todos los cursos de séptimo (A, B, C, D) según los cursos de séptimo que existan"

#### Estado Actual: ✅ **PARCIALMENTE IMPLEMENTADO**

**Lo que SÍ existe:**
- ✅ Tabla `indicators` con campos `phase`, `grade`, `subject`
- ✅ Tabla `student_indicators` para rastrear logros
- ✅ Tabla `questionnaire_indicators` para asociar indicadores a cuestionarios
- ✅ Función `evaluateStudentIndicators()` en `server/utils/evaluateIndicators.js`
- ✅ Evaluación automática al completar cuestionario
- ✅ Ruta `/api/indicators/student/:userId` para ver indicadores del estudiante

**Lo que FALTA:**
- ⚠️ **Verificación automática por fase** (actualmente se evalúa por cuestionario)
- ⚠️ **Agrupación por grado y curso** (séptimo A, B, C, D)
- ⚠️ **Notificación cuando se pierde una fase**

#### Funcionalidades Actuales:
- ✅ Indicadores se evalúan al completar cuestionario
- ✅ Se marca `achieved = true/false` en `student_indicators`
- ✅ Se puede consultar indicadores por estudiante

#### Recomendación:
Necesita mejorar:
1. Proceso que verifique indicadores al finalizar cada fase
2. Agrupación automática por grado y curso
3. Identificación de estudiantes que perdieron fase

---

### 8. **Notificación a Estudiante y Padre de Familia**

#### Requerimiento:
> "El programa busca automáticamente el email del estudiante y del padre de familia, y envía notificación que el estudiante está pendiente y no logró los logros de esta fase, o en resumen no logró los logros propuestos para el año académico o período académico si es semestre"

#### Estado Actual: ❌ **NO IMPLEMENTADO**

**Lo que SÍ existe:**
- ✅ Campo `contact_email` en `students` - **Este es el email del acudiente/padre de familia** (según información adicional proporcionada)
- ✅ Campo `contact_phone` en `students` - Teléfono del acudiente
- ✅ Campo `email` en `users` - Email del estudiante (vinculado a `students.user_id`)
- ✅ Servicio de email configurado
- ✅ Sistema de planes de mejoramiento automático
- ✅ Identificación de indicadores no alcanzados

**Lo que FALTA:**
- ❌ **Función para enviar notificación a estudiante y acudiente**
- ❌ **Template de email con indicadores no alcanzados**
- ❌ **Proceso automático que se ejecute al perder fase**
- ❌ **Búsqueda automática de emails (estudiante desde `users.email` y acudiente desde `students.contact_email`)**

#### Nota Importante:
- ✅ **NO se requiere campo adicional** - Los datos del acudiente ya están en `students.contact_email` y `students.contact_phone`
- ✅ El email del estudiante se obtiene de `users.email` donde `users.id = students.user_id`
- ✅ El email del acudiente se obtiene de `students.contact_email`

#### Recomendación:
Necesita implementar:
1. Función `sendPhaseFailureNotification(studentId, phase, failedIndicators)` que:
   - Obtenga `users.email` (email del estudiante) desde `students.user_id`
   - Obtenga `students.contact_email` (email del acudiente)
   - Envíe email a ambos destinatarios
2. Template HTML para email con:
   - Fase perdida
   - Lista de indicadores no alcanzados
   - Plan de mejoramiento (si existe)
3. Trigger o proceso que se ejecute cuando:
   - Se complete una fase
   - El promedio de fase sea < 3.5
   - Se identifiquen indicadores no alcanzados

---

### 9. **Envío Automático de Planes de Mejoramiento**

#### Requerimiento:
> "Se envía automáticamente los planes de mejoramiento que el docente ha diseñado para ese grado y para ese curso o para esa fase"

#### Estado Actual: ⚠️ **PARCIALMENTE IMPLEMENTADO**

**Lo que SÍ existe:**
- ✅ Tabla `improvement_plans` con campos completos
- ✅ Sistema automático de generación de planes (`server/utils/autoImprovementPlans.js`)
- ✅ Generación automática cuando nota < 3.5
- ✅ Asociación de planes con grado, curso y fase
- ✅ Campo `email_sent` en `improvement_plans` (pero no se usa)

**Lo que FALTA:**
- ❌ **Envío automático de email con plan de mejoramiento**
- ❌ **Adjuntar plan en email a estudiante y padre**
- ❌ **Template de email con detalles del plan**
- ❌ **Búsqueda de planes por grado/curso/fase**

#### Funcionalidades Actuales:
- ✅ Planes se crean automáticamente
- ✅ Se almacenan en base de datos
- ✅ Se pueden consultar por API

#### Recomendación:
Necesita implementar:
1. Función `sendImprovementPlanEmail(studentId, planId)` que:
   - Obtenga `users.email` (email del estudiante) desde `students.user_id`
   - Obtenga `students.contact_email` (email del acudiente)
   - Envíe email a ambos destinatarios
2. Template HTML con:
   - Detalles del plan
   - Actividades
   - Recursos
   - Fecha límite
3. Integrar en proceso automático de generación de planes
4. Actualizar campo `email_sent = true` después de enviar

---

## 📋 TABLAS DE BASE DE DATOS RELEVANTES

### Tablas Existentes (Verificadas):

1. **`users`** - Usuarios del sistema
2. **`teachers`** - Docentes
3. **`students`** - Estudiantes (con `contact_email` = email del acudiente, `contact_phone` = teléfono del acudiente)
4. **`teacher_institutions`** - Licencias por institución
5. **`questionnaires`** - Cuestionarios (con `phase`, `grade`, `subject`)
6. **`questions`** - Preguntas (vinculadas a cuestionarios)
7. **`quiz_attempts`** - Intentos de cuestionarios
8. **`evaluation_results`** - Mejores notas por cuestionario
9. **`grades`** - Notas por fase (`phase1`, `phase2`, `phase3`, `phase4`, `average`)
10. **`phase_averages`** - Promedios por fase
11. **`indicators`** - Indicadores de logro
12. **`student_indicators`** - Indicadores asignados a estudiantes
13. **`questionnaire_indicators`** - Indicadores asociados a cuestionarios
14. **`improvement_plans`** - Planes de mejoramiento
15. **`courses`** - Cursos (séptimo A, B, C, D, etc.)

### Campos Faltantes Identificados:

1. **`questions.is_free`** - Si la pregunta es gratuita (para banco de preguntas)
2. **`questions.price`** - Precio de pregunta (si es de pago)
3. **`questions.author_id`** - Autor de la pregunta (para banco compartido)
4. **`questions.is_public`** - Si la pregunta está en banco público

### Nota sobre Emails:
- ✅ **`students.contact_email`** - Ya existe y contiene el email del acudiente/padre de familia
- ✅ **`students.contact_phone`** - Ya existe y contiene el teléfono del acudiente
- ✅ **`users.email`** - Ya existe y contiene el email del estudiante (relacionado por `students.user_id`)
- ✅ **NO se requiere campo adicional** para el email del acudiente

---

## 🎯 RESUMEN DE ESTADO

| Requerimiento | Estado | Completitud |
|---------------|--------|-------------|
| 1. Licencias por institución/materia | ✅ Implementado | 90% (falta validación por materia) |
| 2. Registro de estudiantes | ✅ Implementado | 100% |
| 3. Cuestionarios y preguntas | ⚠️ Parcial | 60% (falta banco de preguntas) |
| 4. Múltiples evaluaciones por fase | ✅ Implementado | 100% |
| 5. Cuatro fases y nota final | ✅ Implementado | 100% |
| 6. Email con nota final | ❌ No implementado | 0% |
| 7. Indicadores por fase | ⚠️ Parcial | 70% (falta verificación automática por fase) |
| 8. Notificación a estudiante/padre | ❌ No implementado | 0% |
| 9. Envío de planes de mejoramiento | ⚠️ Parcial | 50% (se crean, no se envían) |

---

## 🔧 FUNCIONALIDADES QUE FALTAN IMPLEMENTAR

### Prioridad ALTA:

1. **Sistema de Email para Notas Finales**
   - Función `sendFinalGradeEmail()`
   - Template HTML
   - Trigger al finalizar fase 4

2. **Sistema de Notificaciones a Padres**
   - ✅ Campo `contact_email` en `students` ya existe (email del acudiente)
   - Función `sendPhaseFailureNotification()` que use `students.contact_email` y `users.email`
   - Template HTML con indicadores fallidos

3. **Envío Automático de Planes de Mejoramiento**
   - Función `sendImprovementPlanEmail()`
   - Integración con generación automática
   - Template HTML con detalles del plan

### Prioridad MEDIA:

4. **Banco de Preguntas Compartido**
   - Tabla `question_bank` o modificar `questions`
   - Sistema de búsqueda/filtrado
   - Endpoint para agregar preguntas desde banco

5. **Verificación Automática de Indicadores por Fase**
   - Proceso que se ejecute al finalizar cada fase
   - Agrupación por grado y curso
   - Identificación de estudiantes que perdieron fase

### Prioridad BAJA:

6. **Validación de Licencia por Materia**
   - Extender sistema de licencias para incluir materia

---

## 📝 NOTAS ADICIONALES

### Sistema de Email:
- ✅ Servicio de email está configurado y funcional
- ✅ Solo falta crear funciones específicas para cada tipo de email
- ✅ Templates HTML necesarios para cada tipo de notificación

### Base de Datos:
- ✅ Estructura sólida y bien diseñada
- ⚠️ Faltan algunos campos específicos mencionados arriba
- ✅ Relaciones entre tablas están bien definidas

### Automatización:
- ✅ Sistema automático de planes de mejoramiento existe
- ⚠️ Falta integrar envío de emails en procesos automáticos
- ⚠️ Falta trigger para verificación de fases

---

## 🎯 CONCLUSIÓN

El sistema SEIO tiene una **base sólida** con aproximadamente **70% de los requerimientos implementados**. Las funcionalidades principales de gestión académica están funcionando, pero faltan los **sistemas de comunicación automática** (emails) y algunas funcionalidades avanzadas como el **banco de preguntas compartido**.

**Principales áreas de trabajo pendientes:**
1. Sistema de notificaciones por email (3 funcionalidades)
2. Banco de preguntas compartido
3. Verificación automática de indicadores por fase
4. Integración de emails en procesos automáticos

---

## 📧 NOTA IMPORTANTE SOBRE EMAILS

**Información adicional proporcionada por el usuario:**

Los datos del acudiente (padre de familia) están almacenados en la tabla `students` en los campos:
- **`students.contact_email`** - Email del acudiente/padre de familia
- **`students.contact_phone`** - Teléfono del acudiente

El email del estudiante se obtiene de:
- **`users.email`** - Donde `users.id = students.user_id`

**Implicaciones:**
- ✅ NO se requiere agregar campo `parent_email` adicional
- ✅ El sistema ya tiene toda la información necesaria para enviar emails
- ✅ Las funciones de email deben usar:
  - `users.email` (obtenido desde `students.user_id`) para el estudiante
  - `students.contact_email` para el acudiente/padre de familia

---

**Documento generado sin modificar código** - Solo análisis comparativo
