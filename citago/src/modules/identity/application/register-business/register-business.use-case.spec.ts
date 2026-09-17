import {
  FakeAccessTokenService,
  FakePasswordHasher,
  FakeSecureTokenFactory,
  FakeSessionPolicy,
  FixedClock,
  ImmediateTransactionRunner,
  InMemoryMembershipRepository,
  InMemoryRefreshTokenRepository,
  InMemoryTenantRepository,
  InMemoryUserRepository,
  SequentialIdGenerator,
} from '../../../../../test/support/fakes/identity.fakes.js';
import { Email } from '../../../../shared/domain/email.js';
import { UserRole } from '../../../../shared/domain/user-role.js';
import { Tenant } from '../../../tenants/domain/tenant.entity.js';
import { BusinessType } from '../../../tenants/domain/business-type.js';
import { EmailAlreadyRegisteredError } from '../../domain/errors/authentication.errors.js';
import { MembershipStatus } from '../../domain/membership-status.js';
import { SessionIssuer } from '../session-issuer.js';
import { RegisterBusinessUseCase } from './register-business.use-case.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');

const validInput = {
  businessName: 'Barbería Los Ángeles',
  country: 'PE',
  currency: 'PEN',
  timezone: 'America/Lima',
  ownerName: 'Carlos Ramírez',
  ownerEmail: 'Carlos@Barberia.PE',
  password: 'unaClaveSegura1',
};

describe('RegisterBusinessUseCase', () => {
  let tenants: InMemoryTenantRepository;
  let users: InMemoryUserRepository;
  let memberships: InMemoryMembershipRepository;
  let refreshTokens: InMemoryRefreshTokenRepository;
  let transaction: ImmediateTransactionRunner;
  let useCase: RegisterBusinessUseCase;

  beforeEach(() => {
    tenants = new InMemoryTenantRepository();
    users = new InMemoryUserRepository();
    memberships = new InMemoryMembershipRepository();
    refreshTokens = new InMemoryRefreshTokenRepository();
    transaction = new ImmediateTransactionRunner();

    const clock = new FixedClock(NOW);
    const ids = new SequentialIdGenerator();

    useCase = new RegisterBusinessUseCase(
      tenants,
      users,
      memberships,
      new FakePasswordHasher(),
      new SessionIssuer(
        new FakeAccessTokenService(),
        refreshTokens,
        new FakeSecureTokenFactory(),
        ids,
        clock,
        new FakeSessionPolicy(),
      ),
      ids,
      clock,
      transaction,
    );
  });

  it('creates the tenant, the account and an OWNER membership', async () => {
    const result = await useCase.execute(validInput);

    const tenant = await tenants.findById(result.tenantId);
    const user = await users.findById(result.userId);
    const membership = await memberships.findByIdForTenant(
      result.membershipId,
      result.tenantId,
    );

    expect(tenant?.name).toBe('Barbería Los Ángeles');
    expect(tenant?.slug).toBe('barberia-los-angeles');
    expect(tenant?.businessType).toBe(BusinessType.Barbershop);
    expect(user?.email.value).toBe('carlos@barberia.pe');
    expect(membership?.role).toBe(UserRole.Owner);
    expect(membership?.status).toBe(MembershipStatus.Active);
    expect(result.role).toBe(UserRole.Owner);
  });

  it('starts every tenant with exactly one active OWNER (rule ID-1)', async () => {
    const result = await useCase.execute(validInput);

    await expect(
      memberships.countActiveByRole(result.tenantId, UserRole.Owner),
    ).resolves.toBe(1);
  });

  it('returns a usable session', async () => {
    const result = await useCase.execute(validInput);

    expect(result.session.accessToken).toBe(
      `access:${result.userId}:${result.tenantId}:${result.membershipId}`,
    );
    expect(result.session.refreshToken).toBe('refresh-1');
    expect(result.session.accessTokenExpiresInSeconds).toBe(900);
    expect(refreshTokens.tokens.size).toBe(1);
  });

  it('stores what the hasher produced, never the raw password', async () => {
    const result = await useCase.execute(validInput);
    const user = await users.findById(result.userId);

    // The fake hash is reversible on purpose (fast tests); what matters here
    // is that the use case persists the hasher's output and not the input.
    // Argon2PasswordHasher has its own spec for the real algorithm.
    expect(user?.passwordHash).toBe(
      await new FakePasswordHasher().hash(validInput.password),
    );
    expect(user?.passwordHash).not.toBe(validInput.password);
  });

  it('writes everything inside one transaction', async () => {
    await useCase.execute(validInput);

    // A half-created business would leave an account that cannot enter anywhere.
    expect(transaction.calls).toBe(1);
  });

  it('rejects an email that already has an account, case-insensitively', async () => {
    await useCase.execute(validInput);

    await expect(
      useCase.execute({ ...validInput, ownerEmail: 'CARLOS@barberia.pe' }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });

  it('gives the second business with the same name a distinct slug', async () => {
    await tenants.save(
      Tenant.create(
        {
          id: 'existing',
          name: 'Barbería Los Ángeles',
          slug: 'barberia-los-angeles',
          businessType: BusinessType.Barbershop,
          country: 'PE',
          currency: 'PEN',
          timezone: 'America/Lima',
        },
        NOW,
      ),
    );

    const result = await useCase.execute(validInput);
    const tenant = await tenants.findById(result.tenantId);

    expect(tenant?.slug).toBe('barberia-los-angeles-2');
  });

  it('rejects an invalid email before touching the database', async () => {
    await expect(
      useCase.execute({ ...validInput, ownerEmail: 'not-an-email' }),
    ).rejects.toThrow();

    expect(tenants.tenants.size).toBe(0);
    expect(users.users.size).toBe(0);
  });

  it('rejects an invalid time zone without creating an account', async () => {
    await expect(
      useCase.execute({ ...validInput, timezone: 'America/Atlantis' }),
    ).rejects.toThrow();

    await expect(
      users.existsByEmail(Email.create(validInput.ownerEmail)),
    ).resolves.toBe(false);
  });
});
