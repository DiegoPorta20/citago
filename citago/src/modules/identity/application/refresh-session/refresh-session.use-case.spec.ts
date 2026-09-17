import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import {
  FakeAccessTokenService,
  FakeSecureTokenFactory,
  FakeSessionPolicy,
  FixedClock,
  ImmediateTransactionRunner,
  InMemoryMembershipRepository,
  InMemoryRefreshTokenRepository,
  InMemoryTenantRepository,
  SequentialIdGenerator,
} from '../../../../../test/support/fakes/identity.fakes.js';
import { UserRole } from '../../../../shared/domain/user-role.js';
import { BusinessType } from '../../../tenants/domain/business-type.js';
import { Tenant } from '../../../tenants/domain/tenant.entity.js';
import { InvalidRefreshTokenError } from '../../domain/errors/authentication.errors.js';
import { Membership } from '../../domain/membership.entity.js';
import { SessionIssuer } from '../session-issuer.js';
import { RefreshSessionUseCase } from './refresh-session.use-case.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');

describe('RefreshSessionUseCase', () => {
  let refreshTokens: InMemoryRefreshTokenRepository;
  let memberships: InMemoryMembershipRepository;
  let tenants: InMemoryTenantRepository;
  let tokenFactory: FakeSecureTokenFactory;
  let clock: FixedClock;
  let useCase: RefreshSessionUseCase;

  const seedSession = async () => {
    await tenants.save(
      Tenant.create(
        {
          id: 'tenant-1',
          name: 'Barbería Demo',
          slug: 'barberia-demo',
          businessType: BusinessType.Barbershop,
          country: 'PE',
          currency: 'PEN',
          timezone: 'America/Lima',
        },
        NOW,
      ),
    );

    await memberships.save(
      Membership.create(
        {
          id: 'membership-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          role: UserRole.Admin,
        },
        NOW,
      ),
    );

    const token = tokenFactory.create();

    await refreshTokens.insert({
      id: 'token-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      tokenHash: token.hash,
      familyId: 'family-1',
      expiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
      createdAt: NOW,
    });

    return token.value;
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    refreshTokens = new InMemoryRefreshTokenRepository();
    memberships = new InMemoryMembershipRepository();
    tenants = new InMemoryTenantRepository();
    tokenFactory = new FakeSecureTokenFactory();
    clock = new FixedClock(NOW);

    useCase = new RefreshSessionUseCase(
      refreshTokens,
      memberships,
      tenants,
      tokenFactory,
      new SessionIssuer(
        new FakeAccessTokenService(),
        refreshTokens,
        tokenFactory,
        new SequentialIdGenerator(),
        clock,
        new FakeSessionPolicy(),
      ),
      clock,
      new ImmediateTransactionRunner(),
    );
  });

  it('issues a new pair and rotates the presented token', async () => {
    const refreshToken = await seedSession();

    const result = await useCase.execute({ refreshToken });

    expect(result.tenantId).toBe('tenant-1');
    expect(result.role).toBe(UserRole.Admin);
    expect(result.session.refreshToken).not.toBe(refreshToken);

    const rotated = refreshTokens.tokens.get('token-1');
    expect(rotated?.replacedById).toBe(result.session.refreshTokenId);
    expect(rotated?.revokedAt).toEqual(NOW);
  });

  it('keeps the new token in the same family', async () => {
    const refreshToken = await seedSession();

    const result = await useCase.execute({ refreshToken });
    const issued = refreshTokens.tokens.get(result.session.refreshTokenId);

    expect(issued?.familyId).toBe('family-1');
  });

  it('reads the current role, not the one stored at sign-in', async () => {
    const refreshToken = await seedSession();
    const membership = await memberships.findByIdForTenant(
      'membership-1',
      'tenant-1',
    );
    membership?.changeRole(UserRole.Staff, NOW);

    await expect(useCase.execute({ refreshToken })).resolves.toMatchObject({
      role: UserRole.Staff,
    });
  });

  it('rejects an unknown token', async () => {
    await expect(
      useCase.execute({ refreshToken: 'never-issued' }),
    ).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('rejects an expired token', async () => {
    const refreshToken = await seedSession();
    clock.advanceDays(31);

    await expect(useCase.execute({ refreshToken })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  describe('reuse detection', () => {
    it('revokes the whole family when a rotated token is presented again', async () => {
      const refreshToken = await seedSession();
      const first = await useCase.execute({ refreshToken });

      // The old token is replayed: it leaked.
      await expect(useCase.execute({ refreshToken })).rejects.toThrow(
        InvalidRefreshTokenError,
      );

      // Every token of the family dies, including the legitimate new one, so
      // both the attacker and the real user must sign in again.
      const issued = refreshTokens.tokens.get(first.session.refreshTokenId);
      expect(issued?.revokedAt).not.toBeNull();

      await expect(
        useCase.execute({ refreshToken: first.session.refreshToken }),
      ).rejects.toThrow(InvalidRefreshTokenError);
    });

    it('rejects a token that was revoked by signing out', async () => {
      const refreshToken = await seedSession();
      await refreshTokens.revokeFamily('family-1', NOW);

      await expect(useCase.execute({ refreshToken })).rejects.toThrow(
        InvalidRefreshTokenError,
      );
    });
  });

  describe('access is re-checked, not just at sign-in', () => {
    it('refuses and kills the family when the membership was revoked', async () => {
      const refreshToken = await seedSession();
      const membership = await memberships.findByIdForTenant(
        'membership-1',
        'tenant-1',
      );
      membership?.deactivate(NOW);

      await expect(useCase.execute({ refreshToken })).rejects.toThrow(
        InvalidRefreshTokenError,
      );

      expect(refreshTokens.tokens.get('token-1')?.revokedAt).toEqual(NOW);
    });

    it('refuses when the business was suspended', async () => {
      const refreshToken = await seedSession();
      const tenant = await tenants.findById('tenant-1');
      tenant?.suspend(NOW);

      await expect(useCase.execute({ refreshToken })).rejects.toThrow(
        InvalidRefreshTokenError,
      );
    });
  });
});
