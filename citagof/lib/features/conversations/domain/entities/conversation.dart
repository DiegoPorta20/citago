enum ConversationChannel {
  whatsapp,
  instagram,
  messenger,
  web,
  other;

  static ConversationChannel parse(String value) => switch (value) {
    'WHATSAPP' => ConversationChannel.whatsapp,
    'INSTAGRAM' => ConversationChannel.instagram,
    'MESSENGER' => ConversationChannel.messenger,
    'WEB' => ConversationChannel.web,
    _ => ConversationChannel.other,
  };
}

enum ConversationStatus {
  open,
  archived;

  static ConversationStatus parse(String value) => switch (value) {
    'OPEN' => ConversationStatus.open,
    'ARCHIVED' => ConversationStatus.archived,
    _ => ConversationStatus.open,
  };

  bool get isArchived => this == ConversationStatus.archived;
}

class ConversationClient {
  const ConversationClient({required this.id, required this.name});

  final String id;
  final String name;
}

class Conversation {
  const Conversation({
    required this.id,
    required this.channel,
    required this.contactIdentifier,
    required this.status,
    required this.needsReply,
    this.contactName,
    this.client,
    this.assignedUserId,
    this.assignedUserName,
    this.lastMessageAt,
    this.lastMessagePreview,
  });

  final String id;
  final ConversationChannel channel;

  final String contactIdentifier;

  final String? contactName;

  final ConversationClient? client;

  final String? assignedUserId;

  final String? assignedUserName;
  final ConversationStatus status;

  final bool needsReply;

  final DateTime? lastMessageAt;
  final String? lastMessagePreview;

  bool get isUnlinked => client == null;

  String get displayName {
    final clientName = client?.name.trim();
    if (clientName != null && clientName.isNotEmpty) {
      return clientName;
    }
    final name = contactName?.trim();
    if (name != null && name.isNotEmpty) {
      return name;
    }
    return contactIdentifier;
  }
}
