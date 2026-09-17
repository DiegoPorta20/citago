# MySQL Database Skill

## Purpose

Define database design and persistence standards for the SaaS platform.

## Technology

* MySQL 8+
* Type Orm ORM
* InnoDB
* UTF8MB4

## Database principles

The database must support:

* multi-tenancy
* referential integrity
* transactional consistency
* efficient querying
* auditing
* future scalability

## Multi-tenancy

Every tenant-owned table must contain:

```sql
tenant_id
```

Example:

```sql
CREATE TABLE appointments (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    client_id CHAR(36) NOT NULL,
    staff_id CHAR(36) NOT NULL,
    ...
);
```

## Tenant isolation

Every query must be tenant-scoped.

Application code must never rely solely on:

```sql
WHERE id = ?
```

Prefer:

```sql
WHERE id = ?
AND tenant_id = ?
```

This applies to:

* SELECT
* UPDATE
* DELETE

## Primary keys

Use UUIDs for distributed/application-level entities.

Preferred database representation:

```text
CHAR(36)
```

or an optimized binary UUID strategy if explicitly adopted.

Do not mix ID strategies without architectural justification.

## Foreign keys

Use foreign keys for relational integrity.

Example:

```text
appointments.client_id
    ↓
clients.id
```

Define appropriate delete behavior.

Never use cascading deletes blindly.

## Timestamps

Entities should generally have:

```text
created_at
updated_at
```

Use UTC internally.

Convert to business/user timezone at presentation boundaries.

## Status fields

Use explicit status values.

Example:

```text
PENDING
CONFIRMED
ARRIVED
IN_PROGRESS
COMPLETED
CANCELLED
NO_SHOW
```

Do not represent important states using ambiguous booleans such as:

```text
is_done
is_cancelled
is_active
```

when multiple states exist.

## Money

Never use floating point for monetary values.

Prefer:

```text
DECIMAL(12,2)
```

Example:

```sql
price DECIMAL(12,2) NOT NULL
```

Never:

```text
FLOAT
DOUBLE
```

for financial values.

## Indexes

Indexes must be created based on query patterns.

Multi-tenant tables commonly require indexes such as:

```text
(tenant_id)
(tenant_id, status)
(tenant_id, created_at)
(tenant_id, client_id)
(tenant_id, start_at)
```

Do not create indexes blindly.

Every index has write/storage costs.

## Unique constraints

Unique constraints must consider tenant scope.

Incorrect:

```text
UNIQUE(phone)
```

if phone numbers only need to be unique within a tenant.

Prefer:

```text
UNIQUE(tenant_id, phone)
```

when appropriate.

## Appointment overlap

The database alone should not be relied upon to enforce all appointment overlap rules.

The application must validate:

```text
staff
+
time range
+
active appointment status
```

Use transactions/locking when necessary to avoid race conditions.

## Transactions

Use transactions for operations that require atomicity.

Example:

```text
Complete appointment
+
Create sale
+
Update client statistics
```

Either all succeed or all roll back.

## Soft delete

Use soft deletion when historical records must remain available.

Example:

```text
deleted_at
```

Do not physically delete financial or historical records unless explicitly required.

## Auditability

Important entities should maintain enough information to answer:

```text
Who created it?
When?
Who changed it?
When?
```

Consider:

```text
created_by
updated_by
```

for administrative entities where useful.

## WhatsApp messages

External WhatsApp message IDs must be unique.

Example:

```text
external_message_id UNIQUE
```

This guarantees webhook idempotency.

## Migrations

All schema changes must be performed through migrations.

Never manually modify production schema without a migration.

Migration naming must clearly describe the change.

Example:

```text
20260916_add_whatsapp_messages
```

## Type Orm

Type Orm schema must accurately represent database constraints.

Do not use Type Orm merely as a CRUD shortcut.

Business rules remain in domain/application layers.

## Query performance

Before optimizing:

1. Identify the query.
2. Check expected data volume.
3. Inspect indexes.
4. Analyze execution plan when necessary.
5. Measure before/after.

Avoid premature optimization.

## Data integrity

Never rely only on frontend validation.

Critical constraints must be enforced in:

```text
Domain/Application
+
Database where appropriate
```

## Security

Never:

* concatenate SQL with user input
* store plaintext passwords
* store plaintext access tokens unnecessarily
* expose database credentials
* expose internal database errors through API

## Definition of Done

Database work is complete when:

* migration exists
* relationships are defined
* foreign keys are correct
* indexes are justified
* tenant isolation is preserved
* monetary fields use DECIMAL
* timestamps are consistent
* unique constraints are correct
* migrations can be applied from a clean database
* tests or integration validation cover important constraints
