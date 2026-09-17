# API Development Skill

## Purpose

Define standards for designing, implementing, documenting, testing, and maintaining REST APIs for the SaaS platform.

The API must remain independent from business logic and external integrations.

## Technology

* NestJS
* TypeScript
* REST
* OpenAPI / Swagger
* JWT authentication
* Type Orm
* MySQL
* class-validator
* class-transformer

## Architecture

Every API request must follow:

```text
HTTP Request
    ↓
Controller
    ↓
Request DTO validation
    ↓
Use Case
    ↓
Domain
    ↓
Repository Interface
    ↓
Infrastructure
    ↓
Database
```

Controllers must never contain business logic.

## REST conventions

Use standard HTTP methods:

* GET → read
* POST → create
* PATCH → partial update
* PUT → complete replacement when appropriate
* DELETE → delete/deactivate

Use plural resources:

```text
/api/v1/clients
/api/v1/appointments
/api/v1/services
/api/v1/conversations
/api/v1/messages
/api/v1/sales
```

Avoid:

```text
/api/getClients
/api/createAppointment
/api/deleteService
```

## Versioning

All public API endpoints must use:

```text
/api/v1/...
```

Future breaking changes must use a new version.

## Response format

Successful responses should use a consistent structure.

Example:

```json
{
  "data": {
    "id": "..."
  },
  "meta": {}
}
```

Collections:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Errors:

```json
{
  "statusCode": 400,
  "code": "APPOINTMENT_OVERLAP",
  "message": "The appointment overlaps with another appointment.",
  "details": {}
}
```

Never expose stack traces or internal infrastructure errors to clients.

## DTO rules

Every external request must have a DTO.

Do not accept arbitrary objects.

Use:

```typescript
class CreateAppointmentDto {
  @IsUUID()
  clientId: string;

  @IsUUID()
  serviceId: string;

  @IsISO8601()
  startAt: string;
}
```

Validate all external input.

## Pagination

Collection endpoints should support pagination.

Preferred parameters:

```text
?page=1&limit=20
```

Maximum limit must be enforced server-side.

Example:

```text
limit=10000
```

must not be accepted.

## Filtering

Use query parameters:

```text
GET /api/v1/appointments?status=CONFIRMED
```

Do not create unnecessary endpoints for every filter.

## Authentication

Protected endpoints require authentication.

The authenticated user's tenant context must come from the authentication context.

Never trust:

```text
tenantId
```

sent by the mobile application.

## Authorization

Authentication answers:

> Who are you?

Authorization answers:

> What are you allowed to do?

Every protected use case must verify permissions.

Roles initially:

```text
OWNER
ADMIN
STAFF
```

## Tenant isolation

Every tenant-owned resource must be scoped to the authenticated tenant.

Correct:

```text
repository.findById({
  id,
  tenantId
});
```

Incorrect:

```text
repository.findById(id);
```

Never allow IDOR or cross-tenant access.

## Idempotency

Operations that may be retried must support idempotency when appropriate.

This is especially important for:

* WhatsApp webhooks
* payments
* external integrations
* event processing

External event IDs must be persisted when available.

## External APIs

External APIs must be accessed through adapters.

Example:

```text
application/
    ports/
        whatsapp-provider.port.ts

infrastructure/
    integrations/
        whatsapp/
            whatsapp-provider.adapter.ts
```

The domain must not depend directly on Meta, Axios, or another provider.

## Swagger

Every public endpoint should be documented with:

* summary
* description
* parameters
* request DTO
* response
* authentication requirements
* possible errors

## API security

Always consider:

* authentication
* authorization
* tenant isolation
* input validation
* rate limiting
* CORS
* request size limits
* sensitive information
* webhook verification
* secret management

Never expose:

* passwords
* access tokens
* refresh tokens
* API secrets
* database credentials

## API tests

At minimum test:

* successful request
* validation failure
* unauthorized request
* forbidden request
* missing resource
* tenant isolation
* business rule failure

## Before implementing an endpoint

Claude must first determine:

1. Which bounded context owns the endpoint?
2. Which use case is executed?
3. Which DTO is required?
4. Which authorization rules apply?
5. Which tenant restrictions apply?
6. Which repository is required?
7. Which business rules apply?
8. Which tests are required?

Do not create an endpoint simply because it is convenient.
