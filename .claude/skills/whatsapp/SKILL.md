# WhatsApp Integration Skill

WhatsApp integration must be isolated from business logic.

Architecture:

WhatsApp Webhook
    ↓
Webhook Controller
    ↓
Webhook Parser
    ↓
Message Processing Use Case
    ↓
Conversation Domain
    ↓
Client Domain
    ↓
Business Events

Rules:

- Validate webhook signatures.
- Validate webhook verification requests.
- Store external message IDs.
- Guarantee idempotency.
- Never process the same external message twice.
- Do not trust incoming customer data.
- Normalize phone numbers.
- Do not expose Meta-specific payloads to domain entities.
- Use adapters for Meta API communication.
- Handle retries safely.
- Log integration failures.
- Never log access tokens.