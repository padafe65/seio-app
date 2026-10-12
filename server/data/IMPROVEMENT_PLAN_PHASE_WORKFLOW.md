# Planes de mejoramiento al cerrar una fase

## Funcionamiento

- La asignación manual de planes por estudiante permanece disponible.
- En **Evaluación de Fase**, el docente puede preparar una plantilla por curso y fase. Puede seleccionar varios cursos del mismo grado para guardar la misma plantilla en sus grupos.
- Al confirmar la evaluación, cada estudiante con definitiva inferior a 3.50 recibe un plan individual. El plan incorpora el contenido de la plantilla, la nota definitiva, actividades estándar de apoyo y los indicadores no alcanzados que tengan evidencia evaluada.
- Si no hay preguntas/cuestionarios asociados a indicadores, la evaluación lo informa y el sistema no inventa indicadores.
- Las ediciones manuales quedan protegidas frente a actualizaciones posteriores del cálculo de fase.
- Los resultados de fase y el plan continúan usando las notificaciones de correo que ya tiene el flujo.
- El estudiante entrega texto y/o un enlace desde el detalle de su plan. El docente puede dejarlo en revisión, pedir correcciones o aprobarlo. La entrega se almacena aparte de los enlaces de recursos del plan.

## Base de datos de pruebas

La migración crea `phase_improvement_plan_templates` y agrega campos de entrega a `improvement_plans`. Desde PowerShell:

```powershell
cd G:\seio\server
$env:DB_NAME = 'seio_db_pruebas'
npm run migrate:phase-improvement-plan-templates
```

El script se detiene si la conexión no apunta a `seio_db_pruebas`. La base `seio_db` de producción requiere una revisión y aplicación separada de la migración SQL después de validar en pruebas.
