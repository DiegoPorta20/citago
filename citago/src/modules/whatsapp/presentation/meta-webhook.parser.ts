import { MessageType } from '../../conversations/domain/conversation.enums.js';
import type { WhatsAppInboundMessage } from '../application/process-whatsapp-webhook.use-case.js';

/**
 * Translates Meta's webhook payload into CitaGo's inbound messages.
 *
 * Meta's shape stops here: nothing past this file knows about `entry`,
 * `changes` or `wa_id`. The payload is read defensively — it is external
 * input, even when signed — and anything unexpected is skipped, not thrown:
 *
 * - `statuses` (sent/delivered/read receipts) are ignored in the MVP;
 * - reactions are ignored: they are not a new message and must not mark the
 *   conversation as waiting for an answer;
 * - an entry without the fields a message needs is skipped.
 */

const MAX_BODY_LENGTH = 4096;
const MAX_ID_LENGTH = 128;

type Json = Record<string, unknown>;

const MEDIA_TYPES: Readonly<Record<string, MessageType>> = {
  image: MessageType.Image,
  sticker: MessageType.Image,
  video: MessageType.Video,
  audio: MessageType.Audio,
  voice: MessageType.Audio,
  document: MessageType.Document,
};

const IGNORED_TYPES = new Set(['reaction']);

export function parseMetaWebhook(payload: unknown): WhatsAppInboundMessage[] {
  if (!isObject(payload) || payload.object !== 'whatsapp_business_account') {
    return [];
  }

  const messages: WhatsAppInboundMessage[] = [];

  for (const entry of arrayOf(payload.entry)) {
    for (const change of arrayOf(entry.changes)) {
      if (change.field !== 'messages' || !isObject(change.value)) {
        continue;
      }

      const value = change.value;
      const phoneNumberId = isObject(value.metadata)
        ? text(value.metadata.phone_number_id)
        : null;

      if (!phoneNumberId) {
        continue;
      }

      const contacts = arrayOf(value.contacts);

      for (const message of arrayOf(value.messages)) {
        const parsed = parseMessage(phoneNumberId, message, contacts);

        if (parsed) {
          messages.push(parsed);
        }
      }
    }
  }

  return messages;
}

function parseMessage(
  phoneNumberId: string,
  message: Json,
  contacts: Json[],
): WhatsAppInboundMessage | null {
  const from = text(message.from);
  const id = text(message.id);
  const type = text(message.type);
  const seconds = Number(text(message.timestamp));

  if (
    !from ||
    !/^\d{6,15}$/.test(from) ||
    !id ||
    id.length > MAX_ID_LENGTH ||
    !type ||
    IGNORED_TYPES.has(type) ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return null;
  }

  const contact = contacts.find((c) => c.wa_id === from) ?? contacts.at(0);
  const profile = contact && isObject(contact.profile) ? contact.profile : null;

  return {
    phoneNumberId,
    from,
    contactName: profile ? text(profile.name) : null,
    messageId: id,
    sentAt: new Date(seconds * 1000),
    ...content(type, message),
  };
}

function content(
  type: string,
  message: Json,
): Pick<WhatsAppInboundMessage, 'type' | 'body' | 'mediaId' | 'mediaMimeType'> {
  const part = isObject(message[type]) ? message[type] : {};
  const none = { mediaId: null, mediaMimeType: null };

  if (type === 'text') {
    const body = clip(text(part.body));

    return body
      ? { type: MessageType.Text, body, ...none }
      : { type: MessageType.Other, body: null, ...none };
  }

  const mediaType = MEDIA_TYPES[type];

  if (mediaType) {
    return {
      type: mediaType,
      body: clip(text(part.caption) ?? text(part.filename)),
      mediaId: text(part.id),
      mediaMimeType: text(part.mime_type),
    };
  }

  if (type === 'location') {
    const label = [text(part.name), text(part.address)].filter(Boolean);
    const coordinates =
      typeof part.latitude === 'number' && typeof part.longitude === 'number'
        ? `${part.latitude},${part.longitude}`
        : null;

    return {
      type: MessageType.Location,
      body: clip(label.length > 0 ? label.join(' — ') : coordinates),
      ...none,
    };
  }

  // Quick-reply buttons and list choices are the client's answer, as text.
  if (type === 'button') {
    return withText(text(part.text));
  }
  if (type === 'interactive') {
    const reply = isObject(part.button_reply)
      ? part.button_reply
      : isObject(part.list_reply)
        ? part.list_reply
        : {};

    return withText(text(reply.title));
  }

  return { type: MessageType.Other, body: null, ...none };
}

function withText(
  body: string | null,
): Pick<WhatsAppInboundMessage, 'type' | 'body' | 'mediaId' | 'mediaMimeType'> {
  const clipped = clip(body);

  return {
    type: clipped ? MessageType.Text : MessageType.Other,
    body: clipped,
    mediaId: null,
    mediaMimeType: null,
  };
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayOf(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function clip(value: string | null): string | null {
  return value ? value.slice(0, MAX_BODY_LENGTH) : null;
}
