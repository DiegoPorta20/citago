# Flutter Development Skill

## Purpose

Define standards for building the mobile application using Flutter and Clean Architecture.

## Technology

* Flutter
* Dart
* Riverpod
* GoRouter
* Dio
* Freezed
* Flutter Secure Storage

## Architecture

Use:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Data
```

External infrastructure must never leak into presentation.

## Folder structure

```text
lib/
├── core/
│   ├── constants/
│   ├── errors/
│   ├── network/
│   ├── router/
│   ├── theme/
│   └── utils/
│
├── features/
│   ├── authentication/
│   ├── dashboard/
│   ├── appointments/
│   ├── clients/
│   ├── conversations/
│   ├── services/
│   ├── sales/
│   └── profile/
│
└── main.dart
```

Feature structure:

```text
appointments/
├── data/
│   ├── datasources/
│   ├── models/
│   └── repositories/
│
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── usecases/
│
└── presentation/
    ├── providers/
    ├── pages/
    └── widgets/
```

## UI principle

Widgets must focus on presentation.

Do not put:

```dart
Dio().get(...)
```

inside widgets.

Do not place business rules inside:

```text
build()
onPressed()
onTap()
```

Use providers/use cases.

## State management

Use Riverpod.

State should explicitly represent:

```text
initial
loading
success
empty
error
```

For example:

```text
AsyncLoading
AsyncData
AsyncError
```

Avoid unnecessary custom state classes when Riverpod's primitives are sufficient.

## Networking

All HTTP communication must go through a centralized Dio configuration.

Responsibilities:

* base URL
* headers
* authentication
* refresh token
* timeout
* error conversion
* interceptors

Feature repositories must not create independent Dio instances.

## Authentication

Store tokens securely.

Use:

```text
Flutter Secure Storage
```

Never store authentication tokens in plain SharedPreferences.

## API models

Separate:

```text
API Model
Domain Entity
```

Do not expose API models directly throughout the application.

Example:

```text
AppointmentModel
        ↓
AppointmentEntity
```

## Navigation

Use GoRouter.

Do not scatter navigation logic throughout business logic.

Handle protected routes centrally.

## Error handling

Every API request should handle:

```text
loading
success
empty
error
```

Display user-friendly messages.

Never show raw backend exceptions.

## UI/UX

The first version is mobile-first.

Prioritize:

* fast navigation
* large touch targets
* clear typography
* minimal input
* useful dashboard
* obvious appointment status
* conversation unread indicators

Main navigation:

```text
Dashboard
Agenda
Conversaciones
Clientes
Más
```

## Dashboard

The dashboard should prioritize:

```text
Today's revenue
Today's appointments
Clients attended
Pending conversations
Upcoming appointments
```

Avoid displaying too many metrics.

## Performance

Avoid:

* unnecessary rebuilds
* huge widget trees
* loading entire datasets
* repeated API calls
* expensive work inside build()

Use pagination for large lists.

## Offline considerations

The MVP may initially require an internet connection.

However, architecture should make future offline caching possible.

Do not tightly couple domain logic to network availability.

## Testing

Required:

* unit tests
* provider/state tests
* widget tests
* integration tests for critical flows

Critical flows:

```text
Login
View dashboard
Create appointment
Confirm appointment
Complete appointment
View conversation
View client
Register sale
```

## Accessibility

Consider:

* semantic labels
* sufficient touch targets
* readable font sizes
* contrast
* dynamic text sizes where possible

## Definition of Done

Flutter work is complete when:

* Clean Architecture is respected
* state management is separated
* API calls are abstracted
* loading/error/empty states exist
* authentication is secure
* tests pass
* no business logic exists inside widgets
* UI works on supported screen sizes
* lint/analyzer passes
