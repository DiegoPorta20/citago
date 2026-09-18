import { createHmac } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../../../config/environment.js';
import { MetaWebhookVerifier } from './meta-webhook-verifier.js';

function verifierWith(secret: string, verifyToken: string) {
  return new MetaWebhookVerifier({
    get: (key: string) =>
      key === 'WHATSAPP_APP_SECRET' ? secret : verifyToken,
  } as unknown as ConfigService<EnvironmentVariables, true>);
}

const sign = (secret: string, body: Buffer) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('MetaWebhookVerifier', () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const verifier = verifierWith('app-secret', 'verify-me');

  describe('signature', () => {
    it('accepts the HMAC of the raw body', () => {
      expect(verifier.hasValidSignature(body, sign('app-secret', body))).toBe(
        true,
      );
    });

    it('rejects a signature made with another secret', () => {
      expect(verifier.hasValidSignature(body, sign('other', body))).toBe(false);
    });

    it('rejects a body changed after signing', () => {
      const header = sign('app-secret', body);

      expect(
        verifier.hasValidSignature(
          Buffer.from('{"object":"whatsapp_business_account" }'),
          header,
        ),
      ).toBe(false);
    });

    it.each([undefined, '', 'sha1=abc', 'sha256=', 'sha256=zz', 'sha256=ab'])(
      'rejects the header %p',
      (header) => {
        expect(verifier.hasValidSignature(body, header)).toBe(false);
      },
    );

    it('rejects a missing raw body', () => {
      expect(
        verifier.hasValidSignature(undefined, sign('app-secret', body)),
      ).toBe(false);
    });

    it('fails closed when no app secret is configured', () => {
      const unconfigured = verifierWith('', 'verify-me');

      expect(unconfigured.hasValidSignature(body, sign('', body))).toBe(false);
    });
  });

  describe('subscription handshake', () => {
    it('accepts the configured token in subscribe mode', () => {
      expect(verifier.isValidSubscription('subscribe', 'verify-me')).toBe(true);
    });

    it.each([
      ['subscribe', 'wrong'],
      ['subscribe', undefined],
      ['unsubscribe', 'verify-me'],
      [undefined, 'verify-me'],
    ])('rejects mode %p with token %p', (mode, token) => {
      expect(verifier.isValidSubscription(mode, token)).toBe(false);
    });

    it('fails closed when no verify token is configured', () => {
      expect(
        verifierWith('app-secret', '').isValidSubscription('subscribe', ''),
      ).toBe(false);
    });
  });
});
