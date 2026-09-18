export type WhatsAppApiFailure =
  /** Invalid, expired or revoked token (Meta error 190, HTTP 401). */
  | 'UNAUTHORIZED'
  /** Outside the 24-hour customer service window (Meta error 131047). */
  | 'WINDOW_CLOSED'
  /** Meta refused the request itself (bad id, bad recipient...). */
  | 'REJECTED'
  /** Network error, timeout or a failure on Meta's side. Retrying may work. */
  | 'UNAVAILABLE';

/** Carries Meta's error code, never the token or the request. */
export class WhatsAppApiError extends Error {
  constructor(
    readonly failure: WhatsAppApiFailure,
    readonly metaCode: number | null = null,
  ) {
    super(
      metaCode === null
        ? `WhatsApp Cloud API call failed: ${failure}`
        : `WhatsApp Cloud API call failed: ${failure} (Meta code ${metaCode})`,
    );
    this.name = 'WhatsAppApiError';
  }
}

export interface WhatsAppPhoneNumberInfo {
  readonly displayPhoneNumber: string;
  readonly verifiedName: string | null;
}

/**
 * The slice of Meta's WhatsApp Cloud API CitaGo uses. Every method throws
 * `WhatsAppApiError` on failure.
 */
export abstract class WhatsAppCloudApi {
  /** Also proves the token can act on that number. */
  abstract getPhoneNumber(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<WhatsAppPhoneNumberInfo>;

  /** `to` is the recipient in E.164. Returns Meta's message id (`wamid...`). */
  abstract sendText(input: {
    readonly phoneNumberId: string;
    readonly accessToken: string;
    readonly to: string;
    readonly body: string;
  }): Promise<string>;
}
