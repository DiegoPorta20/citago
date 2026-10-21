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
import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { UserRole } from '../../../../shared/domain/user-role.js';
import { BusinessType } from '../../../tenants/domain/business-type.js';
import { Tenant } from '../../../tenants/domain/tenant.entity.js';
import {
  InvalidRefreshTokenError,
  NotAMemberError,
} from '../../domain/errors/authentication.errors.js';
import { Membership } from '../../domain/membership.entity.js';
import { RefreshSessionUseCase } from '../refresh-session/refresh-session.use-case.js';
import { SessionIssuer } from '../session-issuer.js';
import { SwitchTenantUseCase } from './switch-tenant.use-case.js';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

describe('SwitchTenantUseCase', () => {
  let refreshTokens: InMemoryRefreshTokenRepository;
  let memberships: InMemoryMembershipRepository;
  let tenants: InMemoryTenantRepository;
  let tokenFactory: FakeSecureTokenFactory;
  let clock: FixedClock;
  let sessionIssuer: SessionIssuer;
  let useCase: SwitchTenantUseCase;

  const tenant = (id: string, name: string) =>
    Tenant.create(
      {
        id,
        name,
        slug: id,
        businessType: BusinessType.Barbershop,
        country: 'PE',
        currency: 'PEN',
        timezone: 'America/Lima',
      },
      NOW,
    );

  const seedMembership = (
    id: string,
    tenantId: string,
    userId: string,
    role: UserRole,
  ) => memberships.save(Membership.create({ id, tenantId, userId, role }, NOW));

  const seedSessionInTenant1 = async (userId = 'user-1') => {
    const token = tokenFactory.create();

    await refreshTokens.insert({
      id: 'token-1',
      userId,
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      tokenHash: token.hash,
      familyId: 'family-1',
      expiresAt: new Date(NOW.getTime() + TTL_MS),
      createdAt: NOW,
    });

    return token.value;
  };

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    role: UserRole.Owner,
  };

  beforeEach(async () => {
    refreshTokens = new InMemoryRefreshTokenRepository();
    memberships = new InMemoryMembershipRepository();
    tenants = new InMemoryTenantRepository();
    tokenFactory = new FakeSecureTokenFactory();
    clock = new FixedClock(NOW);

    sessionIssuer = new SessionIssuer(
      new FakeAccessTokenService(),
      refreshTokens,
      tokenFactory,
      new SequentialIdGenerator(),
      clock,
      new FakeSessionPolicy(),
    );

    useCase = new SwitchTenantUseCase(
      refreshTokens,
      memberships,
      tenants,
      tokenFactory,
      sessionIssuer,
      clock,
      new ImmediateTransactionRunner(),
    );

    await tenants.save(tenant('tenant-1', 'Barbería Uno'));
    await tenants.save(tenant('tenant-2', 'Barbería Dos'));
    await seedMembership('membership-1', 'tenant-1', 'user-1', UserRole.Owner);
    await seedMembership('membership-2', 'tenant-2', 'user-1', UserRole.Staff);
  });

  it('issues a session for the target membership and reports its role', async () => {
    const refreshToken = await seedSessionInTenant1();

    const result = await useCase.execute(actor, {
      tenantId: 'tenant-2',
      refreshToken,
    });

    expect(result.tenantId).toBe('tenant-2');
    expect(result.membershipId).toBe('membership-2');
    expect(result.role).toBe(UserRole.Staff);
    expect(result.session.refreshToken).not.toBe(refreshToken);
  });

  it('starts a new rotation family, independent of the old one', async () => {
    const refreshToken = await seedSessionInTenant1();

    const result = await useCase.execute(actor, {
      tenantId: 'tenant-2',
      refreshToken,
    });

    const issued = refreshTokens.tokens.get(result.session.refreshTokenId);
    expect(issued?.familyId).not.toBe('family-1');
  });

  it('revokes the old family so its refresh token can no longer be used', async () => {
    const refreshToken = await seedSessionInTenant1();

    await useCase.execute(actor, { tenantId: 'tenant-2', refreshToken });

    expect(refreshTokens.tokens.get('token-1')?.revokedAt).toEqual(NOW);

    const refreshUseCase = new RefreshSessionUseCase(
      refreshTokens,
      memberships,
      tenants,
      tokenFactory,
      sessionIssuer,
      clock,
      new ImmediateTransactionRunner(),
    );

    await expect(refreshUseCase.execute({ refreshToken })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it('allows switching to the current tenant (idempotent), issuing a fresh session', async () => {
    const refreshToken = await seedSessionInTenant1();

    const result = await useCase.execute(actor, {
      tenantId: 'tenant-1',
      refreshToken,
    });

    expect(result.tenantId).toBe('tenant-1');
    expect(result.membershipId).toBe('membership-1');
    expect(result.session.refreshToken).not.toBe(refreshToken);
    expect(refreshTokens.tokens.get('token-1')?.revokedAt).toEqual(NOW);
    const issued = refreshTokens.tokens.get(result.session.refreshTokenId);
    expect(issued?.familyId).not.toBe('family-1');
    expect(issued?.revokedAt).toBeNull();
  });

  it('rejects a target the caller has no membership in', async () => {
    const refreshToken = await seedSessionInTenant1();
    await seedMembership('membership-x', 'tenant-3', 'other', UserRole.Owner);
    await tenants.save(tenant('tenant-3', 'Ajena'));

    await expect(
      useCase.execute(actor, { tenantId: 'tenant-3', refreshToken }),
    ).rejects.toThrow(NotAMemberError);
  });

  it('rejects a target the caller only had revoked access to', async () => {
    const refreshToken = await seedSessionInTenant1();
    const membership = await memberships.findByIdForTenant(
      'membership-2',
      'tenant-2',
    );
    membership?.deactivate(NOW);
    await memberships.save(membership!);

    await expect(
      useCase.execute(actor, { tenantId: 'tenant-2', refreshToken }),
    ).rejects.toThrow(NotAMemberError);
  });

  it('rejects a target whose business is suspended', async () => {
    const refreshToken = await seedSessionInTenant1();
    const target = await tenants.findById('tenant-2');
    target?.suspend(NOW);
    await tenants.save(target!);

    await expect(
      useCase.execute(actor, { tenantId: 'tenant-2', refreshToken }),
    ).rejects.toThrow(NotAMemberError);
  });

  it('rejects a refresh token that belongs to another user', async () => {
    const foreign = tokenFactory.create();
    await refreshTokens.insert({
      id: 'token-foreign',
      userId: 'user-2',
      tenantId: 'tenant-1',
      membershipId: 'membership-foreign',
      tokenHash: foreign.hash,
      familyId: 'family-foreign',
      expiresAt: new Date(NOW.getTime() + TTL_MS),
      createdAt: NOW,
    });

    await expect(
      useCase.execute(actor, {
        tenantId: 'tenant-2',
        refreshToken: foreign.value,
      }),
    ).rejects.toThrow(InvalidRefreshTokenError);

    expect(refreshTokens.tokens.get('token-foreign')?.revokedAt).toBeNull();
  });

  it('rejects an unknown refresh token', async () => {
    await expect(
      useCase.execute(actor, {
        tenantId: 'tenant-2',
        refreshToken: 'never-issued',
      }),
    ).rejects.toThrow(InvalidRefreshTokenError);
  });
});
