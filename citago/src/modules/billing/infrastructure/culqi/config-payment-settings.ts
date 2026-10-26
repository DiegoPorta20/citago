import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../../../config/environment.js';
import { PaymentSettings } from '../../application/ports/payment-settings.port.js';
import type { PlanCode } from '../../domain/plan.js';

@Injectable()
export class ConfigPaymentSettings extends PaymentSettings {
  readonly publicKey: string;
  readonly pageBaseUrl: string;
  private readonly secretKey: string;
  private readonly planIds: Readonly<Record<string, string>>;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.publicKey = config.get('CULQI_PUBLIC_KEY', { infer: true }).trim();
    this.secretKey = config.get('CULQI_SECRET_KEY', { infer: true }).trim();
    this.pageBaseUrl = config
      .get('PUBLIC_BASE_URL', { infer: true })
      .replace(/\/+$/, '');
    this.planIds = {
      STARTER: config.get('CULQI_PLAN_STARTER_ID', { infer: true }).trim(),
      PRO: config.get('CULQI_PLAN_PRO_ID', { infer: true }).trim(),
      BUSINESS: config.get('CULQI_PLAN_BUSINESS_ID', { infer: true }).trim(),
    };
  }

  isEnabledFor(planCode: PlanCode): boolean {
    return (
      this.publicKey.length > 0 &&
      this.secretKey.length > 0 &&
      (this.planIds[planCode] ?? '').length > 0
    );
  }
}
