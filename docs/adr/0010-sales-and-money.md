# ADR 0010 — Ventas: anulación, importes y relación con la cita

Fecha: 2026-09-21 · Estado: aceptada

## Contexto

Una barbería cobra casi siempre al terminar la atención, pero no siempre: hay
clientes que pagan después, ventas de producto sin cita y cobros que se
registran mal y hay que deshacer. El registro de ventas es el que alimentará los
ingresos del dashboard, así que tiene que ser exacto y auditable.

La regla SA-4 se había escrito como «una venta no se edita ni se borra: se anula
(`VOIDED`)», mientras que el modelo de dominio acordado más tarde enumera los
estados `PENDING`, `PAID`, `CANCELLED` y `REFUNDED`. Hay que conciliar las dos.

## Decisión

### Cuatro estados, dos formas de anular

```text
PENDING ──pay──► PAID ──refund──► REFUNDED
   │
   └──cancel──► CANCELLED
```

Se mantiene la intención de SA-4 —una venta **nunca se edita ni se borra**— y se
implementa con dos anulaciones distintas en lugar de un único `VOIDED`, porque
en la contabilidad no significan lo mismo:

- `CANCELLED`: la venta nunca se cobró. No hubo dinero.
- `REFUNDED`: se cobró y se devolvió. Hubo dinero en los dos sentidos.

Las dos exigen **motivo y autor**, y las dos son terminales. Una venta que hay
que rehacer es una venta nueva; la anulada se queda al lado, como historial.

No existen `PATCH /sales/:id` ni `DELETE /sales/:id`. Es la misma decisión que
con los servicios (regla CA-3) y las citas.

### Los importes se derivan, no se reciben

El cliente envía líneas y, como mucho, un descuento. El `subtotal` es la suma de
las líneas y el `total` es `subtotal - discount` (regla SA-2). La API nunca
acepta un total: un importe que llega de fuera es un importe que se puede
falsear.

Se guardan igualmente en columnas, como snapshot, para que un informe no tenga
que recalcular la historia, y la base de datos comprueba que cuadren:

```sql
CONSTRAINT ck_sales_amounts CHECK (
  subtotal >= 0 AND discount >= 0 AND discount <= subtotal
  AND total = subtotal - discount
)
```

Todo el dinero es `DECIMAL(12,2)` y viaja como string decimal (`"25.00"`),
operado en céntimos enteros por `Money`. Nunca coma flotante.

### Snapshots: moneda y líneas

La venta guarda la **moneda del negocio** en el momento de cobrar (regla SA-6) y
cada línea guarda su **descripción y su precio unitario** (regla SA-7). Cambiar
la lista de precios o renombrar un servicio no puede reescribir lo que un
cliente pagó. `service_id` se conserva solo para poder agrupar por servicio en
los informes.

Cuando la venta nace de una cita, el precio de la línea es el **precio pactado al
reservar** (regla AP-2), no el vigente hoy.

### Una cita, como mucho una venta

`UNIQUE(tenant_id, appointment_id)` y la comprobación en el caso de uso, dentro
de la transacción (regla SA-3). MySQL no compara `NULL` en un índice único, así
que las ventas de mostrador —que no tienen cita— conviven sin estorbarse.

Solo se cobra una cita `COMPLETED`, lo que hace cumplir de paso la regla AP-9:
un `NO_SHOW` no puede generar ingresos.

### Quién puede qué

Cualquier miembro registra y consulta ventas, pero un `STAFF` solo ve y registra
**las suyas** —las de su ficha de profesional—, y anular es decisión de `OWNER` o
`ADMIN` (docs/permissions.md). Como en la agenda, lo primero depende de *qué*
venta es, así que se resuelve en el caso de uso, no en el controller.

## Alternativas descartadas

- **Un único estado `VOIDED`**: más simple, pero obliga a mirar `paid_at` para
  saber si hubo que devolver dinero. La distinción es información contable, no
  ruido.
- **Cobrar siempre al completar la cita, sin venta explícita**: no cubre las
  ventas de producto ni el «te lo pago mañana», y mezcla la agenda con la caja.
- **Guardar solo el total**: impide saber qué se cobró y hace imposible un
  informe por servicio.
- **Líneas apuntando al servicio sin copiar precio**: barato hoy, mentiroso en
  cuanto suban los precios.

## Consecuencias

- El histórico de caja es inmutable y explicable: toda anulación tiene motivo,
  autor y momento.
- Los ingresos de un período son la suma de los `total` de las ventas `PAID`
  (regla SA-5): `REFUNDED` deja de contar aunque estuviera cobrada.
- Un cambio de precio o de nombre en el catálogo nunca altera ventas pasadas.
- Queda pendiente para el dashboard la agregación por período en la zona horaria
  del negocio (regla TZ-2), que se resolverá por consulta, sin tabla propia.
