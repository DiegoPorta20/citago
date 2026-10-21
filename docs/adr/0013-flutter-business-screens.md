# ADR 0013 — Pantallas de negocio de la app: clientes, agenda, ventas y conversaciones

- Fecha: 2026-10-20
- Estado: aceptada

## Contexto

Con la base de [ADR 0012](./0012-flutter-app-foundation.md) (sesión, red, rutas)
faltaban las secciones que usa el negocio a diario. Este ADR recoge las
decisiones que no se desprenden solas del backend.

## Decisiones

### 1. Hora del negocio, nunca la del teléfono

Se incorpora el paquete `timezone` (base de datos IANA). `BusinessClock`
(`core/time`) es el **único** lugar que convierte entre instantes UTC y el
calendario del negocio, igual que `BusinessCalendar` en el backend
([ADR 0007](./0007-agenda-concurrency-and-time.md)):

- "Hoy" y los rangos de un día (`dayRangeUtc`) se calculan en la zona del tenant.
- Las citas y los mensajes se muestran en esa zona; un barbero de viaje sigue
  viendo las 09:00 de Lima como 09:00.
- Verificado con el cambio de horario de Madrid (el día dura 23 horas).

La zona sale de `/auth/me` (`tenant.timezone`) y se expone con
`businessClockProvider`.

### 2. Cada feature publica sus rutas

Cada feature exporta `List<RouteBase> <feature>Routes` y una clase `*Routes` con
helpers de ruta. El router solo monta las listas en la rama de su pestaña. Las
pantallas secundarias (detalle, formulario, reagendar, cobrar) son hijas de la
raíz de su pestaña, así que la barra inferior sigue visible.

### 3. Errores: código → mensaje en español, `details` estructurados

`AppFailure` conserva `code` y `details`. Los mensajes viven en una única tabla
por código de error de la API; el texto del backend nunca se muestra. Los
`details` permiten flujos como "ese teléfono ya existe → abrir cliente" o
"hay un cliente eliminado con ese teléfono → restaurar" (solo OWNER/ADMIN).

### 4. Paginación

`Paged<T>` modela `{ data, meta }`. Clientes y bandeja pagan por página con
scroll infinito; el historial de un chat pagina por **cursor** (`before`) hacia
arriba ([ADR 0008](./0008-conversations-model.md)). Un selector de cliente
(`pickClient`) reutilizable sirve a Agenda y a Conversaciones.

### 5. Agenda y cobro

- Las acciones de una cita se calculan desde el estado (`ALLOWED_TRANSITIONS` del
  backend replicadas en la app); la autoridad sigue siendo el servidor.
- Reservar usa los huecos de `GET /appointments/availability`, que son
  orientativos: si otro se adelanta, el `409 APPOINTMENT_OVERLAP` se muestra tal
  cual.
- "Cobrar" registra la venta de una cita `COMPLETED` con `appointmentId`: el
  servidor toma cliente, profesional y línea al precio pactado. El descuento se
  valida en céntimos enteros (`Money`) y **el total nunca se envía**
  ([ADR 0010](./0010-sales-and-money.md)).

### 6. Conversaciones

- "Pendientes" = `OPEN` + `needsReply`; el contador de la pestaña y del dashboard
  sale de `meta.total` de esa misma consulta.
- La ventana de 24 h se estima con el último mensaje entrante cargado para
  deshabilitar el campo de respuesta, pero la autoridad es `REPLY_WINDOW_CLOSED`.
- Ante un fallo de envío el texto escrito se conserva para reintentar.

### 7. Registro

Un negocio se crea desde la app con un país de una lista revisada: elegirlo fija
país, moneda y zona horaria a la vez, porque la moneda no se puede cambiar
después (regla BU-1) y la zona gobierna toda la agenda.

### 8. Administración desde la pestaña "Más"

Servicios, profesionales, equipo, negocio, WhatsApp y ventas viven bajo
`/mas/...`, con la barra inferior visible. El menú muestra solo lo que el rol
puede usar (docs/permissions.md); la autoridad sigue siendo el servidor.

- **Secretos de un solo uso:** la contraseña temporal de un alta y el token de
  WhatsApp solo existen en el estado local del diálogo/formulario. No se
  persisten, no se registran y se limpian al cerrar o tras enviar. El token no
  se vuelve a mostrar nunca.
- **Autoprotección en la interfaz:** no se ofrece cambiarse el rol ni
  revocarse a uno mismo (ID-7), ni quitar al último OWNER (ID-1), y un ADMIN no
  ve los roles ADMIN/OWNER. El servidor también lo rechaza.
- **Moneda de solo lectura:** la moneda del negocio se muestra pero no se edita
  (BU-1).
- **Ausencias:** se eligen en la zona del negocio y se envían como UTC; la
  pantalla avisa de que no cancelan citas existentes (AP-19).
- **Ventas:** la lista usa el día del negocio; los totales se suman en céntimos
  enteros. Anular y reembolsar exigen motivo y son solo de OWNER/ADMIN.

### 9. Cambio de negocio

Quien tiene acceso a más de un negocio ve "Cambiar de negocio" en Más
(`GET /auth/tenants`). Elegir uno llama a `POST /auth/switch-tenant`, guarda el
par de tokens nuevo y **reinicia todo el árbol de la app** (`AppRestart`): el
estado en memoria pertenece al negocio anterior y ninguna parte debe sobrevivir.
Ver [ADR 0006](./0006-session-and-authorization.md).

## Pendiente

- Recuperación de contraseña: necesita proveedor de correo (decisión B9) y
  endpoints en el backend.
- Plantillas de WhatsApp (fuera de la ventana de 24 h), media y Embedded Signup.
- Vincular un profesional con una cuenta de usuario desde su formulario (hoy
  solo por API).
- Pruebas de integración contra el backend real (`integration_test`) y la
  ejecución del e2e de `switch-tenant`, que requiere el contenedor MySQL de
  tests.