import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  SecureTokenFactory,
  type GeneratedToken,
} from '../../application/ports/secure-token-factory.port.js';

const TOKEN_BYTES = 32;

@Injectable()
export class CryptoSecureTokenFactory extends SecureTokenFactory {
  create(): GeneratedToken {
    const value = randomBytes(TOKEN_BYTES).toString('base64url');

    return { value, hash: this.hash(value) };
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
