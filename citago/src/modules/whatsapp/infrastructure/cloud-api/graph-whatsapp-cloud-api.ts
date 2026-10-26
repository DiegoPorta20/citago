import { createHmac } from 'node:crypto';

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

const THROTTLING_CODES = new Set([4, 80007, 130429, 131048, 131056]);
const INVALID_TOKEN_CODE = 190;
const OUTSIDE_WINDOW_CODE = 131047;

const META_ID = /^\d{1,32}$/;

interface GraphErrorBody {
  readonly error?: { readonly code?: unknown };
}

@Injectable()
export class GraphWhatsAppCloudApi extends WhatsAppCloudApi {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly pinKey: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    const root = config
      .get('WHATSAPP_GRAPH_API_URL', { infer: true })
      .replace(/\/+$/, '');

    this.baseUrl = `${root}/${config.get('WHATSAPP_GRAPH_API_VERSION', { infer: true })}`;
    this.appId = config.get('WHATSAPP_APP_ID', { infer: true });
    this.appSecret = config.get('WHATSAPP_APP_SECRET', { infer: true });
    this.pinKey = config.get('ENCRYPTION_KEY', { infer: true });
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

  async exchangeCode(code: string): Promise<string> {
    const query = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      code,
    });
    const body = await this.request(
      `${this.baseUrl}/oauth/access_token?${query.toString()}`,
      null,
      { method: 'GET' },
    );
    const token = (body as { access_token?: unknown }).access_token;

    if (typeof token !== 'string' || token.length === 0) {
      throw new WhatsAppApiError('REJECTED');
    }

    return token;
  }

  async subscribeApp(wabaId: string, accessToken: string): Promise<void> {
    await this.request(`${this.idPath(wabaId)}/subscribed_apps`, accessToken, {
      method: 'POST',
    });
  }

  async registerPhone(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<void> {
    await this.request(`${this.idPath(phoneNumberId)}/register`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        pin: this.pinFor(phoneNumberId),
      }),
    });
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
      throw new WhatsAppApiError('UNAVAILABLE');
    }

    return id;
  }

  /**
   * Meta wants a 6-digit two-step PIN when a number is registered. It is
   * derived from the number with a key only we hold, so registering again
   * (reconnecting) always presents the same PIN and nothing has to be stored.
   */
  private pinFor(phoneNumberId: string): string {
    const digest = createHmac('sha256', this.pinKey)
      .update(`whatsapp-registration-pin:${phoneNumberId}`)
      .digest();

    return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
  }

  private idPath(id: string): string {
    if (!META_ID.test(id)) {
      throw new WhatsAppApiError('REJECTED');
    }

    return `${this.baseUrl}/${id}`;
  }

  private async request(
    url: string,
    accessToken: string | null,
    init: { method: 'GET' | 'POST'; body?: string },
  ): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
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
