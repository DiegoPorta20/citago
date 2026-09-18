import { randomBytes } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../../config/environment.js';
import { AesGcmSecretCipher } from './aes-gcm-secret-cipher.js';

function cipherWith(key: string): AesGcmSecretCipher {
  const config = {
    get: () => key,
  } as unknown as ConfigService<EnvironmentVariables, true>;

  return new AesGcmSecretCipher(config);
}

describe('AesGcmSecretCipher', () => {
  const key = randomBytes(32).toString('base64');
  const cipher = cipherWith(key);

  it('round-trips a secret', () => {
    const stored = cipher.encrypt('EAAG-token-value', 'tenant-1');

    expect(cipher.decrypt(stored, 'tenant-1')).toBe('EAAG-token-value');
  });

  it('never stores the plaintext', () => {
    const stored = cipher.encrypt('EAAG-token-value', 'tenant-1');

    expect(stored.toString('latin1')).not.toContain('EAAG-token-value');
  });

  it('uses a fresh IV every time', () => {
    const a = cipher.encrypt('same', 'tenant-1');
    const b = cipher.encrypt('same', 'tenant-1');

    expect(a.equals(b)).toBe(false);
  });

  it('refuses a ciphertext moved to another context (another tenant)', () => {
    const stored = cipher.encrypt('secret', 'tenant-1');

    expect(() => cipher.decrypt(stored, 'tenant-2')).toThrow();
  });

  it('refuses a tampered ciphertext', () => {
    const stored = cipher.encrypt('secret', 'tenant-1');

    stored[stored.length - 1] ^= 0xff;

    expect(() => cipher.decrypt(stored, 'tenant-1')).toThrow();
  });

  it('refuses a ciphertext made with another key', () => {
    const other = cipherWith(randomBytes(32).toString('base64'));
    const stored = other.encrypt('secret', 'tenant-1');

    expect(() => cipher.decrypt(stored, 'tenant-1')).toThrow();
  });

  it('rejects a key of the wrong size', () => {
    expect(() => cipherWith(randomBytes(16).toString('base64'))).toThrow(
      /32 bytes/,
    );
  });
});
