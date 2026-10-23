import 'package:flutter/material.dart';

import '../../../../core/widgets/list_card.dart';
import '../../domain/entities/client.dart';
import 'client_avatar.dart';

/// Client row shared by the client list and the client picker.
class ClientCard extends StatelessWidget {
  const ClientCard({super.key, required this.client, required this.onTap});

  final Client client;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final phone = client.phone;
    return ListCard(
      leading: ClientAvatar(client: client),
      title: client.name,
      subtitle: phone == null || phone.isEmpty
          ? null
          : ListCardSubtitle(phone, icon: Icons.phone_outlined),
      onTap: onTap,
    );
  }
}
