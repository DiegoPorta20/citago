# Security Skill

Always consider:

- Authentication
- Authorization
- Tenant isolation
- Input validation
- Rate limiting
- Webhook signature validation
- Secret management
- SQL injection
- IDOR
- Broken access control
- Sensitive logging
- Token leakage
- Mass assignment

Never trust tenant_id from the client.

Tenant context must come from the authenticated user/session.