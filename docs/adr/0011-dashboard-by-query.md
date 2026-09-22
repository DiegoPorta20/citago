# ADR 0011 — El dashboard se calcula por consulta

Fecha: 2026-09-21 · Estado: aceptada

## Contexto

El dueño de la barbería quiere abrir la app y ver cómo va: cuánto se cobró, qué
pasó con la agenda, cuántos clientes nuevos, qué se vende y cómo va cada
profesional. Esos números ya existen —están en `sales`, `sale_lines`,
`appointments` y `clients`—, así que la pregunta no es qué guardar, sino **de
dónde leerlo**.

La tentación habitual es crear una tabla de métricas, o materializar totales por
día. Un negocio de este tamaño hace decenas de citas diarias, no millones.

## Decisión

### Nada se precalcula

No hay tabla de dashboard, ni contadores denormalizados, ni job nocturno. Cada
número es una agregación de MySQL sobre las tablas que ya existen, ejecutada en
el momento de pedirla.

Es la opción correcta mientras el volumen lo permita: un total precalculado es
un dato que se puede quedar desincronizado, y entonces el dashboard miente sin
que nadie se entere. Una consulta no puede mentir.

Los índices ya están puestos para esto: `ix_sales_sold_at`,
`ix_sales_staff_sold_at` e `ix_appointments_start` llevan `tenant_id` y la fecha
como columnas iniciales, así que un período lee solo sus propias filas.

Cuando una consulta deje de ser barata, el camino es una vista materializada o
una tabla de resumen **detrás del mismo puerto**, sin tocar el caso de uso.

### El dashboard no lee tablas ajenas

El módulo `dashboard` no tiene dominio: no posee ninguna entidad ni ninguna
regla. Lee a través de un puerto por módulo:

```text
SalesReportQuery    → propiedad del módulo sales
AgendaReportQuery   → propiedad del módulo appointments
ClientRepository    → propiedad del módulo clients
StaffRepository     → propiedad del módulo staff
```

Son puertos **separados de los repositorios de escritura**: devuelven números,
nunca agregados. Un informe no necesita cargar una venta que no va a modificar,
y separarlos deja optimizar la lectura sin tocar el camino de escritura.

Si el dashboard acabara necesitando una regla, esa regla pertenece a quien
posee el dato, no aquí.

### Los períodos son días locales del negocio

Los parámetros son `from` y `to` como fechas `YYYY-MM-DD`, ambas inclusive, en
la **zona horaria del negocio** (regla TZ-2). `DashboardPeriod` las convierte a
instantes con `BusinessCalendar` antes de tocar SQL, y por defecto responde
«hoy» del negocio, no del servidor ni del teléfono.

Una barbería de Lima que cierra a las 20:00 no puede ver su caja de la tarde
caer en el día siguiente por trabajar en UTC.

### Dos endpoints, no un payload que cambia de forma

- `GET /dashboard/summary` — el negocio. OWNER y ADMIN.
- `GET /dashboard/me` — mis atenciones del período. Cualquier miembro.

La matriz de permisos dice que STAFF no ve el dinero del negocio pero sí sus
propias atenciones. Se podría haber hecho con un único endpoint que recorta
campos según el rol; dos endpoints explícitos dicen la verdad en la propia URL y
no obligan a leer el guard para saber qué devuelve cada uno.

`/dashboard/me` **no lleva importes**. Si un profesional debe ver los ingresos
que genera sigue siendo una decisión de producto abierta
([permissions.md](../permissions.md)), y el valor por defecto seguro es el que
no los filtra.

## Consecuencias

- Los números nunca se desincronizan de los datos: no hay dos fuentes.
- Añadir una métrica es añadir un método a un puerto, no una migración.
- El coste crece con el tamaño del período, no con la historia del negocio, y
  está acotado a 366 días por petición.
- Si algún día hace falta precalcular, el cambio queda dentro de la
  infraestructura de sales o appointments.
