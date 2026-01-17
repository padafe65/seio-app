# 🚀 Guía de Inicio Rápido - SEIO

## Inicio Automático con Auto-Reload

### Método 1: Usar el Script de Inicio (Más Fácil - Windows)
```bash
# Desde la raíz del proyecto:
start-dev.bat
```

Esto abrirá dos ventanas separadas, una para el backend y otra para el frontend.

### Método 2: Iniciar Manualmente

#### Terminal 1 - Backend:
```bash
cd server
npm run start:dev
```
o
```bash
cd server
npm run dev
```

El backend se reiniciará automáticamente cuando detecte cambios en:
- `server.js`
- Archivos en `routes/`, `controllers/`, `middleware/`, `config/`
- Cualquier archivo `.js` o `.json`

#### Terminal 2 - Frontend:
```bash
cd client
npm start
```

El frontend se recarga automáticamente en el navegador cuando detecta cambios (Hot Module Replacement).

## ⚠️ Notas Importantes:

1. **Backend**: 
   - Usa `nodemon` para auto-reinicio
   - Si cambias archivos de configuración o nuevas rutas, se reinicia automáticamente
   - Los cambios se ven inmediatamente sin reiniciar manualmente

2. **Frontend**:
   - React tiene hot-reload por defecto
   - Los cambios se reflejan automáticamente en el navegador
   - No necesitas recargar manualmente la página (a menos que cambies configuración de webpack)

3. **Reinicio manual necesario solo si**:
   - Instalas nuevas dependencias (`npm install`)
   - Cambias variables de entorno (`.env`)
   - Cambias configuración de `package.json`

## 🔧 Solución de Problemas:

Si el auto-reload no funciona:

**Backend:**
- Verifica que estés usando `npm run start:dev` o `npm run dev`
- Asegúrate de que `nodemon` esté instalado: `npm install` en la carpeta `server`

**Frontend:**
- Asegúrate de usar `npm start` (no `npm run build`)
- El navegador debería abrirse automáticamente en `http://localhost:3000`
