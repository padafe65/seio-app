# 🔒 Protección de Datos Sensibles en GitHub

## ✅ Archivos Protegidos (NO se suben a GitHub)

Los siguientes archivos están en `.gitignore` y **NUNCA** se subirán a GitHub:

- ✅ `server/.env` - Contiene contraseñas y tokens reales
- ✅ `client/.env` - Configuración del frontend
- ✅ `CONFIGURAR_CORREO.txt` - Puede contener información sensible
- ✅ `EJEMPLO_ENV_CORREO.txt` - Ejemplos con datos
- ✅ `*.backup` - Archivos de respaldo
- ✅ `*.log` - Logs que pueden contener información
- ✅ `node_modules/` - Dependencias

## 📋 Archivos que SÍ se suben (Plantillas)

- ✅ `server/.env.example` - Plantilla sin datos reales
- ✅ `README.md` - Documentación
- ✅ Código fuente (`.js`, `.jsx`, etc.)

## 🛡️ Verificación Antes de Subir

Antes de hacer `git add` y `git commit`, verifica:

```bash
# Ver qué archivos se van a subir
git status

# Verificar que .env NO aparece
git status | findstr ".env"

# Si aparece algún .env, NO lo agregues:
git reset HEAD server/.env  # Si ya lo agregaste por error
```

## ⚠️ Si Ya Subiste un .env por Error

Si accidentalmente subiste un `.env` con datos reales:

1. **Elimínalo del repositorio:**
   ```bash
   git rm --cached server/.env
   git commit -m "Eliminar .env del repositorio"
   git push
   ```

2. **Cambia todas las contraseñas y tokens** que estaban en ese archivo

3. **Verifica el historial:**
   ```bash
   git log --all --full-history -- server/.env
   ```

## 📝 Buenas Prácticas

1. ✅ **Siempre** usa `.env.example` como plantilla
2. ✅ **Nunca** hagas commit de archivos `.env`
3. ✅ **Revisa** `git status` antes de cada commit
4. ✅ **Usa** variables de entorno para datos sensibles
5. ✅ **Documenta** qué variables se necesitan en `.env.example`

## 🔍 Comandos Útiles

```bash
# Ver qué archivos están siendo ignorados
git status --ignored

# Verificar si un archivo está en .gitignore
git check-ignore -v server/.env

# Ver qué se va a subir
git status --short
```
