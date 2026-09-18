# ADR 0007 — Agenda: concurrencia, disponibilidad y zona horaria

- Fecha: 2026-09-18
- Estado: aceptada

## Contexto

La agenda es la parte del sistema donde un error cuesta más: una doble reserva
significa dos clientes esperando al mismo barbero, y un error de zona horaria
mueve todas las citas una hora. La especificación pedía evitar solapamientos
también bajo concurrencia.

## Decisiones

### 1. Bloqueo pesimista por profesional

MySQL no tiene restricciones de exclusión por rango, así que "comprobar que el
hueco está libre y luego insertar" no es seguro: dos peticiones leen "libre"
antes de que ninguna escriba.

Cada reserva, reagendamiento o reactivación:

```text
BEGIN
  SELECT … FROM staff_members WHERE tenant_id = ? AND id = ? FOR UPDATE
  leer las citas del profesional que se cruzan con el rango
  AppointmentOverlapPolicy (dominio puro) decide
  INSERT / UPDATE
COMMIT
```

- El bloqueo solo afecta al profesional involucrado: dos barberos distintos
  nunca se esperan (verificado en e2e).
- Al mover una cita entre dos barberos se bloquean ambos **en orden fijo**,
  para que dos movimientos opuestos no se bloqueen mutuamente.
- `TypeOrmTransactionRunner` reintenta hasta 3 veces ante un deadlock de InnoDB
  (1213): la transacción se revierte entera, así que repetirla es seguro.
- El bloqueo vive en el módulo `staff` (dueño de la tabla) y `appointments` lo
  usa por el puerto `StaffAgendaLock`.

**Verificado:** 10 reservas simultáneas al mismo hueco producen exactamente
1 cita y 9 respuestas `409 APPOINTMENT_OVERLAP`, de forma estable.

Alternativas descartadas: `FOR UPDATE` sobre el rango de citas (depende de gap
locks, propenso a deadlocks), tabla de slots con clave única (granularidad
fija), bloqueo optimista (reintentos en hora punta), `GET_LOCK()` (es por
conexión y convive mal con el pool).

### 2. Qué bloquea la agenda

`PENDING`, `CONFIRMED`, `ARRIVED`, `IN_PROGRESS` y **`COMPLETED`** bloquean;
`CANCELLED` y `NO_SHOW` liberan el hueco. La decisión vive en el dominio
(`isBlocking`), no en la consulta SQL: el repositorio devuelve todas las citas
del rango y la política filtra.

Consecuencia: `NO_SHOW → COMPLETED` vuelve a ocupar tiempo, así que esa
transición repite la verificación de solapamiento bajo el bloqueo (el hueco
pudo darse a otro cliente).

### 3. Disponibilidad: horario semanal + ausencias (opción B)

- **Horario semanal** por profesional, en **hora local del negocio** (`TIME`),
  con varios tramos por día para el descanso. "Abrimos a las 09:00" no se
  mueve con el horario de verano.
- **Ausencias** como rangos de instantes UTC (vacaciones, un día libre).
- Una cita debe caber entera en un tramo, no cruzarse con una ausencia y
  empezar y terminar el mismo día local.
- OWNER y ADMIN pueden forzar una reserva fuera de horario, en una ausencia o
  en el pasado (`allowOutsideSchedule`). **Nunca** sobre otra cita.
- `GET /appointments/availability` calcula huecos cada 15 minutos. Es
  orientativo: la garantía solo existe al reservar, bajo el bloqueo.

### 4. Zona horaria

`BusinessCalendar` (con `luxon`) es el único lugar que convierte entre la hora
local del negocio y UTC. Verificado con el cambio de horario de Madrid: el día
del cambio dura 23 horas y "09:00" sigue siendo 09:00 local.

## Consecuencias

- Una consulta por clave primaria extra por reserva (el bloqueo).
- Añadir una ausencia no cancela las citas que ya caen dentro: es una
  conversación con cada cliente, no un efecto automático.
- Cambiar el servicio de una cita no es un reagendamiento: se cancela y se
  reserva otra, para que el historial muestre lo acordado cada vez.
