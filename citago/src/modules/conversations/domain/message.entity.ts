import { InvalidMessageError } from './conversation.errors.js';
import { type MessageDirection, MessageType } from './conversation.enums.js';

/** WhatsApp's own limit for a text message. */
const MAX_BODY_LENGTH = 4096;
const MAX_EXTERNAL_ID_LENGTH = 128;

export interface MessageSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly conversationId: string;
  /** The channel's id for this message. Unique across the platform: idempotency key (rule CO-2). */
  readonly externalMessageId: string | null;
  readonly direction: MessageDirection;
  readonly type: MessageType;
  readonly body: string | null;
  /** Channel reference to media (not downloaded in the MVP). */
  readonly mediaReference: string | null;
  readonly mediaMimeType: string | null;
  /** When the channel says it was sent. Ordering uses this, not arrival time. */
  readonly sentAt: Date;
  /** When we stored it. */
  readonly receivedAt: Date;
  /** The member who sent it from the app, for outbound messages. */
  readonly authorUserId: string | null;
}

/**
 * One message of a conversation. **Immutable** (rule CO-3): it is a record of
 * what was said, never edited, only appended.
 */
export class Message {
  private constructor(private readonly snapshot: MessageSnapshot) {}

  static create(input: MessageSnapshot): Message {
    const body = input.body?.trim() || null;

    if (body && body.length > MAX_BODY_LENGTH) {
      throw new InvalidMessageError(
        `the text cannot exceed ${MAX_BODY_LENGTH} characters`,
      );
    }
    if (input.type === MessageType.Text && !body) {
      throw new InvalidMessageError('a text message needs a body');
    }
    if (
      input.externalMessageId !== null &&
      (input.externalMessageId.length === 0 ||
        input.externalMessageId.length > MAX_EXTERNAL_ID_LENGTH)
    ) {
      throw new InvalidMessageError('the external id is not valid');
    }

    return new Message({ ...input, body });
  }

  static restore(snapshot: MessageSnapshot): Message {
    return new Message(snapshot);
  }

  get id(): string {
    return this.snapshot.id;
  }

  get tenantId(): string {
    return this.snapshot.tenantId;
  }

  get conversationId(): string {
    return this.snapshot.conversationId;
  }

  get direction(): MessageDirection {
    return this.snapshot.direction;
  }

  get type(): MessageType {
    return this.snapshot.type;
  }

  get body(): string | null {
    return this.snapshot.body;
  }

  get sentAt(): Date {
    return this.snapshot.sentAt;
  }

  /** What an inbox row shows: the text, or a label for media. */
  get preview(): string {
    if (this.snapshot.body) {
      return this.snapshot.body.slice(0, 120);
    }

    return `[${this.snapshot.type}]`;
  }

  toSnapshot(): MessageSnapshot {
    return this.snapshot;
  }
}
