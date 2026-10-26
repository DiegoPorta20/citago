export type WhatsAppApiFailure =
  'UNAUTHORIZED' | 'WINDOW_CLOSED' | 'REJECTED' | 'UNAVAILABLE';

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

export abstract class WhatsAppCloudApi {
  abstract getPhoneNumber(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<WhatsAppPhoneNumberInfo>;

  /**
   * Embedded Signup hands the browser a one-time code; this trades it for
   * the business customer's access token. The app id and secret are ours.
   */
  abstract exchangeCode(code: string): Promise<string>;

  /** Makes Meta deliver the number's webhooks (messages) to this app. */
  abstract subscribeApp(wabaId: string, accessToken: string): Promise<void>;

  /** Registers the number on the Cloud API so it can send and receive. */
  abstract registerPhone(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<void>;

  abstract sendText(input: {
    readonly phoneNumberId: string;
    readonly accessToken: string;
    readonly to: string;
    readonly body: string;
  }): Promise<string>;
}
