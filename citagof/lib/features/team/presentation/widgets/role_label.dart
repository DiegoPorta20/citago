import '../../../authentication/domain/entities/auth_session.dart';

String roleLabel(UserRole role) => switch (role) {
  UserRole.owner => 'Propietario',
  UserRole.admin => 'Administrador',
  UserRole.staff => 'Profesional',
};
