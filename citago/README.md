# CitaGo — Backend

API multi-tenant para negocios basados en citas. Primera vertical: barberías.

Stack: **NestJS 12 · TypeScript 6 · TypeORM 1 · MySQL 8 · REST · Jest · Swagger**

> El proyecto es **ESM** (`"type": "module"`). NestJS 12 se publica únicamente
> como ESM, así que los imports relativos llevan extensión `.js` aunque el
> archivo fuente sea `.ts`. No es un error: es el requisito de Node para ESM.

---

## Requisitos

- Node.js ≥ 24
- pnpm 11
- Docker (para MySQL en local)

## Puesta en marcha

```bash
cd citago
pnpm install
cp .env.example .env          # completar ENCRYPTION_KEY (ver abajo)
docker compose up -d          # MySQL en 3306 (dev) y 3307 (tests)
pnpm start:dev
```

- API: `http://localhost:3000/api/v1`
- Health: `http://localhost:3000/api/v1/health`
- Swagger: `http://localhost:3000/api/docs` (desactivable con `SWAGGER_ENABLED=false`)

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example) y **se validan al
arrancar**: si falta una o tiene un valor inválido, la aplicación no inicia.

`.env` y `.env.test` nunca se commitean.

`ENCRYPTION_KEY` es obligatoria: cifra los tokens de WhatsApp guardados en la
base. Se genera una por entorno:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### WhatsApp

Sin `WHATSAPP_APP_SECRET` ni `WHATSAPP_VERIFY_TOKEN` el webhook rechaza todo;
el resto de la API funciona igual y la bandeja se puede probar con el simulador
(`DEV_TOOLS_ENABLED=true`). Para conectar un número real:

1. En la app de Meta, configurar el webhook en
   `https://<host>/api/v1/webhooks/whatsapp` con el mismo `WHATSAPP_VERIFY_TOKEN`
   y suscribirse al campo `messages`.
2. Copiar el app secret en `WHATSAPP_APP_SECRET`.
3. Como OWNER o ADMIN: `PUT /api/v1/whatsapp/channel` con `phoneNumberId` y un
   token permanente de system user. CitaGo lo verifica con Meta antes de guardarlo.

Detalles en [ADR 0009](../docs/adr/0009-whatsapp-integration.md).

## Base de datos

- MySQL 8, InnoDB, `utf8mb4`, timestamps en **UTC** (`timezone: 'Z'`).
- **`synchronize` está desactivado en todos los entornos.** Todo cambio de
  schema pasa por una migración versionada.

```bash
pnpm migration:create src/database/migrations/AddSomething   # migración vacía
pnpm migration:generate src/database/migrations/AddSomething # borrador a revisar
pnpm migration:run
pnpm migration:revert
pnpm migration:show
```

Las migraciones generadas **siempre se revisan a mano**: claves foráneas
compuestas, `CHECK` y nombres de índices no se generan correctamente solos.

## Seed de desarrollo

```bash
pnpm seed
```

Crea datos claramente ficticios y se puede re-ejecutar: el tenant `Barbería Demo`
(PE / PEN / America/Lima), 6 servicios, 20 clientes, 2 profesionales con horario
semanal, ~50 citas en todos los estados y una venta cobrada por cada cita
completada, **recalculadas alrededor de hoy en cada ejecución** (las citas y las
ventas del tenant demo se reemplazan). Usuarios, contraseña
`Demo1234!`:

| Email | Rol |
|---|---|
| `owner@demo.local` | OWNER |
| `admin@demo.local` | ADMIN |
| `staff@demo.local` | STAFF |

El script **se niega a ejecutarse con `NODE_ENV=production`**.

## Tests

```bash
pnpm test        # unitarios — sin base de datos
pnpm test:int    # integración: constraints, claves foráneas y UTC contra MySQL de test
pnpm test:e2e    # end-to-end sobre la app real
pnpm test:cov    # cobertura de los unitarios
```

Los tests de integración aplican **todas las migraciones desde cero** antes de
correr, así que además verifican que el schema se puede construir de nuevo.

Los e2e usan `.env.test`, que apunta al contenedor `mysql-test` (tmpfs,
desechable), para que una corrida de tests no pueda tocar la base de desarrollo.

## Validaciones

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

El lint incluye **reglas de arquitectura**: `domain/` no puede importar NestJS,
TypeORM, transportes ni capas externas; `application/` no puede importar
infraestructura ni presentación.

## Estructura

```text
src/
├── config/            variables de entorno validadas y constantes de la API
├── database/          DataSource, migraciones y seeds
├── modules/           un bounded context por carpeta
│   └── <context>/
│       ├── domain/          entidades, value objects, errores, contratos de repositorio
│       ├── application/     casos de uso y puertos
│       ├── infrastructure/  repositorios TypeORM, mappers, adapters
│       └── presentation/    controllers y DTOs HTTP
├── shared/            domain / application / infrastructure / presentation comunes
├── app.module.ts
├── app.setup.ts       pipeline HTTP global (compartido con los tests e2e)
└── main.ts
```

La estructura crece con la funcionalidad: no se crean carpetas vacías.

## Convenciones

- Código en inglés; documentación y explicaciones en español.
- Sin lógica de negocio en controllers, DTOs ni entidades de TypeORM.
- Toda entidad de un tenant se consulta **siempre** con `tenantId`.
- Dinero en `DECIMAL(12,2)`, nunca en coma flotante.
- Respuestas: `{ data, meta }`. Errores: `{ statusCode, code, message, details, timestamp, path }`.

Decisiones de arquitectura: [`../docs/adr/`](../docs/adr). Reglas de negocio:
[`../docs/business-rules.md`](../docs/business-rules.md).
