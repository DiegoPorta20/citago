import { Injectable } from '@nestjs/common';

import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { RefreshTokenRepository } from '../ports/refresh-token.repository.js';
import { SecureTokenFactory } from '../ports/secure-token-factory.port.js';

export interface LogoutInput {
  readonly refreshToken: string;
}

/**
 * Ends a session by revoking its whole rotation family.
 *
 * Deliberately silent about unknown tokens: signing out twice, or with a
 * garbage value, succeeds. Reporting "no such token" would turn sign-out into
 * an oracle for guessing valid ones.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokenFactory: SecureTokenFactory,
    private readonly clock: Clock,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const stored = await this.refreshTokens.findByHash(
      this.tokenFactory.hash(input.refreshToken),
    );

    if (!stored) {
      return;
    }

    await this.refreshTokens.revokeFamily(stored.familyId, this.clock.now());
  }
}
