# ADR 0004 — Aislamiento entre tenants en cuatro capas

- Fecha: 2026-09-17
- Estado: aceptada

## Contexto

Un usuario del negocio A jamás debe acceder a datos del negocio B. MySQL no
tiene seguridad a nivel de fila, así que la garantía debe construirse.

## Decisión

```text
1. Guard         JWT válido + membresía activa + tenant activo → AuthContext
2. Caso de uso   recibe AuthContext explícito; nunca un tenantId del cliente
3. Repositorio   TODO método de una entidad de negocio exige tenantId en su firma
4. Base de datos claves foráneas compuestas (tenant_id, x_id) → tabla(tenant_id, id)
```

La cuarta capa es la más valiosa: la base de datos **rechaza** una cita asociada
a un cliente de otro tenant aunque haya un bug en la aplicación. Requiere
`UNIQUE(tenant_id, id)` en cada tabla de negocio, lo que además permite `UPDATE`
y `DELETE` por clave única con el tenant incluido.

Reglas complementarias:

- Un recurso de otro tenant devuelve **404**, no 403: no se filtra su existencia.
- `ON DELETE SET NULL` está prohibido en claves foráneas compuestas con tenant
  (pondría `tenant_id` en NULL). Se usa `RESTRICT`.
- `ValidationPipe` con `whitelist` y `forbidNonWhitelisted` rechaza cualquier
  `tenantId` enviado en el body.
- Excepciones documentadas, en repositorios que no son de negocio:
  `UserRepository.findByEmail`, `RefreshTokenRepository.findByHash`,
  `WhatsAppChannelRepository.findByPhoneNumberId`.
- Toda feature incluye un test e2e donde el tenant A recibe 404 al pedir un
  recurso del tenant B.

## Validación

El mecanismo de la cuarta capa está verificado contra MySQL 8 real en
`citago/src/database/schema-guarantees.int-spec.ts`: una fila hija que
referencia un padre de otro tenant es **rechazada por la base de datos**. Las
tablas reales (clientes, citas, ventas) aplicarán el patrón en su fase.

## Alternativa descartada

Una extensión del ORM que inyecte `tenant_id` automáticamente: implícita, no
cubre SQL crudo y oculta errores en los tests.
