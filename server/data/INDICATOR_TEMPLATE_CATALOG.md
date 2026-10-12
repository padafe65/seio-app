# Catálogo de plantillas de indicadores

El catálogo separa las propuestas compartidas de los indicadores que cada docente aplica y edita.

## Trazabilidad y uso de fuentes

- Los paquetes publicados deben contener redacción propia de SEIO. No se copian preguntas, ejemplos ni bloques de texto de MEN o ICFES.
- `indicator_template_sources` conserva la entidad, el enlace, la versión consultada y el estado de uso revisado.
- `indicator_template_item_sources` relaciona cada indicador con sus fuentes y describe si la relación es de autoría interna, alineación conceptual, adaptación autorizada o cita.
- Las fuentes oficiales precargadas son referencias para consulta. No conceden permiso para reproducir su contenido.
- El catálogo legado se importa como propuesta interna pendiente de revisión. No se declara alineado con MEN o ICFES hasta revisar y documentar la fuente concreta.

## Alcance educativo

Cada paquete lleva nivel educativo, marco de evaluación y un grado/semestre o el alcance `general`. La interfaz muestra el alcance general de forma explícita y separa escuela de educación superior. Un curso debe tener clasificado su nivel antes de que se le aplique una plantilla.

`courses.grade` se conserva por compatibilidad. `courses.education_level` indica la etapa; el número de grado o semestre no se usa por sí solo para inferir si un curso es escolar o universitario. `indicators.grade_label` conserva esa etiqueta para las copias aplicadas.

## Base de datos de prueba

Desde `server`, configura la conexión de modo que `SELECT DATABASE()` devuelva exactamente `seio_db_pruebas` y ejecuta:

```powershell
npm run migrate:indicator-template-catalog
npm run seed:indicator-template-catalog
```

Ambos scripts se niegan a operar si la conexión apunta a otra base. El primero crea las tablas de catálogo y agrega los campos de nivel necesarios; el segundo copia el catálogo legado existente de `subjectTemplates.js`. Son idempotentes y no eliminan registros.

La migración también crea `questionnaire_indicator_reminders`, que guarda los avisos únicos para cuestionarios sin indicadores. Si ya habías ejecutado estos scripts antes de esta actualización, vuelve a ejecutar `npm run migrate:indicator-template-catalog` desde `server`; `CREATE TABLE IF NOT EXISTS` conserva las tablas y los datos existentes.

Para recalcular las evaluaciones del año actual y actualizar los planes ligados a cuestionarios, ejecuta `npm run reconcile:indicator-results` desde `server`. El script también rechaza cualquier base distinta de `seio_db_pruebas`. Revisa el resultado antes de pasar cambios a producción.

No ejecutes estos scripts contra `seio_db` hasta revisar la experiencia en pruebas, respaldar producción y planear su migración por separado.
