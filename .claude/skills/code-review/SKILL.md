# Code Review Skill

## Purpose

Review code before considering a feature complete.

The objective is to detect architectural, business, security, performance, testing, and maintainability problems.

## Review order

Always review in this order:

1. Correctness
2. Business rules
3. Security
4. Architecture
5. Data integrity
6. Error handling
7. Testing
8. Performance
9. Maintainability
10. Code style

## Architecture review

Check:

* Is Clean Architecture respected?
* Are dependencies pointing inward?
* Is business logic outside controllers/widgets?
* Is infrastructure isolated?
* Are repository interfaces used?
* Are external integrations isolated?

Flag violations such as:

```text
Controller → Type Orm
Controller → WhatsApp API
Flutter Widget → API implementation
Domain → Type Orm
Domain → NestJS
```

## Multi-tenant review

For every database operation verify:

```text
tenant context
        ↓
authorization
        ↓
tenant-scoped query
```

Look specifically for:

* missing tenant filters
* tenantId received directly from client
* IDOR
* cross-tenant joins
* unscoped updates
* unscoped deletes

## Business rule review

Verify every documented business rule.

Examples:

```text
No overlapping appointments
Cancelled appointments do not block availability
Completed appointments may generate sales
Duplicate WhatsApp events are ignored
```

If a business rule is undocumented but discovered during implementation, recommend documenting it.

## Security review

Check:

* authentication
* authorization
* input validation
* SQL injection
* sensitive logs
* secrets
* token handling
* rate limiting
* webhook verification
* insecure direct object references

## Database review

Check:

* foreign keys
* indexes
* unique constraints
* nullable fields
* enum/status consistency
* timestamps
* tenant indexes
* transaction requirements

## Performance review

Look for:

* N+1 queries
* unnecessary database calls
* loading entire tables
* missing pagination
* missing indexes
* expensive calculations inside requests
* synchronous external API calls that should be asynchronous

Do not optimize prematurely.

Only recommend optimization when there is a clear reason.

## Testing review

Check whether tests cover:

* happy path
* validation errors
* business rules
* authorization
* tenant isolation
* duplicate events
* edge cases
* external integration failures

## Flutter review

Check:

* widgets are not handling business logic
* state management is properly separated
* API calls are not directly inside UI widgets
* loading/error/empty states exist
* lifecycle is handled correctly
* unnecessary rebuilds are avoided
* navigation is centralized

## Review output

Return findings using:

```text
CRITICAL
Must be fixed before merge.

HIGH
Strongly recommended before merge.

MEDIUM
Should be addressed.

LOW
Improvement opportunity.

INFO
Observation.
```

For each finding provide:

```text
Location:
Problem:
Why it matters:
Recommended solution:
```

Do not rewrite large parts of the code unless necessary.

Do not introduce architectural changes unrelated to the reviewed feature.

## Final review

At the end provide:

```text
Architecture: PASS/FAIL
Security: PASS/FAIL
Business Rules: PASS/FAIL
Testing: PASS/FAIL
Performance: PASS/FAIL
Maintainability: PASS/FAIL

Blocking issues:
- ...

Non-blocking issues:
- ...
```

Do not mark a category as PASS if it was not actually reviewed.
