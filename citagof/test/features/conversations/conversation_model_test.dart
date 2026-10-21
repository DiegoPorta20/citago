import 'package:citagof/features/conversations/data/models/conversation_model.dart';
import 'package:citagof/features/conversations/domain/entities/conversation.dart';
import 'package:citagof/features/conversations/domain/entities/message.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('conversationFromJson', () {
    test('parses a linked conversation and normalizes instants to UTC', () {
      final conversation = conversationFromJson({
        'id': 'c1',
        'channel': 'WHATSAPP',
        'contactIdentifier': '+51999999999',
        'contactName': 'Juan',
        'client': {'id': 'cl1', 'name': 'Juan Pérez'},
        'assignedUserId': null,
        'status': 'OPEN',
        'needsReply': true,
        'lastMessageAt': '2026-10-20T15:00:00.000Z',
        'lastMessagePreview': 'Hola',
      });

      expect(conversation.id, 'c1');
      expect(conversation.channel, ConversationChannel.whatsapp);
      expect(conversation.status, ConversationStatus.open);
      expect(conversation.needsReply, isTrue);
      expect(conversation.client?.name, 'Juan Pérez');
      expect(conversation.isUnlinked, isFalse);
      expect(conversation.lastMessageAt!.isUtc, isTrue);
      expect(conversation.lastMessagePreview, 'Hola');
    });

    test('parses an unlinked conversation with no messages', () {
      final conversation = conversationFromJson({
        'id': 'c2',
        'channel': 'WHATSAPP',
        'contactIdentifier': '+51988888888',
        'contactName': null,
        'client': null,
        'assignedUserId': null,
        'status': 'ARCHIVED',
        'needsReply': false,
        'lastMessageAt': null,
        'lastMessagePreview': null,
      });

      expect(conversation.isUnlinked, isTrue);
      expect(conversation.status, ConversationStatus.archived);
      expect(conversation.lastMessageAt, isNull);
    });
  });

  group('displayName fallback', () {
    Conversation withNames({String? client, String? contact}) => Conversation(
      id: 'c',
      channel: ConversationChannel.whatsapp,
      contactIdentifier: '+51999999999',
      contactName: contact,
      client: client == null ? null : ConversationClient(id: 'x', name: client),
      status: ConversationStatus.open,
      needsReply: false,
    );

    test('prefers the linked client name', () {
      expect(
        withNames(client: 'Juan Pérez', contact: 'Juanito').displayName,
        'Juan Pérez',
      );
    });

    test('falls back to the contact name when unlinked', () {
      expect(withNames(contact: 'Juanito').displayName, 'Juanito');
    });

    test('falls back to the raw identifier when nothing else is known', () {
      expect(withNames().displayName, '+51999999999');
    });
  });

  group('messageFromJson', () {
    test('parses direction, type and UTC sentAt', () {
      final message = messageFromJson({
        'id': 'm1',
        'direction': 'OUTBOUND',
        'type': 'TEXT',
        'body': 'Claro que sí',
        'sentAt': '2026-10-20T10:30:00.000Z',
        'authorUserId': 'u1',
      });

      expect(message.direction, MessageDirection.outbound);
      expect(message.type.isText, isTrue);
      expect(message.body, 'Claro que sí');
      expect(message.sentAt.isUtc, isTrue);
      expect(message.authorUserId, 'u1');
    });
  });

  group('reply window (rule CO-10)', () {
    final now = DateTime.utc(2026, 10, 20, 12, 0);

    test('is closed when the contact never wrote', () {
      expect(replyWindowOpen(lastInboundAt: null, now: now), isFalse);
    });

    test('is open within 24h of the last inbound message', () {
      final lastInbound = now.subtract(const Duration(hours: 23, minutes: 59));
      expect(replyWindowOpen(lastInboundAt: lastInbound, now: now), isTrue);
    });

    test('is closed past 24h', () {
      final lastInbound = now.subtract(const Duration(hours: 24, minutes: 1));
      expect(replyWindowOpen(lastInboundAt: lastInbound, now: now), isFalse);
    });
  });

  group('lastInboundAt', () {
    test('returns the newest inbound instant, ignoring order and outbound', () {
      final messages = [
        Message(
          id: 'm1',
          direction: MessageDirection.inbound,
          type: MessageType.text,
          sentAt: DateTime.utc(2026, 10, 20, 9),
        ),
        Message(
          id: 'm2',
          direction: MessageDirection.outbound,
          type: MessageType.text,
          sentAt: DateTime.utc(2026, 10, 20, 11),
        ),
        Message(
          id: 'm3',
          direction: MessageDirection.inbound,
          type: MessageType.text,
          sentAt: DateTime.utc(2026, 10, 20, 10),
        ),
      ];
      expect(lastInboundAt(messages), DateTime.utc(2026, 10, 20, 10));
    });

    test('returns null when there is no inbound message', () {
      final messages = [
        Message(
          id: 'm1',
          direction: MessageDirection.outbound,
          type: MessageType.text,
          sentAt: DateTime.utc(2026, 10, 20, 11),
        ),
      ];
      expect(lastInboundAt(messages), isNull);
    });
  });
}
