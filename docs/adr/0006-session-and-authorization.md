# ADR 0006 — Sesiones y autorización

- Fecha: 2026-09-17
- Estado: aceptada

## Contexto

La especificación pedía JWT y distinguir autenticación de autorización, sin
definir cómo se revocan las sesiones ni de dónde sale el rol.

## Decisiones

### 1. Usuario y negocio se relacionan por `Membership` (decisión B1)

Un `User` es global a la plataforma (email único global) y una `Membership` le
da acceso a un tenant con un rol. Alternativa descartada: `users.tenant_id`,
que obliga a conocer el negocio **antes** de autenticar o impide que una persona
trabaje en dos negocios.

### 2. Par de tokens: acceso corto + refresh rotativo

| | Access token | Refresh token |
|---|---|---|
| Formato | JWT HS256 | 256 bits aleatorios, opaco |
| Duración | 15 min (configurable 60–3600 s) | 30 días |
| Almacenamiento | No se guarda | **Solo su hash SHA-256** |
| Claims | `sub`, `tid`, `mid` | — |

- **El rol no va en el token.** Se lee de la membresía en cada request, así que
  revocar un acceso o cambiar un rol surte efecto de inmediato. Cuesta una
  consulta por clave primaria por request.
- **SHA-256 para el refresh, argon2id para contraseñas.** El refresh son 256
  bits aleatorios: no hay nada que adivinar, así que un KDF lento no aporta.
  Una contraseña la eligió una persona, y ahí sí hace falta.

### 3. Rotación con detección de reutilización

Cada refresh emite un token nuevo y marca el anterior como rotado. Si se
presenta uno ya rotado, **se revoca toda la familia**: significa que se filtró,
y tanto el atacante como el usuario legítimo deben autenticarse de nuevo.

### 4. `refresh_tokens` guarda `tenant_id`

El flujo de refresh resuelve la sesión solo desde el token, sin access token del
que leer el tenant. Guardarlo permite llamar a
`MembershipRepository.findByIdForTenant(...)` y así **ningún** método del
repositorio necesita una variante "por id sin tenant".

### 5. Autenticación deny by default

`JwtAuthGuard` es guard global: todo endpoint es privado salvo que declare
`@Public()`. Olvidar el decorador deja el endpoint protegido (seguro), y abrir
uno nuevo es visible en la revisión.

### 6. Autorización en dos niveles

`@Roles(...)` decide si un rol puede usar un endpoint; el caso de uso decide qué
filas puede tocar. La matriz está en [permissions.md](../permissions.md).

### 7. Respuestas que no filtran información

- Email desconocido y contraseña incorrecta devuelven el **mismo** error, y el
  login verifica un hash ficticio cuando la cuenta no existe, para que el tiempo
  de respuesta tampoco delate qué emails están registrados.
- Cerrar sesión con un token inexistente devuelve 204: no sirve como oráculo.
- Los endpoints de auth tienen su propio límite de peticiones, más estricto que
  el global.

## Pendiente

- Recuperación de contraseña (necesita proveedor de email, decisión B9).
- Cambio de negocio (`POST /auth/switch-tenant`) cuando exista el selector: el
  modelo ya lo soporta. Hoy el login entra a la membresía activa más antigua.
