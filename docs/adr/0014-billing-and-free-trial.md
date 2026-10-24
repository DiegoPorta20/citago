# ADR 0014 — Prueba gratuita y planes (billing, sin pasarela)

Fecha: 2026-10-24 · Estado: aceptada

## Contexto

CitaGo se vende por suscripción mensual en Perú, en soles. Antes de conectar una
pasarela de pago hay que decidir qué se vende, qué pasa durante la prueba y qué
pasa cuando termina, porque esas tres cosas no dependen de quién cobre.

Restricciones que pesan:

- Una barbería no va a poner tarjeta para probar un sistema que aún no conoce, y
  en Perú la penetración de tarjeta es baja: pedirla al registrarse espanta.
- Cobrar tarde es mejor que borrar o esconder datos. Un negocio que no paga no
  debe perder su historial ni su agenda del mes.
- La pasarela se elegirá después (Culqi, Niubiz, Mercado Pago…) y no debe
  condicionar el dominio.

## Decisión

### Prueba de 7 días, sin tarjeta, que empieza al registrarse

`RegisterBusinessUseCase` crea la `Subscription` en la misma transacción que el
negocio, el usuario y la membresía (BI-1): no existe un negocio nuevo sin
prueba. Dura `TRIAL_DAYS = 7` y arranca en el plan Pro, el que la app destaca.

Durante la prueba **todo funciona igual en los tres planes**: todavía no hay
diferencias de funciones que justifiquen limitar nada, y limitar durante la
prueba reduce la conversión sin ahorrar nada.

### Tres planes, definidos en código

| Código | Nombre | Precio mensual | Profesionales |
|---|---|---|---|
| `STARTER` | Inicial | S/ 39.00 | hasta 2 |
| `PRO` | Profesional | S/ 79.00 | hasta 5 |
| `BUSINESS` | Negocio | S/ 149.00 | hasta 15 |

Viven en `billing/domain/plan.ts` como constantes, no en una tabla: son tres
filas que cambian con un despliegue, no con un formulario, y una tabla añadiría
una migración y una pantalla de administración sin que nadie las pida. **Los
precios y los topes son una propuesta inicial**, no una decisión de mercado:
cambiarlos es editar ese archivo.

El eje del precio es el número de profesionales porque es lo que crece junto con
el negocio y lo que el dueño entiende sin explicación.

> **Límite todavía no aplicado:** `maxStaff` se muestra pero nada lo exige aún.
> Aplicarlo toca el alta de profesionales (otro módulo) y tiene sentido hacerlo
> cuando exista el cobro, no antes.

### El estado se deriva, no se almacena

La tabla `subscriptions` guarda `plan_code` y `trial_ends_at`. **No hay columna
de estado ni job que expire pruebas**: `TRIALING` o `EXPIRED` se calcula
comparando `trial_ends_at` con la hora actual (`Clock`). Un estado almacenado es
un dato que alguien tiene que acordarse de actualizar; una comparación no puede
quedarse atrás. Es el mismo criterio del [ADR 0011](./0011-dashboard-by-query.md).

`daysLeft` redondea hacia arriba: con 23 horas de prueba el dueño ve «1 día», no
«0 días» sobre una cuenta que sigue funcionando.

### Cuando la prueba termina: solo lectura

`SubscriptionGuard` es un guard global, registrado en `IdentityModule` justo
después de `JwtAuthGuard` y `RolesGuard` (necesita el contexto de autenticación
que ellos fijan; el orden quedó verificado arrancando la aplicación).

| Petición | Prueba vencida |
|---|---|
| `GET`, `HEAD`, `OPTIONS` | Pasa: el negocio sigue viendo su agenda, clientes y ventas |
| `POST`, `PUT`, `PATCH`, `DELETE` | `402 SUBSCRIPTION_EXPIRED` |
| Rutas `@Public` (login, refresh, webhooks) | Pasan: no hay negocio autenticado que comprobar |
| `@AllowWhenExpired` | Pasa: elegir plan y cambiar de negocio |

Responde **402**, no 403: no es un problema de permisos, es un problema de pago,
y la app necesita distinguirlos para mostrar «elige un plan» en vez de «no
puedes». Por eso `DomainErrorCategory` gana `PaymentRequired`.

Los webhooks de WhatsApp siguen registrando mensajes entrantes: perder un
mensaje de un cliente por una factura pendiente es el peor momento para ser
estricto. Responder, en cambio, es un `POST` y queda bloqueado.

Un negocio **sin fila de suscripción no se restringe**. No debería existir:
el registro la crea y la migración rellena los existentes. Si ocurriera (datos
creados a mano), bloquearlo por un descuido nuestro sería peor que dejarlo
pasar.

### Elegir plan registra la preferencia; no cobra

`PUT /billing/subscription/plan` (solo OWNER) cambia `plan_code`. Hasta que haya
pasarela no mueve dinero ni extiende la prueba: sirve para que, cuando llegue el
cobro, el dueño ya haya dicho qué plan quiere, y para medir cuál se elige.

La migración da una prueba nueva de 7 días a los negocios que ya existen: lanzar
billing no debe dejar a nadie bloqueado el día del despliegue.

## Qué queda fuera, a propósito

- **La pasarela.** Se decidirá con la documentación de la elegida delante. Lo que
  se prevé: un puerto `PaymentProvider` (como `WhatsAppCloudApi`), un webhook
  firmado e idempotente que activa la suscripción, y una migración que añade
  `status` y `current_period_end`. Entonces aparecen `ACTIVE`, `PAST_DUE` y un
  periodo de gracia; hoy no tendría quién los produzca.
- **Aplicar `maxStaff`** (ver arriba).
- **Aviso por correo** antes de que venza la prueba: necesita proveedor de correo,
  que el proyecto aún no tiene. Por ahora la app muestra los días restantes.
- **Cobro de WhatsApp.** Meta factura los mensajes a la cuenta de WhatsApp
  Business del propio negocio; CitaGo no lo revende.

## Consecuencias

- Todo negocio tiene exactamente una suscripción (`UNIQUE(tenant_id)`).
- Un negocio vencido no pierde nada y puede volver en cuanto elija y pague.
- Añadir la pasarela extiende el modelo (nuevas columnas y estados); no obliga a
  reescribir el guard ni los endpoints.
- Cada escritura autenticada hace una lectura extra de `subscriptions` por
  índice único. Es una fila por negocio; si alguna vez pesara, el punto de
  cambio es `AssertSubscriptionAccessUseCase`.
- Probado con tests unitarios (dominio, casos de uso, guard) y verificado el
  cableado de Nest. El e2e `billing.e2e-spec.ts` está escrito pero **pendiente de
  ejecutar** con el contenedor de pruebas.
