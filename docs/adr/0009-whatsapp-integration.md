# ADR 0009 — Integración con WhatsApp (Cloud API de Meta)

- Fecha: 2026-09-18
- Estado: aceptada

## Contexto

WhatsApp es el primer canal. Hay que recibir mensajes de Meta, identificar a
qué negocio pertenecen, responder desde CitaGo y guardar la credencial de cada
negocio sin exponerla, todo sin que Meta aparezca en el dominio.

## Decisiones

### 1. Un adaptador aislado en dos módulos

| Módulo | Contenido | Depende de |
|---|---|---|
| `WhatsAppModule` | Número conectado, cliente de la Graph API, `ChannelMessenger` (envío) | — |
| `WhatsAppWebhookModule` | Webhook, firma, traducción del payload | `WhatsAppModule`, `ConversationsModule` |

Conversaciones define el puerto `ChannelMessenger` y WhatsApp lo implementa.
Separar el webhook evita un ciclo: Conversaciones necesita el envío y el
webhook necesita Conversaciones. **Nada fuera de `modules/whatsapp` conoce
`phone_number_id`, `wamid`, `entry/changes` ni el token.**

### 2. Entrada: firma primero, tenant después (CO-5)

1. `X-Hub-Signature-256` = HMAC-SHA256 del **cuerpo crudo** con el app secret,
   comparado en tiempo constante. Se verifica en un guard, antes de leer el
   payload y antes de tocar la base de datos. Sin firma válida → 401.
2. Recién con la firma válida, `metadata.phone_number_id` decide el negocio
   (`UNIQUE(phone_number_id)` global).
3. El payload se traduce a `WhatsAppInboundMessage` y entra por
   `RecordInboundMessageUseCase`, el mismo camino del simulador.

Qué pasa con cada entrega:

| Caso | Respuesta | Motivo |
|---|---|---|
| Mensaje nuevo | 200 | — |
| Mensaje repetido | 200 | Idempotencia por `wamid` (CO-2) |
| Número que nadie conectó | 200, se ignora | Un reintento no lo arreglaría |
| Recibos de estado, reacciones | 200, se ignoran | No son mensajes nuevos; una reacción no debe marcar pendiente |
| Contenido inválido | 200, se ignora | Igual que arriba |
| Error nuestro (base caída) | 500 | Meta reintenta; la idempotencia absorbe las repeticiones |

El procesamiento es **síncrono**. Una cola (BullMQ) queda para cuando el
volumen lo pida: el único punto de entrada ya es idempotente, así que moverlo
detrás de una cola no cambia la semántica.

El webhook queda fuera del rate limit global: Meta entrega desde pocas IPs y
una entrega limitada es un mensaje de cliente demorado. Sin firma válida no se
hace ningún trabajo.

### 3. Salida: enviar, y después registrar

`POST /conversations/:id/messages`:

1. Valida el texto y la **ventana de 24 horas** (CO-10) antes de llamar a Meta.
2. Envía **fuera de la transacción**: bloquear la fila de la conversación
   mientras se espera a Meta frenaría los mensajes entrantes de ese chat.
3. Registra el mensaje `OUTBOUND` con el `wamid` como clave de idempotencia.

Si Meta falla, no se registra nada (502 `MESSAGE_DELIVERY_FAILED`, con
`reason` `CHANNEL_AUTH`, `REJECTED` o `UNAVAILABLE`). Si Meta acepta pero la
base falla justo después, el cliente recibió el mensaje y la bandeja no lo
muestra; se registra en el log. Es el mal menor frente a mostrar un mensaje que
nunca salió.

Fuera de la ventana, Meta solo acepta **plantillas aprobadas**. Las plantillas
no están en el MVP: la API responde 422 `REPLY_WINDOW_CLOSED`.

### 4. Conexión manual del número (D2 queda para después)

El OWNER o ADMIN pega el `phone_number_id` y un token permanente (system
user). Antes de guardar, CitaGo **consulta el número en Meta con ese token**:

- confirma que las credenciales sirven;
- impide que un negocio "reclame" un número ajeno para desviar sus mensajes.

Conectar de nuevo reemplaza número y token. Desconectar **borra el token** y
conserva conversaciones y mensajes. El Embedded Signup de Meta (D2)
reemplazará la carga manual sin cambiar lo que se guarda.

### 5. El token, cifrado con AES-256-GCM

- Puerto `SecretCipher` en `shared`; implementación `AesGcmSecretCipher`.
- Clave: `ENCRYPTION_KEY` (32 bytes en base64). La API no arranca sin ella.
- Formato: `[versión][IV aleatorio 12][tag 16][cifrado]` en `VARBINARY`.
- **Contexto autenticado** `whatsapp:{tenantId}:{phoneNumberId}`: un token
  cifrado que se copie a otra fila no se puede descifrar.
- El token solo se descifra para una llamada a Meta. Nunca se devuelve por la
  API ni se escribe en logs. Los errores de Meta llevan su código, nunca el
  request.

### 6. Números de teléfono

El `wa_id` de Meta (dígitos sin `+`) se normaliza con `PhoneNumber` para que
coincida con los clientes cargados a mano. Los móviles mexicanos llegan con el
`1` heredado (`521…`) y se normalizan a `+52…`.

**Limitación conocida:** los móviles argentinos llegan con el `9` (`549…`), y un
número cargado sin él queda como `54…`. Esos contactos se vinculan a mano
(CO-6).

## Consecuencias

- `findByPhoneNumberId` es la excepción documentada al acceso por tenant
  ([ADR 0004](./0004-tenant-isolation.md)), y solo se usa después de verificar
  la firma.
- Perder `ENCRYPTION_KEY` obliga a reconectar cada número; filtrarla expone los
  tokens. La clave vive en el gestor de secretos, no junto a los backups.
- Los tests usan un Graph API falso sobre HTTP real (`test/support/fake-graph-api.ts`),
  así que el adaptador real (fetch, headers, mapeo de errores) queda probado
  sin credenciales de Meta.
- Pendiente: plantillas, descarga de media, recibos de lectura, Embedded Signup
  y la cola para el webhook.
