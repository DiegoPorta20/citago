# Matriz de permisos

Los roles pertenecen al **tenant**, no a la plataforma: una persona es OWNER de
un negocio, no "OWNER" en abstracto. El rol se lee de la membresía en cada
request, así que revocar un acceso o cambiar un rol tiene efecto inmediato.

> ⚠️ **Propuesta inicial, pendiente de tu confirmación (decisión B6).** Está
> implementada solo en la parte que ya existe (autenticación); el resto se
> aplica al construir cada módulo.

## Roles

| Rol | Quién es |
|---|---|
| `OWNER` | El dueño del negocio. Siempre existe al menos uno activo (regla ID-1). |
| `ADMIN` | Encargado o administrador. Opera el negocio pero no lo controla. |
| `STAFF` | Trabajador que atiende. |

## Dos niveles de autorización

| Nivel | Dónde | Qué decide |
|---|---|---|
| Grueso | `@Roles(...)` en el controller | Si el rol puede usar ese endpoint |
| Por recurso | Dentro del caso de uso | **Qué filas** puede ver o tocar ese rol |

El tenant nunca se decide en ninguno de los dos niveles: lo garantizan el
repositorio y la base de datos ([ADR 0004](./adr/0004-tenant-isolation.md)).

## Matriz propuesta

| Capacidad | OWNER | ADMIN | STAFF |
|---|---|---|---|
| **Sesión** | | | |
| Iniciar sesión, refrescar, cerrar sesión, ver `/auth/me` | ✅ | ✅ | ✅ |
| **Negocio** | | | |
| Ver configuración del negocio | ✅ | ✅ | ✅ |
| Editar configuración (moneda, zona horaria, horario) | ✅ | ✅ | ❌ |
| Suspender o dar de baja el negocio | ✅ | ❌ | ❌ |
| **Usuarios y accesos** | | | |
| Ver usuarios del negocio | ✅ | ✅ | ❌ |
| Invitar usuarios como STAFF | ✅ | ✅ | ❌ |
| Invitar o modificar usuarios ADMIN u OWNER | ✅ | ❌ | ❌ |
| Revocar el acceso de un STAFF | ✅ | ✅ | ❌ |
| Revocar el acceso de un ADMIN u OWNER | ✅ | ❌ | ❌ |
| **Servicios** | | | |
| Ver servicios | ✅ | ✅ | ✅ |
| Crear, editar, activar o desactivar servicios | ✅ | ✅ | ❌ |
| **Profesionales** | | | |
| Ver profesionales y sus horarios | ✅ | ✅ | ✅ |
| Crear o editar profesionales y horarios | ✅ | ✅ | ❌ |
| **Clientes** | | | |
| Ver y buscar clientes | ✅ | ✅ | ✅ |
| Crear y editar clientes | ✅ | ✅ | ✅ |
| Eliminar (borrado lógico) un cliente | ✅ | ✅ | ❌ |
| **Citas** | | | |
| Ver la agenda completa del negocio | ✅ | ✅ | ❌ |
| Ver su propia agenda | ✅ | ✅ | ✅ |
| Crear y reagendar citas de cualquier profesional | ✅ | ✅ | ❌ |
| Crear y reagendar sus propias citas | ✅ | ✅ | ✅ |
| Confirmar, marcar llegada, iniciar y completar sus citas | ✅ | ✅ | ✅ |
| Cancelar o marcar `NO_SHOW` en sus citas | ✅ | ✅ | ✅ |
| Cancelar citas de otro profesional | ✅ | ✅ | ❌ |
| Deshacer un `COMPLETED` (decisión F6) | ✅ | ✅ | ❌ |
| **Ventas** | | | |
| Registrar una venta de su atención | ✅ | ✅ | ✅ |
| Ver todas las ventas del negocio | ✅ | ✅ | ❌ |
| Anular una venta | ✅ | ✅ | ❌ |
| **Conversaciones** | | | |
| Ver y responder conversaciones | ✅ | ✅ | ✅ |
| Archivar conversaciones | ✅ | ✅ | ❌ |
| Configurar el canal de WhatsApp | ✅ | ✅ | ❌ |
| **Dashboard** | | | |
| Ver ingresos y métricas del negocio | ✅ | ✅ | ❌ |
| Ver sus propias métricas (atenciones del día) | ✅ | ✅ | ✅ |

## Criterio detrás de la propuesta

1. **STAFF opera, no administra.** Puede hacer su trabajo (atender, cobrar lo
   suyo, hablar con clientes) pero no ve el dinero del negocio ni cambia su
   configuración.
2. **ADMIN administra, no controla el acceso de sus pares.** Un ADMIN no puede
   promover a nadie ni quitarse de encima a otro ADMIN o al OWNER.
3. **OWNER es el único con poder sobre la cuenta.**
4. **"Lo suyo" significa las citas de su ficha de profesional**, vinculada a su
   cuenta de usuario.

Puntos que conviene que confirmes:

- ¿STAFF debe ver la agenda **completa** del negocio? En una barbería pequeña
  suele ser útil y es lo que esperan; la propuesta actual es más restrictiva.
- ¿STAFF debe ver sus propios ingresos generados? Afecta comisiones futuras.
- ¿ADMIN debe poder anular ventas, o solo el OWNER?
