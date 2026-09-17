import { hash, verify } from '@node-rs/argon2';
import { Injectable, Logger } from '@nestjs/common';

import { PasswordHasher } from '../../application/ports/password-hasher.port.js';

/**
 * argon2id, the algorithm OWASP recommends first for password storage.
 *
 * Parameters follow the OWASP baseline (19 MiB, 2 iterations, 1 lane). They are
 * fixed here rather than configurable: a weaker setting must not be one
 * environment variable away.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  private readonly logger = new Logger(Argon2PasswordHasher.name);

  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, ARGON2_OPTIONS);
  }

  async verify(hashValue: string, plainPassword: string): Promise<boolean> {
    try {
      return await verify(hashValue, plainPassword, ARGON2_OPTIONS);
    } catch {
      // A malformed or legacy hash must fail as a wrong password, never as a
      // 500. The value itself is never logged.
      this.logger.warn('Rejected a password check against an unreadable hash');
      return false;
    }
  }
}
