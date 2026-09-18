import { InvalidConversationDataError } from './conversation.errors.js';
import {
  ConversationStatus,
  MessageDirection,
  type ConversationChannel,
} from './conversation.enums.js';
import type { Message } from './message.entity.js';

const MAX_CONTACT_IDENTIFIER_LENGTH = 64;
const MAX_CONTACT_NAME_LENGTH = 120;

export interface ConversationSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly channel: ConversationChannel;
  /** Who is on the other side, normalized per channel (E.164 for WhatsApp). */
  readonly contactIdentifier: string;
  /** The name the channel reports (WhatsApp profile name), if any. */
  readonly contactName: string | null;
  /** Null until the contact is known to be a client (rule CO-6). */
  readonly clientId: string | null;
  readonly assignedUserId: string | null;
  readonly status: ConversationStatus;
  /** The "pending" of the dashboard: the client wrote and nobody answered. */
  readonly needsReply: boolean;
  readonly lastMessageAt: Date | null;
  readonly lastInboundAt: Date | null;
  readonly lastOutboundAt: Date | null;
  readonly lastMessagePreview: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * The thread between the business and one contact on one channel.
 *
 * One thread per contact and channel (decision F11): WhatsApp is a continuous
 * conversation, not a ticket system.
 *
 * Two independent facts, kept apart on purpose (decision F10):
 * - `status` — is it in the inbox? Only a person archives; a new message from
 *   the client brings it back.
 * - `needsReply` — does someone owe an answer? A message from the client turns
 *   it on; any answer, or "mark as resolved", turns it off.
 */
export class Conversation {
  private constructor(private state: ConversationSnapshot) {}

  static start(
    input: {
      readonly id: string;
      readonly tenantId: string;
      readonly channel: ConversationChannel;
      readonly contactIdentifier: string;
      readonly contactName?: string | null;
      readonly clientId?: string | null;
    },
    now: Date,
  ): Conversation {
    const contactIdentifier = input.contactIdentifier.trim();

    if (
      contactIdentifier.length === 0 ||
      contactIdentifier.length > MAX_CONTACT_IDENTIFIER_LENGTH
    ) {
      throw new InvalidConversationDataError(
        'contactIdentifier',
        'it must be a non-empty channel identifier',
      );
    }

    return new Conversation({
      id: input.id,
      tenantId: input.tenantId,
      channel: input.channel,
      contactIdentifier,
      contactName: normalizeName(input.contactName ?? null),
      clientId: input.clientId ?? null,
      assignedUserId: null,
      status: ConversationStatus.Open,
      needsReply: false,
      lastMessageAt: null,
      lastInboundAt: null,
      lastOutboundAt: null,
      lastMessagePreview: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(snapshot: ConversationSnapshot): Conversation {
    return new Conversation(snapshot);
  }

  get id(): string {
    return this.state.id;
  }

  get tenantId(): string {
    return this.state.tenantId;
  }

  get channel(): ConversationChannel {
    return this.state.channel;
  }

  get contactIdentifier(): string {
    return this.state.contactIdentifier;
  }

  get clientId(): string | null {
    return this.state.clientId;
  }

  get assignedUserId(): string | null {
    return this.state.assignedUserId;
  }

  get status(): ConversationStatus {
    return this.state.status;
  }

  get needsReply(): boolean {
    return this.state.needsReply;
  }

  get lastInboundAt(): Date | null {
    return this.state.lastInboundAt;
  }

  /**
   * Whether a free-form reply is still allowed (rule CO-10). Some channels only
   * accept one for a while after the contact's last message; `windowMs` is
   * that while, or `null` when the channel has no such limit.
   *
   * A conversation the contact never wrote in has no open window.
   */
  canReplyFreely(now: Date, windowMs: number | null): boolean {
    if (windowMs === null) {
      return true;
    }
    if (this.state.lastInboundAt === null) {
      return false;
    }

    return now.getTime() - this.state.lastInboundAt.getTime() < windowMs;
  }

  /**
   * Updates the thread for a new message (rule CO-4).
   *
   * Timestamps only move forward: a delayed webhook for an older message must
   * not make the inbox think it is the latest one.
   */
  registerMessage(message: Message, now: Date): void {
    const isLatest =
      this.state.lastMessageAt === null ||
      message.sentAt.getTime() >= this.state.lastMessageAt.getTime();

    const next = { ...this.state, updatedAt: now };

    if (isLatest) {
      next.lastMessageAt = message.sentAt;
      next.lastMessagePreview = message.preview;
    }

    if (message.direction === MessageDirection.Inbound) {
      next.lastInboundAt = latest(this.state.lastInboundAt, message.sentAt);
      // A client writing again brings an archived thread back to the inbox.
      next.status = ConversationStatus.Open;
      // Only the newest message decides whether an answer is owed: an old
      // inbound arriving late must not re-open something already answered.
      if (
        this.state.lastOutboundAt === null ||
        message.sentAt.getTime() > this.state.lastOutboundAt.getTime()
      ) {
        next.needsReply = true;
      }
    } else {
      next.lastOutboundAt = latest(this.state.lastOutboundAt, message.sentAt);
      if (
        this.state.lastInboundAt === null ||
        message.sentAt.getTime() >= this.state.lastInboundAt.getTime()
      ) {
        next.needsReply = false;
      }
    }

    this.state = next;
  }

  /** The contact's display name can arrive later (e.g. with the first message). */
  updateContactName(name: string | null, now: Date): void {
    const normalized = normalizeName(name);

    if (normalized && normalized !== this.state.contactName) {
      this.state = { ...this.state, contactName: normalized, updatedAt: now };
    }
  }

  /** "Handled", even if the answer went through another channel (a call, the phone). */
  markResolved(now: Date): void {
    this.state = { ...this.state, needsReply: false, updatedAt: now };
  }

  /** Out of the inbox until the client writes again. Also clears the pending flag. */
  archive(now: Date): void {
    this.state = {
      ...this.state,
      status: ConversationStatus.Archived,
      needsReply: false,
      updatedAt: now,
    };
  }

  reopen(now: Date): void {
    this.state = {
      ...this.state,
      status: ConversationStatus.Open,
      updatedAt: now,
    };
  }

  /** `null` unlinks. */
  linkClient(clientId: string | null, now: Date): void {
    this.state = { ...this.state, clientId, updatedAt: now };
  }

  /** `null` unassigns. */
  assignTo(userId: string | null, now: Date): void {
    this.state = { ...this.state, assignedUserId: userId, updatedAt: now };
  }

  toSnapshot(): ConversationSnapshot {
    return this.state;
  }
}

function latest(current: Date | null, candidate: Date): Date {
  return current && current.getTime() > candidate.getTime()
    ? current
    : candidate;
}

function normalizeName(name: string | null): string | null {
  const trimmed = name?.trim() || null;

  return trimmed ? trimmed.slice(0, MAX_CONTACT_NAME_LENGTH) : null;
}
