import {
  InvalidConversationDataError,
  InvalidMessageError,
} from './conversation.errors.js';
import { Conversation } from './conversation.entity.js';
import {
  ConversationChannel,
  ConversationStatus,
  MessageDirection,
  MessageType,
} from './conversation.enums.js';
import { Message } from './message.entity.js';

const at = (time: string) => new Date(`2026-09-17T${time}:00.000Z`);
let sequence = 0;

function message(
  direction: MessageDirection,
  sentAt: Date,
  body = 'Hola',
): Message {
  sequence += 1;

  return Message.create({
    id: `message-${sequence}`,
    tenantId: 'tenant-1',
    conversationId: 'conversation-1',
    externalMessageId: `wamid-${sequence}`,
    direction,
    type: MessageType.Text,
    body,
    mediaReference: null,
    mediaMimeType: null,
    sentAt,
    receivedAt: sentAt,
    authorUserId: null,
  });
}

const inbound = (time: string, body?: string) =>
  message(MessageDirection.Inbound, at(time), body);
const outbound = (time: string) => message(MessageDirection.Outbound, at(time));

function start(): Conversation {
  return Conversation.start(
    {
      id: 'conversation-1',
      tenantId: 'tenant-1',
      channel: ConversationChannel.WhatsApp,
      contactIdentifier: '+51999999999',
      contactName: 'Juan',
    },
    at('09:00'),
  );
}

describe('Conversation', () => {
  it('starts open, with nothing pending', () => {
    const conversation = start();

    expect(conversation.status).toBe(ConversationStatus.Open);
    expect(conversation.needsReply).toBe(false);
  });

  it('rejects an empty contact identifier', () => {
    expect(() =>
      Conversation.start(
        {
          id: 'c',
          tenantId: 't',
          channel: ConversationChannel.WhatsApp,
          contactIdentifier: '  ',
        },
        at('09:00'),
      ),
    ).toThrow(InvalidConversationDataError);
  });

  describe('needsReply (the pending counter)', () => {
    it('turns on when the client writes', () => {
      const conversation = start();

      conversation.registerMessage(inbound('10:00'), at('10:00'));

      expect(conversation.needsReply).toBe(true);
    });

    it('turns off when the business answers', () => {
      const conversation = start();
      conversation.registerMessage(inbound('10:00'), at('10:00'));

      conversation.registerMessage(outbound('10:05'), at('10:05'));

      expect(conversation.needsReply).toBe(false);
    });

    it('turns off when someone marks it resolved (answered by phone)', () => {
      const conversation = start();
      conversation.registerMessage(inbound('10:00'), at('10:00'));

      conversation.markResolved(at('10:30'));

      expect(conversation.needsReply).toBe(false);
    });

    it('turns back on when the client writes after the answer', () => {
      const conversation = start();
      conversation.registerMessage(inbound('10:00'), at('10:00'));
      conversation.registerMessage(outbound('10:05'), at('10:05'));

      conversation.registerMessage(inbound('10:10'), at('10:10'));

      expect(conversation.needsReply).toBe(true);
    });

    it('is not re-opened by an old message that arrives late', () => {
      // WhatsApp does not guarantee delivery order: an inbound sent at 10:00
      // may reach us after our 10:05 answer. It must not mark the thread pending.
      const conversation = start();
      conversation.registerMessage(outbound('10:05'), at('10:05'));

      conversation.registerMessage(inbound('10:00'), at('10:06'));

      expect(conversation.needsReply).toBe(false);
    });
  });

  describe('inbox preview', () => {
    it('shows the latest message, not the last one to arrive', () => {
      const conversation = start();
      conversation.registerMessage(inbound('10:05', 'segundo'), at('10:05'));

      conversation.registerMessage(inbound('10:00', 'primero'), at('10:06'));

      const snapshot = conversation.toSnapshot();
      expect(snapshot.lastMessagePreview).toBe('segundo');
      expect(snapshot.lastMessageAt).toEqual(at('10:05'));
    });

    it('labels media without text', () => {
      const conversation = start();

      conversation.registerMessage(
        Message.create({
          id: 'm-img',
          tenantId: 'tenant-1',
          conversationId: 'conversation-1',
          externalMessageId: 'wamid-img',
          direction: MessageDirection.Inbound,
          type: MessageType.Image,
          body: null,
          mediaReference: 'media-1',
          mediaMimeType: 'image/jpeg',
          sentAt: at('10:00'),
          receivedAt: at('10:00'),
          authorUserId: null,
        }),
        at('10:00'),
      );

      expect(conversation.toSnapshot().lastMessagePreview).toBe('[IMAGE]');
    });
  });

  describe('archive', () => {
    it('leaves the inbox and clears the pending flag', () => {
      const conversation = start();
      conversation.registerMessage(inbound('10:00'), at('10:00'));

      conversation.archive(at('11:00'));

      expect(conversation.status).toBe(ConversationStatus.Archived);
      expect(conversation.needsReply).toBe(false);
    });

    it('comes back to the inbox when the client writes again (rule CO-4)', () => {
      const conversation = start();
      conversation.archive(at('09:30'));

      conversation.registerMessage(inbound('10:00'), at('10:00'));

      expect(conversation.status).toBe(ConversationStatus.Open);
      expect(conversation.needsReply).toBe(true);
    });

    it('stays archived when the business writes', () => {
      const conversation = start();
      conversation.archive(at('09:30'));

      conversation.registerMessage(outbound('10:00'), at('10:00'));

      expect(conversation.status).toBe(ConversationStatus.Archived);
    });
  });

  it('keeps the first known contact name unless a new one arrives', () => {
    const conversation = start();

    conversation.updateContactName(null, at('10:00'));
    expect(conversation.toSnapshot().contactName).toBe('Juan');

    conversation.updateContactName('Juan Pérez', at('10:00'));
    expect(conversation.toSnapshot().contactName).toBe('Juan Pérez');
  });
});

describe('Message', () => {
  const base = {
    id: 'm',
    tenantId: 't',
    conversationId: 'c',
    externalMessageId: 'wamid',
    direction: MessageDirection.Inbound,
    mediaReference: null,
    mediaMimeType: null,
    sentAt: at('10:00'),
    receivedAt: at('10:00'),
    authorUserId: null,
  };

  it('requires a body for a text message', () => {
    expect(() =>
      Message.create({ ...base, type: MessageType.Text, body: '   ' }),
    ).toThrow(InvalidMessageError);
  });

  it('rejects a text longer than WhatsApp allows', () => {
    expect(() =>
      Message.create({
        ...base,
        type: MessageType.Text,
        body: 'x'.repeat(4097),
      }),
    ).toThrow(InvalidMessageError);
  });

  it('accepts media without text', () => {
    expect(() =>
      Message.create({ ...base, type: MessageType.Audio, body: null }),
    ).not.toThrow();
  });
});

describe('Conversation reply window (rule CO-10)', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('is open while the client wrote less than the window ago', () => {
    const conversation = start();

    conversation.registerMessage(inbound('10:00'), at('10:00'));

    expect(
      conversation.canReplyFreely(
        new Date(at('10:00').getTime() + DAY - 1),
        DAY,
      ),
    ).toBe(true);
  });

  it('closes once the window has passed', () => {
    const conversation = start();

    conversation.registerMessage(inbound('10:00'), at('10:00'));

    expect(
      conversation.canReplyFreely(new Date(at('10:00').getTime() + DAY), DAY),
    ).toBe(false);
  });

  it('is counted from the client, not from our last answer', () => {
    const conversation = start();

    conversation.registerMessage(inbound('10:00'), at('10:00'));
    conversation.registerMessage(outbound('11:00'), at('11:00'));

    expect(
      conversation.canReplyFreely(new Date(at('10:30').getTime() + DAY), DAY),
    ).toBe(false);
  });

  it('is closed when the client never wrote', () => {
    expect(start().canReplyFreely(at('10:00'), DAY)).toBe(false);
  });

  it('is always open on a channel without a window', () => {
    expect(start().canReplyFreely(at('10:00'), null)).toBe(true);
  });
});
