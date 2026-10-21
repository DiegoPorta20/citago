enum MessageDirection {
  inbound,
  outbound;

  static MessageDirection parse(String value) => switch (value) {
    'INBOUND' => MessageDirection.inbound,
    'OUTBOUND' => MessageDirection.outbound,
    _ => MessageDirection.inbound,
  };

  bool get isInbound => this == MessageDirection.inbound;
  bool get isOutbound => this == MessageDirection.outbound;
}

enum MessageType {
  text,
  image,
  audio,
  video,
  document,
  location,
  other;

  static MessageType parse(String value) => switch (value) {
    'TEXT' => MessageType.text,
    'IMAGE' => MessageType.image,
    'AUDIO' => MessageType.audio,
    'VIDEO' => MessageType.video,
    'DOCUMENT' => MessageType.document,
    'LOCATION' => MessageType.location,
    _ => MessageType.other,
  };

  bool get isText => this == MessageType.text;
}

class Message {
  const Message({
    required this.id,
    required this.direction,
    required this.type,
    required this.sentAt,
    this.body,
    this.authorUserId,
  });

  final String id;
  final MessageDirection direction;
  final MessageType type;

  final String? body;

  final DateTime sentAt;

  final String? authorUserId;
}

const Duration whatsappReplyWindow = Duration(hours: 24);

bool replyWindowOpen({
  required DateTime? lastInboundAt,
  required DateTime now,
  Duration window = whatsappReplyWindow,
}) {
  if (lastInboundAt == null) {
    return false;
  }
  return now.difference(lastInboundAt) < window;
}

DateTime? lastInboundAt(Iterable<Message> messages) {
  DateTime? newest;
  for (final message in messages) {
    if (message.direction.isInbound) {
      if (newest == null || message.sentAt.isAfter(newest)) {
        newest = message.sentAt;
      }
    }
  }
  return newest;
}
