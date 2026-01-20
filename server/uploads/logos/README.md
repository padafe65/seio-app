# 📷 Logo para PDFs - SEIO

## 📍 Ubicación del Logo

El logo debe colocarse en esta carpeta con el nombre exacto: **`logo.png`**

Ruta completa: `server/uploads/logos/logo.png`

## 📐 Especificaciones del Logo

### Formato
- **Formato:** PNG (recomendado) o JPG
- **Nombre del archivo:** `logo.png` (exacto, sin espacios ni mayúsculas)
- **Tamaño recomendado:** 
  - Ancho: 200-400 píxeles
  - Alto: 200-400 píxeles
  - Proporción: Cuadrada (1:1) o rectangular vertical

### Características
- **Fondo:** Transparente (PNG) o blanco
- **Resolución:** Mínimo 200x200 píxeles, recomendado 300x300 o superior
- **Peso del archivo:** Menor a 500 KB (para mejor rendimiento)

## 🖼️ Cómo Agregar el Logo

1. **Preparar el logo:**
   - Asegúrate de que el logo esté en formato PNG o JPG
   - Si es necesario, redimensiona a las dimensiones recomendadas
   - Si tiene fondo, considera hacerlo transparente

2. **Colocar el archivo:**
   - Copia el archivo del logo
   - Pégalo en esta carpeta: `server/uploads/logos/`
   - Renómbralo a: `logo.png` (si tiene otro nombre)

3. **Verificar:**
   - El archivo debe estar en: `server/uploads/logos/logo.png`
   - El nombre debe ser exactamente `logo.png` (sin espacios, sin mayúsculas)

## ⚠️ Notas Importantes

- Si el logo no existe, el PDF se generará sin logo (no causará error)
- El logo aparecerá en la esquina superior izquierda del PDF
- El tamaño del logo en el PDF es de 80x80 puntos (aproximadamente 2.8x2.8 cm)
- Si necesitas cambiar el tamaño del logo en el PDF, modifica `server/utils/pdfGenerator.js`

## 🔄 Actualizar el Logo

Para cambiar el logo:
1. Reemplaza el archivo `logo.png` en esta carpeta
2. Mantén el mismo nombre: `logo.png`
3. No es necesario reiniciar el servidor (se carga dinámicamente)

## 📝 Ejemplo de Estructura

```
server/
  uploads/
    logos/
      logo.png          ← Tu logo aquí
      README.md         ← Este archivo
```

---

**Nota:** Si no colocas un logo, el PDF se generará correctamente pero sin logo en el encabezado.
