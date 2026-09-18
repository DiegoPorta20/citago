import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../../../config/environment.js';
import {
  WhatsAppApiError,
  WhatsAppCloudApi,
  type WhatsAppApiFailure,
  type WhatsAppPhoneNumberInfo,
} from '../../application/ports/whatsapp-cloud-api.port.js';

const REQUEST_TIMEOUT_MS = 10_000;

/** Meta error codes that mean "not now" rather than "never". */
const THROTTLING_CODES = new Set([4, 80007, 130429, 131048, 131056]);
const INVALID_TOKEN_CODE = 190;
const OUTSIDE_WINDOW_CODE = 131047;

/** Ids go into the URL path: anything but digits is refused before any request. */
const META_ID = /^\d{1,32}$/;

interface GraphErrorBody {
  readonly error?: { readonly code?: unknown };
}

/**
 * Meta's Graph API over plain `fetch`: two endpoints do not justify an SDK.
 *
 * The access token travels only in the Authorization header and never appears
 * in an error message or a log line.
 */
@Injectable()
export class GraphWhatsAppCloudApi extends WhatsAppCloudApi {
  private readonly baseUrl: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    const root = config
      .get('WHATSAPP_GRAPH_API_URL', { infer: true })
      .replace(/\/+$/, '');

    this.baseUrl = `${root}/${config.get('WHATSAPP_GRAPH_API_VERSION', { infer: true })}`;
  }

  async getPhoneNumber(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<WhatsAppPhoneNumberInfo> {
    const body = await this.request(
      `${this.idPath(phoneNumberId)}?fields=display_phone_number,verified_name`,
      accessToken,
      { method: 'GET' },
    );
    const info = body as {
      display_phone_number?: unknown;
      verified_name?: unknown;
    };

    if (typeof info.display_phone_number !== 'string') {
      throw new WhatsAppApiError('REJECTED');
    }

    return {
      displayPhoneNumber: info.display_phone_number,
      verifiedName:
        typeof info.verified_name === 'string' ? info.verified_name : null,
    };
  }

  async sendText(input: {
    readonly phoneNumberId: string;
    readonly accessToken: string;
    readonly to: string;
    readonly body: string;
  }): Promise<string> {
    const body = await this.request(
      `${this.idPath(input.phoneNumberId)}/messages`,
      input.accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.to.replace(/^\+/, ''),
          type: 'text',
          text: { body: input.body, preview_url: false },
        }),
      },
    );
    const id = (body as { messages?: { id?: unknown }[] }).messages?.[0]?.id;

    if (typeof id !== 'string' || id.length === 0) {
      // Meta answered 2xx without an id: treat as not sent rather than guess.
      throw new WhatsAppApiError('UNAVAILABLE');
    }

    return id;
  }

  private idPath(id: string): string {
    if (!META_ID.test(id)) {
      throw new WhatsAppApiError('REJECTED');
    }

    return `${this.baseUrl}/${id}`;
  }

  private async request(
    url: string,
    accessToken: string,
    init: { method: 'GET' | 'POST'; body?: string },
  ): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      // Network failure or timeout. The original error may echo the request.
      throw new WhatsAppApiError('UNAVAILABLE');
    }

    const body: unknown = await response.json().catch(() => null);

    if (response.ok) {
      return body;
    }

    const rawCode = (body as GraphErrorBody | null)?.error?.code;
    const metaCode = typeof rawCode === 'number' ? rawCode : null;

    throw new WhatsAppApiError(classify(response.status, metaCode), metaCode);
  }
}

function classify(status: number, metaCode: number | null): WhatsAppApiFailure {
  if (metaCode === INVALID_TOKEN_CODE || status === 401) {
    return 'UNAUTHORIZED';
  }
  if (metaCode === OUTSIDE_WINDOW_CODE) {
    return 'WINDOW_CLOSED';
  }
  if (
    status >= 500 ||
    status === 429 ||
    (metaCode !== null && THROTTLING_CODES.has(metaCode))
  ) {
    return 'UNAVAILABLE';
  }

  return 'REJECTED';
}
