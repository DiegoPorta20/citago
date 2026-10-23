# citagof — App móvil

App de CitaGo para el dueño, los administradores y los profesionales de la
barbería. Consume la API de [`../citago`](../citago).

Stack: **Flutter · Riverpod 3 · GoRouter · Dio · Flutter Secure Storage**

## Puesta en marcha

```bash
cd citagof
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

Sin `API_BASE_URL` apunta a `http://10.0.2.2:3000/api/v1`, que es como el
emulador de Android ve el `localhost` del equipo. En simulador de iOS, escritorio
o web usa `localhost`. En un teléfono físico, la IP del equipo en la red local.

Para probar con datos: levantar el backend, ejecutar `pnpm seed` y entrar con
`owner@demo.local` / `Demo1234!` (OWNER), `admin@demo.local` (ADMIN) o
`staff@demo.local` (STAFF).

## Validaciones

```bash
flutter analyze && flutter test
```

## Diseño

- Tema en `lib/core/theme/`: paleta clara/oscura (carbón cálido + dorado), tipografía
  **Inter** (empaquetada en `assets/fonts/`, licencia OFL), tokens de espacio/radio
  (`app_tokens.dart`) y colores semánticos de estado (`AppStatusColors`).
- Los estados (citas, ventas) se mapean a un `StatusTone`; ninguna pantalla elige
  colores a mano. Se muestran con `StatusPill`.
- Componentes compartidos en `lib/core/widgets/`: `AppCard`, `StatusPill`,
  `SectionHeader`, `EmptyState`, `InitialsAvatar`, `PeriodHeader` y `WeekStrip`.
- Las semanas van de **lunes a domingo** y los meses son calendario; los cálculos
  viven en `BusinessClock` (nunca en los widgets). Ventas: Día / Semana / Mes.
- La app está en español (`es`) incluyendo los selectores de fecha del sistema.

## Estado

| Sección | Estado |
|---|---|
| Inicio de sesión, registro de negocio, sesión persistente, cierre de sesión | implementado |
| Inicio: ingresos, citas, clientes nuevos, chats pendientes, próximas citas (STAFF ve solo sus atenciones, sin dinero) | implementado |
| Agenda: día por profesional, reservar con huecos, estados, reagendar, cancelar | implementado |
| Cobro de una cita completada | implementado |
| Conversaciones: bandeja, hilo, responder, resolver, vincular cliente, archivar | implementado |
| Clientes: lista con búsqueda, alta, edición, eliminar y restaurar | implementado |
| Más: ventas (lista, cobrar, anular, reembolsar), servicios, profesionales (horario y ausencias), equipo y accesos, mi negocio (datos y horario), WhatsApp | implementado |
| Cambiar de negocio (si tienes acceso a varios) | implementado |
| Asignar conversaciones | implementado |

Decisiones: [ADR 0012](../docs/adr/0012-flutter-app-foundation.md) y
[ADR 0013](../docs/adr/0013-flutter-business-screens.md).
## Estructura

```text
lib/
├── core/            config, errores, red (Dio + refresh), router, hora del negocio, tema, widgets
├── features/
│   └── <feature>/
│       ├── domain/        entidades, contrato del repositorio, casos de uso
│       ├── data/          datasources, modelos de API, implementación
│       └── presentation/  providers (Riverpod), pages, widgets
└── main.dart
```

## Convenciones

- Código en inglés; textos de la interfaz y documentación en español.
- Los widgets no llaman a la red ni contienen reglas de negocio.
- Un solo `Dio` (`core/network/providers.dart`); los repositorios no crean el suyo.
- Modelo de API y entidad de dominio van separados.
- Toda pantalla con datos maneja carga, vacío y error; nunca se muestra el
  mensaje crudo del backend.
- El dinero llega como string decimal y se opera/muestra sin pasar por `double`.
- Fechas y horas siempre en la zona del negocio (`BusinessClock`), nunca la del teléfono.
- Cada feature publica sus rutas en `<feature>_routes.dart`.
