# ADR 0008 — Modelo de conversaciones e ingreso idempotente de mensajes

- Fecha: 2026-09-18
- Estado: aceptada (el propietario delegó las decisiones F10, F11, D1 y CO-6)

## Decisiones

### 1. Dos hechos independientes, no cuatro estados (F10)

| Campo | Valores | Quién lo cambia |
|---|---|---|
| `status` | `OPEN`, `ARCHIVED` | Una persona archiva; un mensaje entrante reabre |
| `needs_reply` | booleano | Entrante → `true`; saliente o "marcar resuelta" → `false` |

La especificación proponía `OPEN / PENDING / RESOLVED / ARCHIVED`. Esos estados
mezclan "¿está en la bandeja?" con "¿falta responder?", y obligan a recordar en
cada camino que un mensaje nuevo mueve `RESOLVED` a `PENDING`. Separados, cada
regla vive en un único método de `Conversation`. `needs_reply` es indexable, así
que el contador de pendientes del dashboard es un `COUNT` directo.

### 2. Mensajes fuera de orden

WhatsApp no garantiza el orden de entrega. Por eso:

- la vista previa y `last_message_at` solo avanzan con un mensaje **más nuevo**;
- un entrante viejo que llega tarde no vuelve a marcar pendiente una
  conversación ya respondida;
- el historial se ordena por `sent_at` (hora del canal), no por la de llegada.

### 3. Un hilo por contacto y canal (F11)

`UNIQUE(tenant_id, channel, contact_identifier)`. WhatsApp es una conversación
continua, no un sistema de tickets.

### 4. Ingreso idempotente y concurrente

`RecordInboundMessageUseCase` es el **único** punto de entrada de mensajes de
cualquier canal:

- **Duplicados:** `UNIQUE(external_message_id)`, **global**. Se inserta y se
  captura el error de clave duplicada; no se consulta antes. Verificado: 5 copias
  simultáneas del mismo webhook guardan 1 mensaje.
- **Primer mensaje concurrente de un contacto nuevo:** la clave única de la
  conversación decide quién la crea; los demás cargan la ganadora. Verificado:
  5 mensajes simultáneos → 1 conversación, 5 mensajes, ninguna actualización
  perdida.
- **Toda escritura bloquea la fila** (`SELECT … FOR UPDATE`): archivar y recibir
  un mensaje al mismo tiempo no se pisan.

### 5. Clientes desconocidos (CO-6)

Un número que no es cliente deja la conversación **sin vincular**; nunca crea un
cliente automáticamente (el spam y los números equivocados llenarían la lista).
La conversación se vincula sola en cuanto ese número exista como cliente, o a
mano con `PUT /conversations/:id/client`.

### 6. Responder desde CitaGo (D1)

El modelo asume que se responde desde la app (el envío llega en la Fase 8), pero
funciona igual si se responde desde el celular: "marcar resuelta" apaga el
pendiente y, con la coexistencia de WhatsApp Business, los ecos de mensajes
salientes pueden ingresar como `OUTBOUND` por el mismo camino.

### 7. Simulador para desarrollo

`POST /conversations/simulate-inbound` llama al **mismo caso de uso** que usará el
webhook, para construir la bandeja y la app antes de la aprobación de Meta. Solo
existe con `DEV_TOOLS_ENABLED=true` (por defecto `false`); si no, responde 404.

## Consecuencias

- El tenant de un mensaje entrante no viene del JWT sino del adaptador del
  canal, que lo resuelve desde una fuente verificada. Es una de las excepciones
  documentadas en [ADR 0004](./0004-tenant-isolation.md).
- El historial de mensajes se pagina por cursor (`before`), no por número de
  página: un chat crece mientras alguien lo recorre.
