# Reglas de negocio

Registro único de las reglas del dominio. Se actualiza **en la misma PR** que
implementa o descubre una regla.

Estado: `✔` implementada y testeada · `◻` acordada, pendiente de implementar ·
`?` pendiente de decisión del propietario del producto.

## Multi-tenancy

| # | Regla | Estado |
|---|---|---|
| MT-1 | Un cliente, servicio, profesional, cita, venta, conversación o mensaje pertenece a exactamente un tenant | ◻ |
| MT-2 | Ninguna operación acepta `tenantId` del cliente: sale siempre del contexto autenticado | ✔ |
| MT-3 | Una cita no puede referenciar cliente, servicio ni profesional de otro tenant (garantizado por claves foráneas compuestas) | ◻ mecanismo validado en integración |
| MT-4 | Un recurso de otro tenant responde `404`, nunca `403` | ◻ |

## Identidad

Matriz de permisos por rol: [permissions.md](./permissions.md).

| # | Regla | Estado |
|---|---|---|
| ID-1 | Todo tenant conserva al menos un OWNER activo | ✔ al registrarse (la baja del último OWNER se implementa con la gestión de usuarios) |
| ID-2 | Las contraseñas se guardan con hash (argon2id), nunca en texto plano ni en el JWT | ✔ |
| ID-3 | El rol se valida contra la membresía en cada request, no se confía en el claim del token | ✔ |
| ID-5 | Un mensaje de error de login nunca revela si el email existe | ✔ |
| ID-6 | Una sesión deja de servir en cuanto se revoca la membresía o se suspende el negocio | ✔ |
| ID-4 | El refresh token rota en cada uso; reutilizar uno rotado revoca toda la familia | ✔ |

## Catálogo

| # | Regla | Estado |
|---|---|---|
| CA-1 | `duration_minutes > 0` (y como máximo 720) | ✔ entidad + CHECK |
| CA-2 | `price >= 0` | ✔ `Money` + CHECK |
| CA-3 | Un servicio con historial no se elimina: se desactiva | ✔ no existe endpoint DELETE |
| CA-5 | Dos servicios activos del mismo negocio no pueden compartir nombre (sin distinguir mayúsculas ni acentos); un servicio desactivado libera el nombre | ✔ |
| CA-6 | El dinero viaja como string decimal y se opera en céntimos enteros | ✔ `Money` |
| CA-4 | Un servicio `INACTIVE` no admite citas nuevas; las existentes se conservan | ◻ |

## Clientes

| # | Regla | Estado |
|---|---|---|
| CL-1 | El teléfono se normaliza a E.164 antes de persistirse | ◻ |
| CL-2 | `UNIQUE(tenant_id, phone_e164)`; el teléfono es opcional | ◻ |
| CL-3 | El borrado es lógico (`deleted_at`); el historial se conserva | ◻ |
| CL-4 | Un cliente borrado que vuelve se restaura, no se duplica | ? |
| CL-5 | `total_visits` y `total_spent` se calculan, no se almacenan | ◻ |

## Citas

| # | Regla | Estado |
|---|---|---|
| AP-1 | `end_at > start_at`; `end_at` se calcula al reservar con la duración del servicio | ◻ |
| AP-2 | La cita guarda el precio aplicado como snapshot; cambiar el precio del servicio no altera citas existentes | ◻ |
| AP-3 | Un profesional no puede tener dos citas activas solapadas. Rangos semiabiertos: 10:00–11:00 y 11:00–12:00 **no** se solapan | ◻ |
| AP-4 | Bloquean disponibilidad: `PENDING`, `CONFIRMED`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`. No bloquean: `CANCELLED`, `NO_SHOW` | ? |
| AP-5 | La validación de solapamiento ocurre en el backend, dentro de una transacción con bloqueo de la fila del profesional | ◻ |
| AP-6 | Transiciones válidas: ver [ADR pendiente / Parte 3 §6]. `ARRIVED` e `IN_PROGRESS` son opcionales: se puede completar directamente | ? |
| AP-7 | `COMPLETED`, `CANCELLED` y `NO_SHOW` son terminales. Excepción: `NO_SHOW → COMPLETED` (el cliente llegó tarde) | ? |
| AP-8 | Solo se reagendan citas en estado no terminal, revalidando el solapamiento | ◻ |
| AP-9 | Un `NO_SHOW` no representa servicio prestado y no puede generar venta | ◻ |
| AP-10 | Toda transición se registra con autor y momento | ? |

## Ventas

| # | Regla | Estado |
|---|---|---|
| SA-1 | El dinero usa `DECIMAL(12,2)`; nunca coma flotante | ✔ `Money` (máx. 9999999999.99) |
| SA-2 | `total = subtotal - discount` y `discount <= subtotal` | ◻ |
| SA-3 | Una cita genera como máximo una venta, y solo si está `COMPLETED` | ◻ |
| SA-4 | Una venta no se edita ni se borra: se anula (`VOIDED`) con motivo y autor | ◻ |
| SA-5 | Ingresos de un período = suma de `total` de las ventas `PAID` con `sold_at` en el período, en la zona horaria del negocio | ◻ |
| SA-6 | La venta guarda su moneda como snapshot | ◻ |
| SA-7 | Las líneas guardan descripción y precio unitario como snapshot | ? |

## Conversaciones y WhatsApp

| # | Regla | Estado |
|---|---|---|
| CO-1 | Un mensaje pertenece a exactamente una conversación | ◻ |
| CO-2 | `external_message_id` es único: un mismo mensaje externo nunca se procesa dos veces | ◻ |
| CO-3 | Los mensajes son inmutables | ◻ |
| CO-4 | Un mensaje entrante marca la conversación como pendiente de respuesta y la reabre si estaba archivada | ? |
| CO-5 | El tenant de un webhook se resuelve por `phone_number_id`, y solo después de verificar la firma | ◻ |
| CO-6 | Un número desconocido crea conversación; vincularlo a un cliente es una acción explícita | ? |

## Tiempo

| # | Regla | Estado |
|---|---|---|
| TZ-1 | Todos los timestamps se almacenan en UTC | ✔ |
| TZ-2 | Los días y rangos (agenda, ingresos del día) se calculan en la zona horaria del negocio | ◻ |
| TZ-3 | Los horarios de atención se guardan como hora local del negocio, no en UTC | ◻ |
