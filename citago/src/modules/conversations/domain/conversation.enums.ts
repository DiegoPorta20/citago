/**
 * Where a conversation happens. Only WhatsApp is wired today; the others exist
 * so a new channel is an adapter, not a schema change.
 */
export enum ConversationChannel {
  WhatsApp = 'WHATSAPP',
  Instagram = 'INSTAGRAM',
  Messenger = 'MESSENGER',
  Web = 'WEB',
  Other = 'OTHER',
}

/**
 * Whether the conversation shows in the inbox (decision F10).
 *
 * Deliberately **not** "open / pending / resolved": whether someone still has
 * to answer is a separate question, answered by `needsReply`. Mixing both in
 * one field means every code path must remember to move RESOLVED back to
 * PENDING when a message arrives — the classic source of a wrong counter.
 */
export enum ConversationStatus {
  Open = 'OPEN',
  Archived = 'ARCHIVED',
}

export enum MessageDirection {
  /** Client → business. */
  Inbound = 'INBOUND',
  /** Business → client. */
  Outbound = 'OUTBOUND',
}

/** Only TEXT carries a body in the MVP; the rest keep a reference to the media. */
export enum MessageType {
  Text = 'TEXT',
  Image = 'IMAGE',
  Audio = 'AUDIO',
  Video = 'VIDEO',
  Document = 'DOCUMENT',
  Location = 'LOCATION',
  Other = 'OTHER',
}
