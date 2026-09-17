# Feature Development Skill

## Purpose

Define the mandatory workflow Claude must follow when implementing a new feature, modifying an existing feature, or fixing functionality in the application.

The objective is to ensure that every feature:

* follows the project architecture
* respects existing business rules
* preserves multi-tenant isolation
* reuses existing functionality
* includes appropriate tests
* does not introduce unnecessary technical debt
* remains maintainable and scalable

---

# 1. Before writing code

NEVER start implementing immediately.

First understand the requested feature.

Claude must inspect:

1. `CLAUDE.md`
2. Relevant skills
3. Existing project structure
4. Related domain entities
5. Existing use cases
6. Existing repositories
7. Existing API endpoints
8. Existing database schema
9. Existing tests
10. Existing UI/components when applicable

Search the codebase before creating new files.

Do not create a new implementation when an existing implementation can be extended safely.

---

# 2. Understand the feature

Translate the request into a technical feature definition.

Identify:

```text
Feature
Business capability
Bounded context
Actors
Permissions
Inputs
Outputs
Business rules
Dependencies
Side effects
External integrations
Persistence requirements
```

Example:

```text
Feature:
Create appointment

Actor:
OWNER / ADMIN / STAFF

Context:
Appointments

Inputs:
client
service
staff
startAt

Business rules:
- staff must be available
- appointment cannot overlap
- service must be active
- client must belong to tenant

Side effects:
- appointment created
- dashboard updated
- optional notification event
```

---

# 3. Clarify ambiguity

If the requested behavior is ambiguous and different interpretations would produce materially different implementations, STOP and ask for clarification.

Do not invent business rules.

However, if the ambiguity is minor and an existing project convention clearly determines the behavior, follow the existing convention.

When making an assumption, document it.

Example:

```text
Assumption:
Appointments use the business timezone configured for the tenant.
```

---

# 4. Identify the bounded context

Every feature must belong to a bounded context.

Current contexts:

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

Do not place unrelated functionality in generic modules.

Avoid creating modules such as:

```text
utils
helpers
common-business
misc
```

for business logic.

---

# 5. Identify existing functionality

Before implementing, search for:

```text
entities
value objects
repositories
use cases
services
DTOs
controllers
database models
providers
events
tests
```

Reuse existing abstractions when appropriate.

Do not duplicate:

```text
validation
business rules
database queries
API clients
mapping logic
state management
```

---

# 6. Create an implementation plan

Before coding, produce a concise implementation plan.

The plan should include:

```text
1. Domain changes
2. Application changes
3. Infrastructure changes
4. API changes
5. Database changes
6. Flutter changes
7. External integration changes
8. Tests
```

Example:

```text
Implementation Plan

Backend:
- Add CreateAppointment use case
- Add appointment domain validation
- Extend AppointmentRepository
- Add POST /api/v1/appointments

Database:
- No migration required

Flutter:
- Add CreateAppointment form
- Add Riverpod provider
- Add API repository method

Tests:
- successful creation
- overlapping appointment
- inactive service
- cross-tenant client
```

Do not make unrelated changes.

---

# 7. Architecture requirements

All features must follow Clean Architecture.

Backend:

```text
Presentation
      ↓
Application
      ↓
Domain
      ↑
Infrastructure
```

Flutter:

```text
Presentation
      ↓
Application
      ↓
Domain
      ↑
Data
```

Never violate dependency direction merely to implement a feature faster.

---

# 8. Backend implementation

For backend features:

### Domain

Determine whether the feature requires:

* entity
* value object
* domain service
* domain error
* repository interface

### Application

Create or modify:

* use case
* input DTO
* output DTO
* application port

### Infrastructure

Implement:

* repository
* persistence mapper
* external provider
* integration adapter

### Presentation

Implement:

* controller
* request DTO
* response mapping
* authentication/authorization

Controllers must remain thin.

---

# 9. API implementation

Follow the API skill.

Use:

```text
/api/v1/...
```

Use appropriate HTTP methods.

Every external request must be validated.

Document new endpoints in Swagger.

Do not expose domain entities directly.

---

# 10. Database implementation

Before modifying the schema determine:

```text
Does this feature require persistence?
Does an existing table already represent the data?
Does a new entity need to be created?
What relationships are required?
What indexes are required?
What unique constraints are required?
Does tenant_id need to be added?
Does the operation require a transaction?
```

All schema modifications require migrations.

Never manually modify production schema.

---

# 11. Multi-tenancy

This is a mandatory requirement.

Every tenant-owned operation must use the authenticated tenant context.

Never trust:

```text
tenantId
```

provided directly by the client.

Correct:

```text
Authenticated User
        ↓
Tenant Context
        ↓
Use Case
        ↓
Repository
        ↓
tenant-scoped query
```

Every feature must be reviewed for cross-tenant access.

---

# 12. Authorization

Determine which roles can perform the operation.

Current roles:

```text
OWNER
ADMIN
STAFF
```

Do not assume that authentication means authorization.

For every feature document:

```text
OWNER: allowed
ADMIN: allowed
STAFF: allowed/restricted
```

If a role matrix already exists, follow it.

---

# 13. Business rules

Business rules must be explicit.

Do not hide business rules inside:

* controllers
* ORM models
* Flutter widgets
* SQL queries
* HTTP handlers

Example:

```text
An appointment cannot overlap an active appointment
for the same staff member.
```

This must be represented in application/domain logic and tested.

If a new rule is discovered, update:

```text
docs/business-rules.md
```

when appropriate.

---

# 14. External integrations

External integrations must be isolated behind adapters.

Examples:

```text
WhatsApp
Payment providers
Email
SMS
AWS
AI providers
```

Never make the domain depend directly on:

```text
Axios
Meta SDK
AWS SDK
OpenAI SDK
```

Use ports/interfaces.

Example:

```text
Application
    ↓
WhatsAppProvider
    ↓
WhatsAppCloudApiAdapter
    ↓
Meta API
```

---

# 15. WhatsApp-specific features

For WhatsApp features:

1. Validate incoming webhook.
2. Normalize external payload.
3. Check idempotency.
4. Persist external event/message ID.
5. Convert external data into internal commands/events.
6. Execute business logic.
7. Trigger side effects asynchronously when appropriate.
8. Return the webhook response quickly.

Never allow Meta-specific payload structures to spread through the domain.

---

# 16. Flutter implementation

For Flutter features:

Determine:

```text
Page
Widgets
Provider/state
Domain entity
Use case
Repository
API datasource
Model
Mapper
```

Never call APIs directly from UI widgets.

Prefer:

```text
Widget
  ↓
Riverpod Provider
  ↓
Use Case
  ↓
Repository
  ↓
Datasource
  ↓
Dio
```

Every relevant screen should handle:

```text
loading
success
empty
error
```

---

# 17. State management

Use Riverpod consistently.

Do not introduce another state-management library unless explicitly required.

Avoid unnecessary global state.

Keep feature state scoped to the feature whenever possible.

---

# 18. Error handling

Every feature must define expected failure scenarios.

Example:

```text
ClientNotFound
ServiceInactive
AppointmentOverlap
Unauthorized
Forbidden
TenantMismatch
ExternalProviderUnavailable
ValidationError
```

Convert technical errors into appropriate application/API errors.

Never expose:

```text
stack traces
SQL errors
internal paths
secrets
provider credentials
```

to the client.

---

# 19. Transactions

Use transactions when multiple changes must succeed together.

Example:

```text
Complete Appointment
        ↓
Create Sale
        ↓
Update Client Statistics
```

If one fails, the operation should roll back when atomicity is required.

Do not use transactions unnecessarily for independent operations.

---

# 20. Events and side effects

When a feature produces side effects, identify them explicitly.

Example:

```text
AppointmentCompleted
        │
        ├── CreateSale
        ├── UpdateClientStatistics
        ├── UpdateDashboard
        └── SendNotification
```

Do not tightly couple all side effects inside the primary use case if an event-driven approach is appropriate.

For expensive or external operations prefer asynchronous processing.

---

# 21. Testing

Every feature must include tests appropriate to its risk.

Minimum:

```text
Domain tests
Use case tests
Repository/integration tests
API tests
```

Flutter:

```text
Unit tests
Provider/state tests
Widget tests
```

Critical business scenarios must always be tested.

---

# 22. Mandatory test scenarios

For tenant-owned features test:

```text
✓ Correct tenant can access resource
✓ User cannot access another tenant's resource
✓ Unauthorized user is rejected
✓ Forbidden role is rejected
```

For appointments:

```text
✓ Create appointment
✓ Prevent overlapping appointment
✓ Cancel appointment
✓ Complete appointment
✓ Invalid status transition
```

For WhatsApp:

```text
✓ Process new message
✓ Ignore duplicate webhook
✓ Create/find client
✓ Create conversation
✓ Handle malformed payload
```

For sales:

```text
✓ Create sale
✓ Calculate total
✓ Reject invalid amount
✓ Preserve tenant isolation
```

---

# 23. Code quality

Follow:

* SOLID
* DRY
* KISS
* meaningful naming
* small functions
* small use cases
* explicit dependencies
* strong typing

Avoid:

```text
god classes
god services
huge controllers
huge widgets
deep nesting
duplicate logic
magic numbers
magic strings
unnecessary abstractions
```

Do not over-engineer simple functionality.

---

# 24. Security review

Before completing a feature verify:

```text
Authentication
Authorization
Tenant isolation
Input validation
Sensitive data
Secrets
IDOR
Injection
Rate limiting
Logging
External API security
```

If the feature introduces a security risk, fix it before considering the feature complete.

---

# 25. Observability

For important backend operations consider:

```text
structured logs
request IDs
tenant context
user context
operation name
duration
external provider status
```

Never log secrets or unnecessary personal information.

---

# 26. Backward compatibility

Before modifying existing behavior check:

```text
existing API consumers
Flutter screens
database compatibility
external integrations
tests
```

Do not break existing functionality without explicit intent.

For breaking API changes, consider API versioning.

---

# 27. Implementation order

Prefer this order:

```text
1. Business rules
2. Domain
3. Application/use case
4. Tests
5. Database/infrastructure
6. API
7. Flutter
8. Integration
9. End-to-end validation
```

When practical, implement backend/domain behavior before UI.

---

# 28. Run validation

After implementation:

```text
1. Run formatter
2. Run linter
3. Run type checking
4. Run unit tests
5. Run integration tests
6. Run relevant E2E tests
7. Inspect database migration
8. Review API contract
9. Run security review
```

Do not claim tests passed unless they were actually executed.

---

# 29. Self-review

Before finishing, ask:

```text
Did I understand the business requirement?

Did I reuse existing functionality?

Did I introduce unnecessary abstractions?

Did I preserve Clean Architecture?

Did I preserve tenant isolation?

Did I implement authorization?

Did I validate all external input?

Did I update business rules?

Did I add tests?

Did I create a migration if necessary?

Did I update Swagger?

Did I introduce any security issue?

Did I break existing functionality?

Did I leave dead code?

Did I leave TODOs that should be resolved now?
```

---

# 30. Final response after implementation

After completing a feature, provide:

```text
## Feature Completed

### Summary
Brief explanation.

### Changes
- File/module
- What changed

### Business Rules
- Rules implemented

### API
- Endpoints added/modified

### Database
- Migration added/no migration required

### Flutter
- Screens/providers/repositories changed

### Tests
- Tests added
- Tests executed
- Results

### Security
- Authorization
- Tenant isolation
- Validation

### Notes
- Assumptions
- Remaining technical debt

### Validation
- Typecheck: PASS/FAIL
- Lint: PASS/FAIL
- Tests: PASS/FAIL
```

Never report `PASS` for a validation step that was not actually executed.
