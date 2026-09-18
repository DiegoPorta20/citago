import { Injectable } from '@nestjs/common';

import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';
import { PhoneNumber } from '../../../shared/domain/phone-number.js';
import { TenantRepository } from '../../tenants/domain/tenant.repository.js';

class TenantNotAvailableError extends DomainError {
  readonly code = 'TENANT_NOT_AVAILABLE';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('The business of this session is not available.');
  }
}

/**
 * Turns what a person typed into a canonical `PhoneNumber`, using the
 * **tenant's country** as the default region.
 *
 * Shared by create and update so the two can never normalize differently —
 * which is exactly how duplicate customers are born.
 */
@Injectable()
export class ClientPhoneNormalizer {
  constructor(private readonly tenants: TenantRepository) {}

  /**
   * `undefined` means "not provided" (leave as is); `null` or an empty string
   * means "clear it".
   */
  async normalize(
    tenantId: string,
    raw: string | null | undefined,
  ): Promise<PhoneNumber | null | undefined> {
    if (raw === undefined) {
      return undefined;
    }
    if (raw === null || raw.trim().length === 0) {
      return null;
    }

    const tenant = await this.tenants.findById(tenantId);

    if (!tenant) {
      throw new TenantNotAvailableError();
    }

    return PhoneNumber.create(raw, tenant.country);
  }
}
