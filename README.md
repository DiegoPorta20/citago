# CitaGo

SaaS multi-tenant para negocios basados en citas. Primera vertical: **barberías**.

| Carpeta | Descripción | Stack |
| --- | --- | --- |
| [`citago/`](./citago) | Backend (API REST) | NestJS 12 · TypeScript 6 · TypeORM 1 · MySQL 8 |
| [`citagof/`](./citagof) | App móvil | Flutter · Riverpod · GoRouter · Dio |
| [`docs/`](./docs) | Arquitectura, reglas de negocio y decisiones (ADR) | — |

## Backend

```bash
cd citago
pnpm install
cp .env.example .env
docker compose up -d      # MySQL 8: 3306 (desarrollo) y 3307 (tests)
pnpm start:dev
```

- API: `http://localhost:3000/api/v1`
- Health: `http://localhost:3000/api/v1/health`
- Swagger: `http://localhost:3000/api/docs`

Detalle de variables, migraciones y tests: [`citago/README.md`](./citago/README.md).

## App móvil

```bash
cd citagof
flutter pub get
flutter run
```

> Todavía es la plantilla generada por Flutter. Se implementa después de
> validar el backend.

## Documentación

- [Arquitectura](./docs/architecture.md)
- [Matriz de permisos](./docs/permissions.md)
- [Reglas de negocio](./docs/business-rules.md)
- [Decisiones de arquitectura (ADR)](./docs/adr)

## Convenciones

- El código se escribe en **inglés**; la documentación, en **español**.
- Multi-tenant desde el inicio: ninguna consulta de datos de un negocio se
  ejecuta sin su `tenantId`, que siempre proviene del contexto autenticado.
- Sin lógica de negocio en controllers, DTOs ni entidades de TypeORM.
- Ninguna tecnología se incorpora antes de que una funcionalidad la necesite.
