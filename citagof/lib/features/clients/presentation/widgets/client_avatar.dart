import 'package:flutter/material.dart';

import '../../domain/entities/client.dart';

class ClientAvatar extends StatelessWidget {
  const ClientAvatar({super.key, required this.client, this.radius = 20});

  final Client client;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: radius,
      child: ExcludeSemantics(
        child: Text(client.initials.isEmpty ? '?' : client.initials),
      ),
    );
  }
}
