import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../../config/environment.js';
import { SecretCipher } from '../../application/ports/secret-cipher.port.js';

/** Format version, so the key or algorithm can be rotated later. */
const FORMAT_V1 = 1;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 1 + IV_BYTES + TAG_BYTES;

/**
 * AES-256-GCM: confidentiality plus integrity. Layout of the stored value:
 *
 *   [version:1][iv:12][auth tag:16][ciphertext:n]
 *
 * A fresh random IV per encryption; the context is authenticated data, so it
 * is not stored but must match on decryption.
 */
@Injectable()
export class AesGcmSecretCipher extends SecretCipher {
  private readonly key: Buffer;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.key = AesGcmSecretCipher.parseKey(
      config.get('ENCRYPTION_KEY', { infer: true }),
    );
  }

  static parseKey(encoded: string): Buffer {
    const key = Buffer.from(encoded, 'base64');

    if (key.length !== KEY_BYTES) {
      throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes.');
    }

    return key;
  }

  encrypt(plaintext: string, context: string): Buffer {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    cipher.setAAD(Buffer.from(context, 'utf8'));

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return Buffer.concat([
      Buffer.from([FORMAT_V1]),
      iv,
      cipher.getAuthTag(),
      ciphertext,
    ]);
  }

  decrypt(stored: Buffer, context: string): string {
    if (stored.length <= HEADER_BYTES || stored[0] !== FORMAT_V1) {
      throw new Error('Unsupported encrypted secret format.');
    }

    const iv = stored.subarray(1, 1 + IV_BYTES);
    const tag = stored.subarray(1 + IV_BYTES, HEADER_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);

    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(stored.subarray(HEADER_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  }
}
