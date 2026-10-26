import type { ConfigService } from '@nestjs/config';

import { FixedClock } from '../../../../test/support/fakes/identity.fakes.js';
import type { EnvironmentVariables } from '../../../config/environment.js';
import { HmacHandoffTokens } from './hmac-handoff-tokens.js';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const claims = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  purpose: 'whatsapp-signup',
} as const;

function build(secret = 'a'.repeat(48), clock = new FixedClock(NOW)) {
  const config = {
    get: () => secret,
  } as unknown as ConfigService<EnvironmentVariables, true>;

  return { tokens: new HmacHandoffTokens(config, clock), clock };
}

describe('HmacHandoffTokens', () => {
  it('round-trips the claims', () => {
    const { tokens } = build();

    expect(tokens.verify(tokens.issue(claims), 'whatsapp-signup')).toEqual(
      claims,
    );
  });

  it('only works for the purpose it was issued for', () => {
    const { tokens } = build();

    expect(tokens.verify(tokens.issue(claims), 'checkout')).toBeNull();
  });

  it('expires after 15 minutes, to the second', () => {
    const { tokens, clock } = build();
    const token = tokens.issue(claims);

    clock.advanceDays(0);
    expect(tokens.ttlSeconds).toBe(900);

    const almost = new FixedClock(new Date(NOW.getTime() + 899_000));
    const late = new FixedClock(new Date(NOW.getTime() + 900_000));

    expect(
      build('a'.repeat(48), almost).tokens.verify(token, 'whatsapp-signup'),
    ).not.toBeNull();
    expect(
      build('a'.repeat(48), late).tokens.verify(token, 'whatsapp-signup'),
    ).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const forged = build('b'.repeat(48)).tokens.issue(claims);

    expect(build().tokens.verify(forged, 'whatsapp-signup')).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const { tokens } = build();
    const [version, , signature] = tokens.issue(claims).split('.');
    const other = Buffer.from(
      JSON.stringify({
        t: 'tenant-2',
        u: 'user-1',
        p: 'whatsapp-signup',
        e: 9e9,
      }),
    ).toString('base64url');

    expect(
      tokens.verify(`${version}.${other}.${signature}`, 'whatsapp-signup'),
    ).toBeNull();
  });

  it.each([
    '',
    'garbage',
    'v1..',
    'v2.a.b',
    'v1.a.b.c',
    'eyJhbGciOiJIUzI1NiJ9.e30.abc',
  ])('rejects the malformed token %p without throwing', (token) => {
    expect(build().tokens.verify(token, 'whatsapp-signup')).toBeNull();
  });

  it('is not shaped like a JWT, so the session guard can never accept it', () => {
    const token = build().tokens.issue(claims);

    expect(token.startsWith('v1.')).toBe(true);
    expect(token.split('.')[0]).not.toMatch(/^eyJ/);
  });
});
