# ADR 0005 — Identificadores UUIDv7 generados por la aplicación

- Fecha: 2026-09-17
- Estado: aceptada

## Decisión

- Los IDs los genera la **aplicación** (`IdGenerator`), no la base de datos: una
  entidad es válida antes de persistirse.
- **UUIDv7**, almacenado en `CHAR(36)`.

## Motivo

- v7 se ordena por tiempo, así que el índice primario de InnoDB no se fragmenta
  como con v4 aleatorio.
- `CHAR(36)` es legible en logs y soporte; `BINARY(16)` complica depuración y
  mapeo.
- Un solo formato de ID en todo el sistema, sin mezclar estrategias.
