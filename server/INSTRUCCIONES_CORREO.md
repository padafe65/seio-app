# 📧 Configuración de Correo Electrónico para Recuperación de Contraseña

## ✅ Pasos para Configurar el Envío de Correos

### Opción 1: Gmail (Recomendado para desarrollo)

1. **Activar verificación en 2 pasos:**
   - Ve a: https://myaccount.google.com/security
   - Activa "Verificación en 2 pasos"

2. **Generar App Password:**
   - Ve a: https://myaccount.google.com/apppasswords
   - Selecciona "Correo" y "Otro (nombre personalizado)"
   - Escribe "SEIO" y haz clic en "Generar"
   - **Copia la contraseña de 16 caracteres** (sin espacios)

3. **Agregar al archivo `.env`:**
   ```env
   # Opción A: Usando SMTP
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=tu_correo@gmail.com
   SMTP_PASS=tu_app_password_de_16_caracteres
   SMTP_FROM=noreply@seio.com

   # Opción B: Usando configuración directa de Gmail
   GMAIL_USER=tu_correo@gmail.com
   GMAIL_APP_PASSWORD=tu_app_password_de_16_caracteres
   ```

### Opción 2: Outlook/Hotmail

1. **Agregar al archivo `.env`:**
   ```env
   SMTP_HOST=smtp-mail.outlook.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=tu_correo@outlook.com
   SMTP_PASS=tu_contraseña_normal
   SMTP_FROM=noreply@seio.com
   ```

### Opción 3: Otros Servicios SMTP

Consulta la documentación de tu proveedor de correo para obtener:
- `SMTP_HOST`: servidor SMTP
- `SMTP_PORT`: puerto (generalmente 587 o 465)
- `SMTP_SECURE`: true para 465, false para 587
- `SMTP_USER`: tu correo
- `SMTP_PASS`: tu contraseña o app password

## 🔧 Configuración en el archivo `.env`

Abre el archivo `server/.env` y agrega las siguientes variables:

```env
# URL del Frontend (para los links de recuperación)
FRONTEND_URL=http://localhost:3000

# Configuración SMTP (elige una opción)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_app_password
SMTP_FROM=noreply@seio.com
```

## ✅ Verificar Configuración

Después de configurar, reinicia el servidor y prueba:

1. Ve a: `http://localhost:3000/reset-password`
2. Ingresa un correo registrado
3. Revisa tu bandeja de entrada (y spam)

## 🐛 Solución de Problemas

### El correo no llega:
- ✅ Verifica que las variables estén en `.env`
- ✅ Reinicia el servidor después de cambiar `.env`
- ✅ Revisa la carpeta de spam
- ✅ Para Gmail, asegúrate de usar App Password (no tu contraseña normal)
- ✅ Verifica los logs del servidor para errores

### Error de autenticación:
- ✅ Gmail requiere App Password, no la contraseña normal
- ✅ Outlook puede requerir habilitar "Aplicaciones menos seguras" (no recomendado)
- ✅ Verifica que el usuario y contraseña sean correctos

## 📝 Notas

- En **desarrollo**, si no hay configuración de correo, el link aparecerá en la consola del servidor
- En **producción**, siempre configura el correo para que funcione correctamente
- Los links de recuperación expiran en **1 hora**
