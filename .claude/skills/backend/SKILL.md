# Backend Development Skill

## Purpose

Define standards for developing the NestJS backend using Clean Architecture, Domain-Driven Design principles, and SOLID.

## Technology

* Node.js
* NestJS
* TypeScript
* Type Orm
* MySQL
* REST
* JWT
* Redis
* BullMQ when asynchronous processing is required
* Jest
* ESLint
* Prettier

## Architectural principles

The backend follows:

```text
Presentation
     ↓
Application
     ↓
Domain

Infrastructure
implements application/domain ports
```

Dependency direction must always point inward.

Domain must never depend on:

* NestJS
* Type Orm
* MySQL
* Axios
* Redis
* WhatsApp
* AWS SDK

## Bounded contexts

Initial contexts:

```text
identity
tenants
clients
services
appointments
conversations
whatsapp
sales
dashboard
notifications
```

Do not place unrelated business logic inside a generic module.

## Folder structure

Preferred:

```text
src/
├── contexts/
│   ├── appointments/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   ├── repositories/
│   │   │   └── errors/
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   ├── dto/
│   │   │   └── ports/
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   └── integrations/
│   │   └── presentation/
│   │       └── controllers/
│   └── ...
│
├── shared/
│   ├── domain/
│   ├── application/
│   └── infrastructure/
│
└── main.ts
```

## Controllers

Controllers must:

* receive HTTP requests
* validate DTOs
* obtain authenticated user context
* invoke use cases
* return responses

Controllers must NOT:

* query Type Orm
* contain business rules
* calculate prices
* decide appointment availability
* communicate directly with WhatsApp
* manipulate database transactions directly

## Use cases

One use case should represent one meaningful application action.

Examples:

```text
CreateClient
CreateAppointment
ConfirmAppointment
CancelAppointment
CompleteAppointment
CreateSale
ReceiveWhatsAppMessage
ProcessWhatsAppWebhook
GetDailyDashboard
```

Use cases orchestrate the application.

## Domain

Business rules belong in the domain.

Example:

```text
An active appointment cannot overlap another active appointment
for the same staff member.
```

This rule must not exist only inside a controller.

## Repositories

Domain/application code depends on interfaces.

Example:

```typescript
interface AppointmentRepository {
  findOverlapping(...): Promise<Appointment | null>;
  save(appointment: Appointment): Promise<void>;
}
```

Type Orm implementation belongs to infrastructure.

## Transactions

Use database transactions when multiple changes must remain atomic.

Example:

```text
Complete appointment
        ↓
Create sale
        ↓
Update client statistics
```

If the operation must be atomic, use a transaction.

Do not create distributed transactions unnecessarily.

## Error handling

Use domain/application errors.

Examples:

```text
AppointmentNotFoundError
AppointmentOverlapError
ClientNotFoundError
UnauthorizedTenantAccessError
InvalidAppointmentStatusError
```

Infrastructure errors must be translated before reaching the API.

## Logging

Logs must contain useful technical context.

Never log:

* passwords
* JWTs
* refresh tokens
* WhatsApp access tokens
* payment secrets
* sensitive customer information unnecessarily

## Configuration

All environment-specific configuration must come from environment variables.

Example:

```text
DATABASE_URL
JWT_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN
REDIS_URL
```

Never hardcode secrets.

## Asynchronous processing

Use queues when:

* webhook processing is expensive
* external API calls may take time
* notifications can be delayed
* reports are expensive
* bulk operations are required

Example:

```text
Webhook
   ↓
Validate
   ↓
Persist event
   ↓
Queue
   ↓
Worker
   ↓
Business processing
```

## Idempotency

External events must be safely retryable.

Example:

```text
externalMessageId
```

must be unique.

If the same event arrives twice:

```text
First → process
Second → ignore safely
```

## Testing

Required:

```text
Domain tests
Use case tests
Integration tests
Controller tests
E2E tests
```

Business rules must be tested independently from the database whenever possible.

## Definition of Done

Backend work is complete only when:

* architecture is respected
* business rules are implemented
* DTO validation exists
* authorization exists
* tenant isolation exists
* tests pass
* lint passes
* formatting passes
* Swagger is updated when applicable
* no secrets are committed
* no unnecessary duplication exists
