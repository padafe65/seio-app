# 📧 Instrucciones: Sistema de Envío de Emails con PDFs - SEIO

## ✅ Implementación Completada

Se ha implementado el sistema de envío automático de emails **con PDFs adjuntos** cuando el docente hace clic en "Evaluar Fase" manualmente.

### 🆕 Nueva Funcionalidad: PDFs Adjuntos

Los emails ahora incluyen un **PDF adjunto** con formato estándar que contiene:
- ✅ Logo de la institución (si está configurado)
- ✅ Nombre del docente
- ✅ Institución educativa
- ✅ Período académico
- ✅ Datos completos del estudiante
- ✅ Resultados de la fase
- ✅ Indicadores no alcanzados
- ✅ Plan de mejoramiento (si existe)
- ✅ Formato imprimible y profesional

---

## 🎯 Funcionalidades Implementadas

### 1. **Envío de Resultados de Fase**
Cuando el docente hace clic en "Evaluar Fase", el sistema:
- ✅ Revisa todos los estudiantes de esa fase
- ✅ Identifica estudiantes que perdieron (nota < 3.5)
- ✅ Verifica si tienen planes de mejoramiento
- ✅ Envía email a estudiante y acudiente con:
  - Nota de la fase
  - Estado (Aprobó/No aprobó)
  - Lista de indicadores no alcanzados
  - **Si hay plan de mejoramiento:** Detalles completos del plan
  - **Si NO hay plan:** Mensaje indicando que el docente hará entrega física o por email

### 2. **Envío de Nota Final (Fase 4)**
Al evaluar la fase 4, además se envía:
- ✅ Email con nota final (promedio de las 4 fases)
- ✅ Estado final (Aprobó/Reprobó)
- ✅ Desglose completo por fases
- ✅ Nota mínima para aprobar (3.5)

### 3. **Envío de Planes de Mejoramiento**
- ✅ Función disponible para enviar planes específicos
- ✅ Template HTML con todos los detalles del plan

---

## 🖼️ Configurar el Logo

Para que el PDF incluya el logo de tu institución:

1. **Colocar el logo:**
   - Ubicación: `server/uploads/logos/logo.png`
   - Formato: PNG (recomendado) o JPG
   - Tamaño recomendado: 200-400 píxeles (cuadrado o vertical)
   - Nombre exacto: `logo.png` (sin espacios, sin mayúsculas)

2. **Especificaciones:**
   - Fondo transparente (PNG) o blanco
   - Resolución mínima: 200x200 píxeles
   - Peso máximo: 500 KB

3. **Verificar:**
   - El archivo debe estar en: `server/uploads/logos/logo.png`
   - Si no existe el logo, el PDF se generará sin logo (no causará error)

📝 **Ver más detalles en:** `server/uploads/logos/README.md`

---

## 🚀 Cómo Usar el Sistema

### **Para Docentes:**

1. **Acceder a Evaluación de Fases**
   - Iniciar sesión como docente
   - Navegar a la sección de "Evaluación de Fases" o `/phase-evaluation`

2. **Seleccionar Fase**
   - Elegir la fase que desea evaluar (1, 2, 3 o 4)

3. **Hacer Clic en "Evaluar/Actualizar Fase"**
   - El sistema procesará automáticamente:
     - Generará/actualizará planes de mejoramiento si es necesario
     - Enviará emails a todos los estudiantes y acudientes
     - Mostrará resumen de resultados

4. **Ver Resultados**
   - El sistema mostrará:
     - Número de estudiantes procesados
     - Planes creados/actualizados
     - Emails enviados exitosamente
     - Emails fallidos (si los hay)

---

## 🧪 Probar el Sistema

### **Opción 1: Probar desde la Interfaz Web**

1. Iniciar el servidor:
   ```bash
   cd server
   npm run dev
   ```

2. Iniciar el cliente:
   ```bash
   cd client
   npm start
   ```

3. Acceder como docente:
   - Ir a `/phase-evaluation`
   - Seleccionar una fase
   - Hacer clic en "Evaluar/Actualizar Fase"
   - Verificar que se envíen los emails

### **Opción 2: Probar con Script de Prueba**

El script permite probar cada tipo de email individualmente:

```bash
cd server

# Probar email de resultados de fase
node test-email-system.js phase [studentId] [phase]
# Ejemplo: node test-email-system.js phase 30 1

# Probar email de nota final
node test-email-system.js final [studentId]
# Ejemplo: node test-email-system.js final 30

# Probar email de plan de mejoramiento
node test-email-system.js plan [studentId]
# Ejemplo: node test-email-system.js plan 30
```

---

## ⚙️ Configuración de Email

### **Verificar Configuración**

El sistema usa las siguientes variables de entorno (en `server/.env`):

```env
# Opción 1: SMTP personalizado
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-app
SMTP_FROM=noreply@seio.com

# Opción 2: Gmail con App Password
GMAIL_USER=tu-email@gmail.com
GMAIL_APP_PASSWORD=tu-app-password
```

### **Para Gmail:**

1. Habilitar "Verificación en 2 pasos"
2. Generar "Contraseña de aplicación":
   - Ir a: https://myaccount.google.com/apppasswords
   - Crear contraseña para "Correo"
   - Usar esa contraseña en `GMAIL_APP_PASSWORD`

---

## 📋 Qué Hace el Sistema

### **Cuando el Docente Hace Clic en "Evaluar Fase":**

1. **Obtiene estudiantes** con calificaciones en esa fase
2. **Para cada estudiante:**
   - Si nota < 3.5:
     - Genera/actualiza plan de mejoramiento
     - Busca indicadores no alcanzados
     - Busca plan de mejoramiento generado
   - **Envía email** con:
     - Resultados de la fase
     - Indicadores no alcanzados
     - Plan de mejoramiento (si existe)
     - O mensaje de entrega física/email (si no hay plan)
3. **Si es fase 4:**
   - También envía email con nota final
4. **Actualiza** campo `email_sent = 1` en planes enviados

---

## 📄 Estructura de los PDFs Adjuntos

### **PDF de Resultados de Fase:**
```
┌─────────────────────────────────────┐
│  [LOGO] SEIO - Sistema Evaluativo  │
│  Resultados de Evaluación Académica│
├─────────────────────────────────────┤
│ Institución Educativa: [Nombre]    │
│ Período Académico: [Período]       │
│ Docente: [Nombre]                   │
│ Materia: [Materia]                  │
├─────────────────────────────────────┤
│ DATOS DEL ESTUDIANTE:               │
│ - Nombre, Grado, Curso, Fase        │
├─────────────────────────────────────┤
│ RESULTADOS:                         │
│ - Nota Fase X: [Nota]              │
│ - Estado: [Aprobó/No Aprobó]        │
├─────────────────────────────────────┤
│ INDICADORES NO ALCANZADOS:          │
│ - [Lista de indicadores]            │
├─────────────────────────────────────┤
│ PLAN DE MEJORAMIENTO:               │
│ (Si existe: detalles completos)    │
│ (Si no: mensaje de entrega física) │
├─────────────────────────────────────┤
│ Pie de página con fecha y copyright │
└─────────────────────────────────────┘
```

### **PDF de Nota Final:**
- Similar estructura
- Incluye tabla con notas por fase
- Nota final destacada
- Estado final (Aprobó/Reprobó)

## 📧 Estructura de los Emails

### **Email de Resultados de Fase:**
- ✅ **Incluye PDF adjunto** con todos los detalles
- ✅ Nota de la fase
- ✅ Estado (Aprobó/No aprobó)
- ✅ Lista de indicadores no alcanzados
- ✅ Plan de mejoramiento (si existe) o mensaje de entrega física

### **Email de Nota Final:**
- ✅ Nota final (promedio)
- ✅ Estado final (Aprobó/Reprobó)
- ✅ Tabla con notas por fase
- ✅ Mensaje según resultado

### **Email de Plan de Mejoramiento:**
- ✅ Título y materia
- ✅ Fecha límite
- ✅ Descripción
- ✅ Actividades
- ✅ Logros no alcanzados
- ✅ Logros alcanzados

---

## 🔍 Verificar que Funciona

### **1. Verificar Configuración de Email:**
```bash
cd server
node -e "import('./utils/emailService.js').then(m => console.log('Email configurado:', m.isEmailConfigured()))"
```

### **2. Probar Envío de Email:**
```bash
# Usar un studentId real de tu base de datos
node test-email-system.js phase 30 1
```

### **3. Verificar Logs:**
- Revisar la consola del servidor para ver:
  - `✅ Email enviado a...`
  - `⚠️ Error al enviar email...`
  - `📧 [DEV] Correo de...` (en desarrollo si no hay configuración)

---

## ⚠️ Notas Importantes

1. **Emails se envían a:**
   - Email del estudiante (`users.email`)
   - Email del acudiente (`students.contact_email`)

2. **Si no hay configuración de email:**
   - En desarrollo, los datos se muestran en consola
   - En producción, se registra el error pero no se detiene el proceso

3. **El proceso es manual:**
   - El docente debe hacer clic en "Evaluar Fase"
   - No se envía automáticamente al completar cuestionarios
   - Esto permite al docente revisar antes de enviar

4. **Planes de mejoramiento:**
   - Se generan automáticamente si nota < 3.5
   - Si ya existe un plan para esa fase, se actualiza
   - El email incluye el plan si existe, o mensaje de entrega física

---

## 🐛 Solución de Problemas

### **Los emails no se envían:**
1. Verificar configuración SMTP/Gmail en `.env`
2. Verificar que los estudiantes tengan emails configurados
3. Revisar logs del servidor para ver errores específicos

### **Error de autenticación Gmail:**
- Usar "Contraseña de aplicación", no la contraseña normal
- Verificar que la verificación en 2 pasos esté activada

### **No se encuentran planes:**
- Verificar que se haya ejecutado "Evaluar Fase" primero
- Los planes se generan solo si nota < 3.5

---

## 📝 Archivos Modificados

1. **`server/utils/emailService.js`**
   - ✅ `sendPhaseResultsEmail()` - Email de resultados de fase
   - ✅ `sendFinalGradeEmail()` - Email de nota final
   - ✅ `sendImprovementPlanEmail()` - Email de plan de mejoramiento

2. **`server/services/phaseEvaluationService.js`**
   - ✅ Modificado `evaluatePhaseResults()` para enviar emails
   - ✅ Integrado envío automático al hacer clic en "Evaluar Fase"

3. **`server/test-email-system.js`** (NUEVO)
   - ✅ Script de prueba para verificar envío de emails

---

## ✅ Estado de Implementación

| Funcionalidad | Estado |
|---------------|--------|
| Email de resultados de fase | ✅ Implementado |
| Email de nota final (fase 4) | ✅ Implementado |
| Email de plan de mejoramiento | ✅ Implementado |
| Integración con proceso manual | ✅ Implementado |
| Mensaje si no hay plan | ✅ Implementado |
| Script de prueba | ✅ Implementado |

---

**¡El sistema está listo para probar!** 🎉
