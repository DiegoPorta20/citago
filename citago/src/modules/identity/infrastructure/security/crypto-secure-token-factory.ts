import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  SecureTokenFactory,
  type GeneratedToken,
} from '../../application/ports/secure-token-factory.port.js';

/** 256 bits of entropy: not guessable, and short enough for a header. */
const TOKEN_BYTES = 32;

@Injectable()
export class CryptoSecureTokenFactory extends SecureTokenFactory {
  create(): GeneratedToken {
    const value = randomBytes(TOKEN_BYTES).toString('base64url');

    return { value, hash: this.hash(value) };
  }

  /**
   * SHA-256, not argon2.
   *
   * The token is 256 random bits, so there is nothing to brute-force and no
   * need for a slow KDF — unlike a password, which a human chose. Hashing
   * still means a database dump cannot be replayed as sessions.
   */
  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
