import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../../../config/environment.js';
import { SessionPolicy } from '../../application/ports/session-policy.port.js';

@Injectable()
export class ConfigSessionPolicy extends SessionPolicy {
  private readonly ttlDays: number;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.ttlDays = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
  }

  get refreshTokenTtlDays(): number {
    return this.ttlDays;
  }
}
