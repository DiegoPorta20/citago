import 'package:flutter/material.dart';

import '../../../../core/widgets/initials_avatar.dart';
import '../../domain/entities/client.dart';

class ClientAvatar extends StatelessWidget {
  const ClientAvatar({super.key, required this.client, this.radius = 22});

  final Client client;
  final double radius;

  @override
  Widget build(BuildContext context) =>
      InitialsAvatar(name: client.name, radius: radius);
}
