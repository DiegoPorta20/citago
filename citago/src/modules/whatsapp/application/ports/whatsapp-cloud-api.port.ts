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

  abstract sendText(input: {
    readonly phoneNumberId: string;
    readonly accessToken: string;
    readonly to: string;
    readonly body: string;
  }): Promise<string>;
}
