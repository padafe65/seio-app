# Sistema de Imagen de Perfil - SEIO

## 📋 Descripción

Se ha implementado un sistema completo para permitir a los usuarios subir y gestionar sus imágenes de perfil.

### Cambios Realizados:

1. ✅ **Base de datos**: Agregada columna `profile_image` a tabla `users`
2. ✅ **Backend**:
   - Middleware `uploadProfileImage.js` para validar y guardar imágenes
   - Endpoint `POST /api/users/upload-profile-image` para subir imagen
   - Imágenes guardadas en `/server/uploads/profile-images/`
3. ✅ **Configuración**:
   - Express ya está configurado para servir archivos estáticos en `/uploads`
   - Las imágenes serán accesibles en: `http://localhost:5000/uploads/profile-images/...`

---

## 🚀 Pasos para Activar esta Función

### Paso 1: Ejecutar la Migración en MySQL

Abre PhpMyAdmin o tu cliente MySQL y ejecuta este SQL:

```sql
ALTER TABLE `users`
ADD COLUMN `profile_image` varchar(512) DEFAULT NULL COMMENT 'Ruta o URL de la imagen de perfil del usuario'
AFTER `updated_at`;
```

**Archivo SQL también disponible en:** `server/migrations/migration_add_profile_image.sql`

### Paso 2: Reiniciar el Servidor

```bash
cd server
npm run dev
```

### Paso 3: Probar el Endpoint

**Usando cURL:**

```bash
curl -X POST http://localhost:5000/api/users/upload-profile-image \
  -H "Authorization: Bearer {token}" \
  -F "profileImage=@/ruta/a/imagen.jpg"
```

**Usando Postman:**

1. Method: `POST`
2. URL: `http://localhost:5000/api/users/upload-profile-image`
3. Headers:
   - Authorization: `Bearer {tu_token_jwt}`
4. Body:
   - form-data
   - Key: `profileImage`, Value: seleccionar archivo de imagen
5. Send

---

## 📝 Especificaciones Técnicas

### Validaciones

- **Formatos permitidos**: JPG, PNG, WEBP
- **Tamaño máximo**: 5MB
- **Ubicación**: `/server/uploads/profile-images/`
- **Nombre archivo**: `profile_{user_id}_{timestamp}.{ext}`

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Imagen de perfil subida exitosamente",
  "data": {
    "profileImage": "/uploads/profile-images/profile_1_1739818432123.jpg",
    "fileName": "profile_1_1739818432123.jpg"
  }
}
```

### Respuestas de Error

**Error 401** (No autenticado):

```json
{
  "success": false,
  "message": "Debe estar autenticado para subir imagen"
}
```

**Error 400** (Archivo no proporcionado):

```json
{
  "success": false,
  "message": "No se proporcionó archivo de imagen"
}
```

**Error 400** (Tipo de archivo inválido):

```json
{
  "success": false,
  "message": "Solo se permiten archivos de imagen (JPG, PNG, WEBP)"
}
```

---

## 🎯 Próximos Pasos

Para completar la integración:

1. **Frontend - Componente de Upload**
   - Crear componente `ImageUploader.js` en `client/src/components/`
   - Implementar preview de imagen
   - Mostrar preview antes de subir

2. **Frontend - Mostrar Foto en Dashboard**
   - Actualizar Navigation/Header para mostrar foto de perfil del usuario
   - Crear Avatar circular con fallback a iniciales

3. **Frontend - Formulario de Registro (Opcional)**
   - Permitir subir foto durante el registro
   - O mediante botón "Editar Perfil"

4. **Frontend - Perfil de Usuario**
   - Página para ver y cambiar foto de perfil
   - Botón "Cambiar Foto"

---

## 📂 Estructura de Archivos

```
server/
├── uploads/
│   └── profile-images/          ← Las imágenes se guardan aquí
├── middleware/
│   └── uploadProfileImage.js    ← Nueva funcionalidad
├── migrations/
│   └── migration_add_profile_image.sql  ← Script SQL
└── routes/
    └── usersRoutes.js           ← Endpoint POST agregado
```

---

## ⚙️ Configuración en server.js

Ya está configurado automáticamente:

```javascript
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
```

Esto permite acceder a cualquier archivo en `/server/uploads/` desde el navegador.

---

## 🔒 Seguridad

- ✅ Validación de tipo MIME
- ✅ Validación de extensión de archivo
- ✅ Límite de tamaño (5MB)
- ✅ Autenticación requerida
- ✅ Nombres generados automáticamente (no permite sobrescribir)
- ✅ Auditoría registrada en tabla `audit_logs`

---

## 📞 Soporte

Si tienes problemas:

1. Verifica que la carpeta `/server/uploads/profile-images/` existe
2. Comprueba permisos de escritura en la carpeta
3. Revisa los logs del servidor en la consola
4. Asegúrate de que MySQL tiene la nueva columna `profile_image`

---

**Implementado**: 18 de febrero de 2026
**Versión**: 1.0
