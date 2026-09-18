# Arquitectura de CitaGo

Resumen operativo. Las decisiones con su justificación están en [`adr/`](./adr).

## Componentes

```text
Flutter (citagof/)  ──HTTPS REST /api/v1──►  NestJS (citago/)  ──►  MySQL 8
```

Un solo despliegue del backend, una base de datos, un módulo por bounded context.
Sin Redis, colas, microservicios ni IA en el MVP ([ADR 0001](./adr/0001-modular-monolith-clean-architecture.md)).

## Capas del backend

```text
Presentation  → controllers y DTOs HTTP
     ↓
Application   → casos de uso y puertos
     ↓
Domain        → entidades, value objects, reglas, contratos de repositorio
     ↑
Infrastructure→ repositorios TypeORM, mappers, adapters de integraciones
```

Las fronteras las verifica ESLint: `domain/` no puede importar NestJS, TypeORM,
transportes ni capas externas; `application/` no puede importar infraestructura
ni presentación.

Los contratos se declaran como **clases abstractas**, que funcionan además como
token de inyección de NestJS.

## Bounded contexts

| Módulo | Responsabilidad | Estado |
|---|---|---|
| `health` | Liveness y conectividad con MySQL | implementado |
| `identity` | Usuarios, credenciales, sesiones, membresías y roles | **implementado** |
| `tenants` | Negocio, configuración y horario de atención | entidad y repositorio listos; endpoints pendientes |
| `catalog` | Servicios: duración, precio, estado | **implementado** |
| `staff` | Profesionales, horario semanal, ausencias y bloqueo de agenda | **implementado** |
| `clients` | Clientes y normalización de teléfono | **implementado** |
| `appointments` | Agenda, máquina de estados, solapamientos, disponibilidad | **implementado** |
| `sales` | Ventas, líneas, métodos de pago, anulación | pendiente |
| `conversations` | Conversaciones y mensajes, independientes del canal | **implementado** |
| `whatsapp` | Webhook, firma, conexión del número, envío por la Cloud API ([ADR 0009](./adr/0009-whatsapp-integration.md)) | **implementado** |
| `dashboard` | Métricas por consulta (sin dominio) | pendiente |

## Contrato de la API

- Prefijo `/api/v1`.
- Éxito: `{ "data": ..., "meta": {...} }`. Las colecciones llevan
  `page`, `limit`, `total` y `totalPages` en `meta`.
- Error: `{ "statusCode", "code", "message", "details?", "timestamp", "path" }`.
  `code` es estable y legible por máquina (`APPOINTMENT_OVERLAP`).
- Fechas ISO-8601 en UTC. **Dinero como string decimal** (`"25.00"`), nunca
  number: internamente es `Money`, un entero exacto de céntimos. IDs UUIDv7.
- Un recurso de otro tenant responde `404`, nunca `403`.

## Endpoints disponibles

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/v1/health` | Público |
| POST | `/api/v1/auth/register` | Público |
| POST | `/api/v1/auth/login` | Público |
| POST | `/api/v1/auth/refresh` | Público |
| POST | `/api/v1/auth/logout` | Público |
| GET | `/api/v1/auth/me` | Autenticado |
| POST | `/api/v1/services` | OWNER, ADMIN |
| GET | `/api/v1/services` | Autenticado |
| GET | `/api/v1/services/:id` | Autenticado |
| PATCH | `/api/v1/services/:id` | OWNER, ADMIN |
| POST | `/api/v1/services/:id/activate` | OWNER, ADMIN |
| POST | `/api/v1/services/:id/deactivate` | OWNER, ADMIN |
| POST | `/api/v1/clients` | Autenticado |
| GET | `/api/v1/clients` | Autenticado |
| GET | `/api/v1/clients/:id` | Autenticado |
| PATCH | `/api/v1/clients/:id` | Autenticado |
| DELETE | `/api/v1/clients/:id` (lógico) | OWNER, ADMIN |
| POST | `/api/v1/clients/:id/restore` | OWNER, ADMIN |
| POST, PATCH | `/api/v1/staff`, `/api/v1/staff/:id` | OWNER, ADMIN |
| GET | `/api/v1/staff`, `/api/v1/staff/:id` | Autenticado |
| PUT | `/api/v1/staff/:id/schedule` | OWNER, ADMIN |
| POST | `/api/v1/staff/:id/activate` · `/deactivate` | OWNER, ADMIN |
| GET | `/api/v1/staff/:id/time-off` | Autenticado |
| POST, DELETE | `/api/v1/staff/:id/time-off` · `/:timeOffId` | OWNER, ADMIN |
| POST | `/api/v1/appointments` | Autenticado (STAFF: solo su agenda) |
| GET | `/api/v1/appointments` (agenda) | Autenticado (STAFF: solo su agenda) |
| GET | `/api/v1/appointments/availability` | Autenticado (STAFF: solo su agenda) |
| GET, PATCH | `/api/v1/appointments/:id` | Autenticado (STAFF: solo su agenda) |
| POST | `/api/v1/appointments/:id/{confirm,arrive,start,complete,cancel,no-show}` | Autenticado (STAFF: solo su agenda) |
| GET | `/api/v1/conversations` (bandeja; `needsReply=true` = pendientes) | Autenticado |
| GET | `/api/v1/conversations/:id` · `/:id/messages` (cursor `before`) | Autenticado |
| POST | `/api/v1/conversations/:id/resolve` | Autenticado |
| PUT | `/api/v1/conversations/:id/client` | Autenticado |
| POST | `/api/v1/conversations/:id/archive` · `/reopen` | OWNER, ADMIN |
| PUT | `/api/v1/conversations/:id/assignee` | OWNER, ADMIN |
| POST | `/api/v1/conversations/simulate-inbound` (solo con `DEV_TOOLS_ENABLED`) | OWNER, ADMIN |
| POST | `/api/v1/conversations/:id/messages` (responder por el canal) | Autenticado |
| GET · PUT · DELETE | `/api/v1/whatsapp/channel` (estado, conectar, desconectar) | OWNER, ADMIN |
| GET · POST | `/api/v1/webhooks/whatsapp` (verificación y entregas de Meta) | Público, con verify token / firma |

La autenticación es **deny by default**: el guard es global y un endpoint solo
queda abierto si lleva `@Public()`.

## Seguridad transversal

| Medida | Dónde |
|---|---|
| `helmet`, límite de body (100 KB), rate limiting por IP | `src/app.setup.ts` |
| Validación estricta (`whitelist`, `forbidNonWhitelisted`) | `src/app.setup.ts` |
| Traducción de errores sin filtrar internos | `shared/presentation/filters` |
| Configuración validada al arrancar | `src/config/environment.ts` |
| CORS deshabilitado por defecto (cliente nativo) | `src/app.setup.ts` |
| Sin `DELETE` sobre datos con historial: se desactiva o se anula | Controllers |
| Aislamiento multi-tenant en cuatro capas | [ADR 0004](./adr/0004-tenant-isolation.md) |

## Persistencia

TypeORM 1.x sobre MySQL 8 ([ADR 0002](./adr/0002-typeorm-as-official-orm.md)),
con `synchronize: false` y migraciones versionadas. Patrón Data Mapper: la
entidad de TypeORM (`*.orm-entity.ts`) nunca es la entidad de dominio.

## Tests

| Tipo | Archivo | Base de datos |
|---|---|---|
| Unitario | `*.spec.ts` junto al código | No |
| Integración | `*.int-spec.ts` | MySQL de test (puerto 3307) |
| End-to-end | `citago/test/*.e2e-spec.ts` | MySQL de test |

Toda feature con datos de un tenant incluye un e2e que verifica que el tenant A
recibe `404` al pedir un recurso del tenant B.
