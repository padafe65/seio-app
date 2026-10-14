# Planes de mejoramiento al cerrar una fase

## Funcionamiento

- La asignación manual de planes por estudiante permanece disponible.
- En **Evaluación de Fase**, el docente puede preparar una plantilla por curso y fase. Puede seleccionar varios cursos del mismo grado para guardar la misma plantilla en sus grupos.
- Al confirmar la evaluación, cada estudiante con definitiva inferior a 3.50 recibe un plan individual. El plan incorpora el contenido de la plantilla, la nota definitiva, actividades estándar de apoyo y los indicadores no alcanzados que tengan evidencia evaluada.
- Si no hay preguntas/cuestionarios asociados a indicadores, la evaluación lo informa y el sistema no inventa indicadores.
- Las ediciones manuales quedan protegidas frente a actualizaciones posteriores del cálculo de fase.
- Los resultados de fase y el plan continúan usando las notificaciones de correo que ya tiene el flujo.
- El docente publica primero el PDF del plan y el estudiante entrega obligatoriamente su solución en PDF. Los archivos se sirven mediante rutas autenticadas y cada intento queda en `improvement_plan_submissions`.
- Los avisos de resultados y nota final registran destinatarios, estado, intentos y fecha en `improvement_email_notifications`; un aviso exitoso no se reenvía al recalcular la misma fase y año académico.

## Base de datos de pruebas

La migración crea `phase_improvement_plan_templates` y agrega campos de entrega a `improvement_plans`. Desde PowerShell:

```powershell
cd G:\seio\server
$env:DB_NAME = 'seio_db_pruebas'
npm run migrate:phase-improvement-plan-templates
```

El script se detiene si la conexión no apunta a `seio_db_pruebas`. La base `seio_db` de producción requiere una revisión y aplicación separada de la migración SQL después de validar en pruebas.

- La entrega física es opcional y se configura por plan. Al publicarse el PDF, SEIO intenta avisar por correo y el dashboard muestra los planes pendientes de asignación o publicación.
- La promoción final usa definitiva >= 3.0. Entre 3.0 y menos de 3.5 el estudiante aparece promovido y recibe recomendación de refuerzo; la recuperación de fase conserva el umbral 3.5.

Migración de archivos e historial para pruebas:

```powershell
cd G:\seio\server
$env:DB_NAME = 'seio_db_pruebas'
npm run migrate:improvement-plan-files
```
