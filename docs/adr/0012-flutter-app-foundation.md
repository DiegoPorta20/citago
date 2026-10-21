# ADR 0012 — Base de la app Flutter: sesión, red y navegación

- Fecha: 2026-10-20
- Estado: aceptada

## Contexto

El backend está completo (ADR 0001–0011). La app Flutter era la plantilla. Antes
de construir pantallas de negocio hace falta decidir cómo se guarda la sesión,
cómo se renuevan los tokens y cómo se protegen las rutas.

## Decisiones

### 1. Dependencias mínimas

`flutter_riverpod`, `go_router`, `dio` y `flutter_secure_storage`. **No** se
incorpora Freezed ni generación de código: los modelos son clases Dart simples
mientras no haya un problema real que justifique el generador (mismo criterio
que Redis/BullMQ en el backend).

### 2. Tokens en el almacén seguro, un único Dio

Access y refresh viven en Keystore/Keychain (`SecureTokenStorage`), nunca en
SharedPreferences. Todas las peticiones pasan por un único `Dio`
(`core/network/providers.dart`) con `AuthInterceptor`.

### 3. Renovación: una sola llamada por rotación

El refresh token rota en cada uso y reutilizar uno rotado revoca toda la familia
([ADR 0006](./0006-session-and-authorization.md)). Por eso varios 401
simultáneos **comparten una única** llamada a `/auth/refresh`, y una petición que
falló con un token que otra ya renovó solo se reintenta con el nuevo.

- Si el servidor **rechaza** el refresh (401): se borran los tokens y se cierra
  la sesión.
- Si **no se puede alcanzar** al servidor: la sesión se conserva y el error
  original llega a la pantalla. Arrancar sin conexión no desconecta a nadie.

### 4. El rol se lee del servidor, no del token

Al arrancar y tras el login se llama a `GET /auth/me`. El rol determina qué
dashboard se pide (`/dashboard/summary` para OWNER/ADMIN, `/dashboard/me` para
STAFF), pero la autorización real sigue en el backend: la app solo evita pedir
lo que va a recibir un 403.

### 5. Rutas protegidas en un solo lugar

`redirectFor` (en `app_router.dart`) decide a dónde puede estar el usuario a
partir de la sesión: splash mientras se verifica, login si no hay sesión, inicio
si ya la hay. Las páginas no comprueban nada.

### 6. "Hoy" lo decide el servidor

El dashboard se pide sin fechas: el backend responde con el día actual en la zona
horaria del **negocio** (regla TZ-2), no la del teléfono.

### 7. Dinero

Los importes se muestran con `formatMoney`, que opera sobre el string decimal y
nunca lo convierte a `double`.

## Consecuencias

- Cada nueva feature copia el patrón `domain / data / presentation` de
  `authentication` y `dashboard`.
- Las secciones Agenda, Conversaciones y Clientes se implementan en el
  [ADR 0013](./0013-flutter-business-screens.md).
- Pendiente: selector de negocio (`switch-tenant`, ADR 0006) y recuperación de
  contraseña (requieren backend).
