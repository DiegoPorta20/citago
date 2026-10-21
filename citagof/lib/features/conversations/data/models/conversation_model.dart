import '../../domain/entities/conversation.dart';
import '../../domain/entities/message.dart';

Conversation conversationFromJson(Map<String, dynamic> json) {
  final clientJson = json['client'] as Map<String, dynamic>?;
  return Conversation(
    id: json['id'] as String,
    channel: ConversationChannel.parse(json['channel'] as String),
    contactIdentifier: json['contactIdentifier'] as String,
    contactName: json['contactName'] as String?,
    client: clientJson == null
        ? null
        : ConversationClient(
            id: clientJson['id'] as String,
            name: clientJson['name'] as String,
          ),
    assignedUserId: json['assignedUserId'] as String?,
    assignedUserName: json['assignedUserName'] as String?,
    status: ConversationStatus.parse(json['status'] as String),
    needsReply: json['needsReply'] as bool? ?? false,
    lastMessageAt: _parseInstant(json['lastMessageAt'] as String?),
    lastMessagePreview: json['lastMessagePreview'] as String?,
  );
}

Message messageFromJson(Map<String, dynamic> json) => Message(
  id: json['id'] as String,
  direction: MessageDirection.parse(json['direction'] as String),
  type: MessageType.parse(json['type'] as String),
  body: json['body'] as String?,
  sentAt: DateTime.parse(json['sentAt'] as String).toUtc(),
  authorUserId: json['authorUserId'] as String?,
);

Map<String, dynamic> sendReplyBody(String body) => {'body': body};

Map<String, dynamic> linkClientBody(String? clientId) => {'clientId': clientId};

Map<String, dynamic> assignBody(String? userId) => {'userId': userId};

DateTime? _parseInstant(String? value) =>
    value == null ? null : DateTime.parse(value).toUtc();
