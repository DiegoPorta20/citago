# Project Guidelines

## Product

This project is a multi-tenant SaaS platform for appointment-based
businesses.

The first vertical is barbershops.

The platform integrates with WhatsApp Business Platform to receive
customer messages and convert conversations into business actions.

## Architecture

Backend:
- NestJS
- TypeScript
- Clean Architecture
- Domain-Driven Design principles
- MySQL
- Type Orm
- Redis/BullMQ when asynchronous processing is required

Mobile:
- Flutter
- Dart
- Clean Architecture
- Riverpod
- Dio
- GoRouter

## Rules

- All code must be written in English.
- Explanations can be written in Spanish.
- Do not place business logic inside controllers.
- Do not access repositories directly from controllers.
- Use cases contain application orchestration.
- Domain entities must not depend on infrastructure.
- Infrastructure implements domain interfaces.
- Every tenant-owned entity must contain tenant_id.
- Never allow cross-tenant data access.
- External integrations must be isolated behind adapters.
- WhatsApp integration must never leak into domain entities.
- External webhook events must be idempotent.
- Never store WhatsApp access tokens in plaintext.
- Never commit secrets.
- Use environment variables.
- Write tests for business rules.
- Prefer small and composable use cases.