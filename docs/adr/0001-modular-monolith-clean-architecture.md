# ADR 0001 — Monolito modular con Clean Architecture

- Fecha: 2026-09-17
- Estado: aceptada

## Contexto

CitaGo es un SaaS multi-tenant para negocios basados en citas. El MVP abarca
identidad, catálogo, clientes, agenda, ventas, conversaciones y WhatsApp.
Un equipo pequeño debe poder evolucionarlo sin rehacer la base.

## Decisión

Un **monolito modular** en NestJS: un despliegue, una base de datos, un módulo
por bounded context (`identity`, `tenants`, `catalog`, `clients`, `staff`,
`appointments`, `conversations`, `whatsapp`, `sales`, `dashboard`).

Cada módulo aplica Clean Architecture **en proporción a su complejidad**:

| Módulo | Enfoque |
|---|---|
| `appointments` | DDD completo: entidad con máquina de estados, servicio de dominio, errores |
| `identity`, `clients`, `sales`, `conversations` | Capas completas, dominio liviano |
| `catalog`, `tenants`, `staff` | Entidad con validación y mapper directo |
| `dashboard` | Sin dominio: puerto de consultas + SQL |

Reglas de dependencia, verificadas por ESLint:

- `domain/` no importa NestJS, TypeORM, transportes ni capas externas.
- `application/` depende de puertos; puede usar `@Injectable()` para inyección.
- `infrastructure/` implementa los contratos definidos hacia dentro.

Los módulos se comunican por casos de uso o puertos de consulta. Ningún módulo
consulta las tablas de otro.

## Consecuencias

- Sin microservicios, event bus, colas, Redis ni CQRS en el MVP.
- Los contratos (clases abstractas) permiten sustituir infraestructura sin tocar
  el negocio.
- El costo es más archivos por feature; se acota no aplicando DDD completo donde
  no hay reglas.
