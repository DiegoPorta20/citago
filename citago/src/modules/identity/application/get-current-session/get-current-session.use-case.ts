import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import {
  DomainError,
  DomainErrorCategory,
} from '../../../../shared/domain/domain-error.js';
import type { UserRole } from '../../../../shared/domain/user-role.js';
import type { BusinessType } from '../../../tenants/domain/business-type.js';
import { TenantRepository } from '../../../tenants/domain/tenant.repository.js';
import { UserRepository } from '../../domain/user.repository.js';

class SessionOwnerNotFoundError extends DomainError {
  readonly code = 'SESSION_OWNER_NOT_FOUND';
  readonly category = DomainErrorCategory.Unauthorized;

  constructor() {
    super('The session is no longer valid.');
  }
}

export interface CurrentSession {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
  };
  readonly tenant: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly businessType: BusinessType;
    readonly country: string;
    readonly currency: string;
    readonly timezone: string;
  };
  readonly role: UserRole;
}

/**
 * Describes the caller: who they are, which business they are in, and with
 * which role. The mobile app uses it to bootstrap after sign-in.
 *
 * Everything comes from the verified session, never from the request body.
 */
@Injectable()
export class GetCurrentSessionUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly tenants: TenantRepository,
  ) {}

  async execute(actor: AuthContext): Promise<CurrentSession> {
    const user = await this.users.findById(actor.userId);
    const tenant = await this.tenants.findById(actor.tenantId);

    if (!user || !tenant) {
      throw new SessionOwnerNotFoundError();
    }

    return {
      user: { id: user.id, email: user.email.value, name: user.name },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        businessType: tenant.businessType,
        country: tenant.country,
        currency: tenant.currency,
        timezone: tenant.timezone,
      },
      role: actor.role,
    };
  }
}
