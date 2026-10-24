class AppFailure implements Exception {
  const AppFailure({
    required this.message,
    this.code,
    this.statusCode,
    this.details,
    this.isNetwork = false,
  });

  final String? code;

  final String message;

  final int? statusCode;

  final Map<String, dynamic>? details;

  final bool isNetwork;

  bool get isUnauthorized => statusCode == 401;

  String? detail(String key) {
    final value = details?[key];
    return value is String ? value : null;
  }

  @override
  String toString() => 'AppFailure($code, $statusCode, $message)';
}

const Map<String, String> _messagesByCode = {
  'INVALID_CREDENTIALS': 'Correo o contraseña incorrectos.',
  'EMAIL_ALREADY_REGISTERED': 'Ya existe una cuenta con ese correo.',
  'NO_ACTIVE_MEMBERSHIP': 'Tu acceso a este negocio no está activo.',
  'MEMBERSHIP_REVOKED': 'Tu acceso a este negocio fue revocado.',
  'TENANT_SUSPENDED': 'Este negocio está suspendido.',
  'INVALID_REFRESH_TOKEN': 'Tu sesión expiró. Inicia sesión de nuevo.',
  'UNAUTHORIZED': 'Tu sesión expiró. Inicia sesión de nuevo.',
  'FORBIDDEN': 'No tienes permiso para hacer esto.',
  'INSUFFICIENT_ROLE': 'No tienes permiso para hacer esto.',
  'TOO_MANY_REQUESTS': 'Demasiados intentos. Espera un momento.',
  'VALIDATION_ERROR': 'Revisa los datos e inténtalo de nuevo.',
  'INVALID_CLIENT_DATA': 'Revisa los datos del cliente.',
  'CLIENT_NOT_FOUND': 'No encontramos a ese cliente.',
  'CLIENT_PHONE_ALREADY_REGISTERED': 'Ya existe un cliente con ese teléfono.',
  'CLIENT_DELETED_WITH_SAME_PHONE':
      'Un cliente eliminado usa ese teléfono. Puedes restaurarlo.',
  'CLIENT_ALREADY_DELETED': 'Ese cliente ya está eliminado.',
  'SERVICE_NOT_FOUND': 'No encontramos ese servicio.',
  'DUPLICATE_SERVICE_NAME': 'Ya existe un servicio activo con ese nombre.',
  'INVALID_SERVICE_DATA': 'Revisa los datos del servicio.',
  'STAFF_MEMBER_NOT_FOUND': 'No encontramos a ese profesional.',
  'INVALID_STAFF_DATA': 'Revisa los datos del profesional.',
  'USER_NOT_MEMBER_OF_TENANT': 'Esa cuenta no pertenece a este negocio.',
  'USER_ALREADY_LINKED_TO_STAFF':
      'Esa cuenta ya está vinculada a otro profesional.',
  'TIME_OFF_NOT_FOUND': 'No encontramos esa ausencia.',
  'INVALID_TIME_OFF': 'Revisa las fechas de la ausencia.',
  'APPOINTMENT_NOT_FOUND': 'No encontramos esa cita.',
  'INVALID_APPOINTMENT_TRANSITION':
      'Esa cita no puede pasar a ese estado desde el actual.',
  'APPOINTMENT_OVERLAP': 'Ese profesional ya tiene una cita en ese horario.',
  'OUTSIDE_STAFF_SCHEDULE': 'El profesional no atiende en ese horario.',
  'STAFF_ON_TIME_OFF': 'El profesional tiene una ausencia en ese horario.',
  'APPOINTMENT_SPANS_DAYS': 'La cita debe empezar y terminar el mismo día.',
  'APPOINTMENT_IN_THE_PAST': 'No se puede reservar en el pasado.',
  'APPOINTMENT_NOT_RESCHEDULABLE': 'Esa cita ya no se puede reagendar.',
  'CANCELLATION_REASON_REQUIRED': 'Indica el motivo de la cancelación.',
  'NO_SHOW_BEFORE_START':
      'No se puede marcar inasistencia antes de la hora de inicio.',
  'SERVICE_NOT_BOOKABLE': 'Ese servicio no admite citas nuevas.',
  'STAFF_MEMBER_NOT_BOOKABLE': 'Ese profesional no admite citas nuevas.',
  'AGENDA_RANGE_TOO_WIDE': 'El rango de fechas es demasiado amplio.',
  'INVALID_APPOINTMENT_DATA': 'Revisa los datos de la cita.',
  'OWN_AGENDA_ONLY': 'Solo puedes gestionar tu propia agenda.',
  'SCHEDULE_OVERRIDE_NOT_ALLOWED':
      'Solo el propietario o un administrador puede saltarse el horario.',
  'SALE_NOT_FOUND': 'No encontramos esa venta.',
  'INVALID_SALE_TRANSITION': 'Esa venta no puede pasar a ese estado.',
  'APPOINTMENT_ALREADY_BILLED': 'Esa cita ya tiene una venta registrada.',
  'APPOINTMENT_NOT_BILLABLE': 'Solo se cobra una cita completada.',
  'DISCOUNT_ABOVE_SUBTOTAL': 'El descuento no puede superar el subtotal.',
  'VOID_REASON_REQUIRED': 'Indica el motivo.',
  'PAYMENT_METHOD_REQUIRED': 'Elige el método de pago.',
  'INVALID_SALE_DATA': 'Revisa los datos de la venta.',
  'OWN_SALES_ONLY': 'Solo puedes ver y registrar tus propias ventas.',
  'CONVERSATION_NOT_FOUND': 'No encontramos esa conversación.',
  'INVALID_MESSAGE': 'El mensaje no es válido.',
  'CHANNEL_NOT_CONNECTED': 'El canal de WhatsApp no está conectado.',
  'REPLY_WINDOW_CLOSED': 'Pasaron más de 24 horas desde el último mensaje del cliente: ya no se puede responder con texto libre.',
  'MESSAGE_DELIVERY_FAILED':
      'No se pudo enviar el mensaje. Inténtalo de nuevo.',
  'ASSIGNEE_NOT_MEMBER': 'Esa persona no es parte del equipo.',
  'USER_ALREADY_IN_TEAM': 'Esa persona ya tiene acceso al negocio.',
  'ROLE_CHANGE_NOT_ALLOWED': 'No tienes permiso para asignar ese rol.',
  'CANNOT_CHANGE_OWN_ACCESS':
      'No puedes cambiar tu propio rol ni revocar tu acceso.',
  'LAST_OWNER': 'El negocio debe conservar al menos un propietario activo.',
  'MEMBERSHIP_NOT_FOUND': 'No encontramos ese acceso.',
  'INVALID_TEAM_MEMBER_DATA': 'Revisa los datos del acceso.',
  'WHATSAPP_CREDENTIALS_REJECTED':
      'Meta rechazó las credenciales. Revisa el identificador y el token.',
  'WHATSAPP_NUMBER_IN_USE': 'Ese número ya está conectado en otro negocio.',
  'WHATSAPP_UNAVAILABLE':
      'No pudimos contactar con WhatsApp. Inténtalo de nuevo.',
  'INVALID_WHATSAPP_CHANNEL_DATA': 'Revisa los datos del canal de WhatsApp.',
  'SUBSCRIPTION_EXPIRED':
      'Tu prueba gratis terminó. Elige un plan para volver a hacer cambios.',
  'UNKNOWN_PLAN': 'Ese plan no existe.',
  'SUBSCRIPTION_NOT_FOUND': 'Este negocio no tiene una suscripción.',
};

AppFailure failureFromApi({
  required int? statusCode,
  required String? code,
  Map<String, dynamic>? details,
}) {
  final byCode = code == null ? null : _messagesByCode[code];
  if (byCode != null) {
    return AppFailure(
      message: byCode,
      code: code,
      statusCode: statusCode,
      details: details,
    );
  }
  final message = switch (statusCode) {
    429 => _messagesByCode['TOO_MANY_REQUESTS']!,
    403 => _messagesByCode['FORBIDDEN']!,
    404 => 'No encontramos lo que buscabas.',
    final int s when s >= 500 =>
      'El servidor tuvo un problema. Inténtalo de nuevo.',
    _ => 'Algo salió mal. Inténtalo de nuevo.',
  };
  return AppFailure(
    message: message,
    code: code,
    statusCode: statusCode,
    details: details,
  );
}

const AppFailure networkFailure = AppFailure(
  message: 'No se pudo conectar con el servidor. Revisa tu conexión.',
  isNetwork: true,
);

String failureMessage(Object error) =>
    error is AppFailure ? error.message : 'Algo salió mal. Inténtalo de nuevo.';
