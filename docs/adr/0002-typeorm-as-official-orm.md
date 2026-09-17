# ADR 0002 — TypeORM como ORM oficial (en lugar de Prisma)

- Fecha: 2026-09-17
- Estado: aceptada (decisión del propietario del producto)

## Contexto

El análisis inicial partía de Prisma. El propietario decidió TypeORM.

## Decisión

**TypeORM 1.x con el driver `mysql2`.** Prisma no se instala ni se usa.

Configuración obligatoria del DataSource (`src/database/typeorm.config.ts`):

| Opción | Valor | Motivo |
|---|---|---|
| `synchronize` | `false` | Evita que el ORM reescriba el schema. Riesgo principal de TypeORM. |
| `migrationsRun` | `false` | Las migraciones son un paso explícito del despliegue. |
| `timezone` | `'Z'` | Sin esto el driver desplaza los `DATETIME` a la hora local. |
| `charset` | `utf8mb4` | Emojis y acentos en nombres y mensajes. |
| `supportBigNumbers` + `bigNumberStrings` | `true` | `DECIMAL` y `BIGINT` llegan como string: el dinero nunca pasa por un `number` de JS. |

## Ventajas para este proyecto

- Bloqueo pesimista nativo (`setLock('pessimistic_write')`), necesario para
  evitar citas solapadas por concurrencia.
- Migraciones en TypeScript escritas a mano: control total sobre claves foráneas
  compuestas, `CHECK` y nombres de índices.
- Repositorios inyectables con `@nestjs/typeorm`.

## Riesgo asumido y mitigación

Las entidades de TypeORM tienen decoradores y **tientan a usarse como entidades
de dominio**. Mitigación:

- Patrón Data Mapper: `*.orm-entity.ts` (persistencia) + entidad de dominio +
  mapper explícito.
- Regla de ESLint que prohíbe importar `typeorm` desde `domain/`.
- Cero lógica de negocio en las entidades ORM.
