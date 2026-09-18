import { MessageType } from '../../conversations/domain/conversation.enums.js';
import { parseMetaWebhook } from './meta-webhook.parser.js';

/** Meta's envelope around a list of messages. */
function webhook(
  messages: unknown[],
  extra: Record<string, unknown> = {},
): unknown {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '102290129340398',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550000000',
                phone_number_id: '106540352242922',
              },
              contacts: [{ profile: { name: 'Juan' }, wa_id: '51999999999' }],
              messages,
              ...extra,
            },
          },
        ],
      },
    ],
  };
}

const base = {
  from: '51999999999',
  id: 'wamid.HBgLNTE5OTk5OTk5OTkVAgASGBQzQTk',
  timestamp: '1789700000',
};

describe('parseMetaWebhook', () => {
  it('reads a text message', () => {
    const [message] = parseMetaWebhook(
      webhook([{ ...base, type: 'text', text: { body: 'Hola' } }]),
    );

    expect(message).toEqual({
      phoneNumberId: '106540352242922',
      from: '51999999999',
      contactName: 'Juan',
      messageId: base.id,
      sentAt: new Date(1789700000 * 1000),
      type: MessageType.Text,
      body: 'Hola',
      mediaId: null,
      mediaMimeType: null,
    });
  });

  it('keeps a media reference and the caption', () => {
    const [message] = parseMetaWebhook(
      webhook([
        {
          ...base,
          type: 'image',
          image: {
            id: 'media-1',
            mime_type: 'image/jpeg',
            caption: 'Este corte',
          },
        },
      ]),
    );

    expect(message).toMatchObject({
      type: MessageType.Image,
      body: 'Este corte',
      mediaId: 'media-1',
      mediaMimeType: 'image/jpeg',
    });
  });

  it('turns a location into readable text', () => {
    const [message] = parseMetaWebhook(
      webhook([
        {
          ...base,
          type: 'location',
          location: { latitude: -12.1, longitude: -77.03 },
        },
      ]),
    );

    expect(message).toMatchObject({
      type: MessageType.Location,
      body: '-12.1,-77.03',
    });
  });

  it('reads a button answer as text', () => {
    const [message] = parseMetaWebhook(
      webhook([
        {
          ...base,
          type: 'interactive',
          interactive: {
            type: 'button_reply',
            button_reply: { id: 'yes', title: 'Confirmo' },
          },
        },
      ]),
    );

    expect(message).toMatchObject({ type: MessageType.Text, body: 'Confirmo' });
  });

  it('keeps unknown types as OTHER', () => {
    const [message] = parseMetaWebhook(
      webhook([{ ...base, type: 'unsupported' }]),
    );

    expect(message).toMatchObject({ type: MessageType.Other, body: null });
  });

  it('ignores reactions and delivery receipts', () => {
    expect(
      parseMetaWebhook(
        webhook(
          [
            {
              ...base,
              type: 'reaction',
              reaction: { message_id: 'x', emoji: '👍' },
            },
          ],
          { statuses: [{ id: 'wamid.x', status: 'read' }] },
        ),
      ),
    ).toEqual([]);
  });

  it.each([
    ['another object', { object: 'page', entry: [] }],
    ['null', null],
    ['a string', 'hello'],
    ['entry is not a list', { object: 'whatsapp_business_account', entry: 1 }],
  ])('returns nothing for %s', (_label, payload) => {
    expect(parseMetaWebhook(payload)).toEqual([]);
  });

  it.each([
    ['no id', { ...base, id: undefined }],
    ['a sender that is not a number', { ...base, from: 'abc' }],
    ['a bad timestamp', { ...base, timestamp: 'yesterday' }],
    ['no type', { ...base, type: undefined }],
  ])('skips a message with %s', (_label, message) => {
    expect(
      parseMetaWebhook(
        webhook([{ type: 'text', text: { body: 'x' }, ...message }]),
      ),
    ).toEqual([]);
  });

  it('reads every message of a batch', () => {
    expect(
      parseMetaWebhook(
        webhook([
          { ...base, id: 'wamid.1', type: 'text', text: { body: 'a' } },
          { ...base, id: 'wamid.2', type: 'text', text: { body: 'b' } },
        ]),
      ),
    ).toHaveLength(2);
  });
});
