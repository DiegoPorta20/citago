import { jest } from '@jest/globals';
import {
  FakeAccessTokenService,
  FakePasswordHasher,
  FakeSecureTokenFactory,
  FakeSessionPolicy,
  FixedClock,
  InMemoryMembershipRepository,
  InMemoryRefreshTokenRepository,
  InMemoryTenantRepository,
  InMemoryUserRepository,
  SequentialIdGenerator,
} from '../../../../../test/support/fakes/identity.fakes.js';
import { Email } from '../../../../shared/domain/email.js';
import { UserRole } from '../../../../shared/domain/user-role.js';
import { BusinessType } from '../../../tenants/domain/business-type.js';
import { Tenant } from '../../../tenants/domain/tenant.entity.js';
import {
  InvalidCredentialsError,
  NoActiveMembershipError,
} from '../../domain/errors/authentication.errors.js';
import { Membership } from '../../domain/membership.entity.js';
import { User } from '../../domain/user.entity.js';
import { SessionIssuer } from '../session-issuer.js';
import { LoginUseCase } from './login.use-case.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const PASSWORD = 'unaClaveSegura1';

describe('LoginUseCase', () => {
  let users: InMemoryUserRepository;
  let memberships: InMemoryMembershipRepository;
  let tenants: InMemoryTenantRepository;
  let useCase: LoginUseCase;

  const seedTenant = async (id: string, slug: string) => {
    const tenant = Tenant.create(
      {
        id,
        name: `Barbería ${slug}`,
        slug,
        businessType: BusinessType.Barbershop,
        country: 'PE',
        currency: 'PEN',
        timezone: 'America/Lima',
      },
      NOW,
    );

    await tenants.save(tenant);

    return tenant;
  };

  const seedUser = async () => {
    const user = User.create(
      {
        id: 'user-1',
        email: Email.create('carlos@barberia.pe'),
        passwordHash: `hashed:${PASSWORD}`,
        name: 'Carlos',
      },
      NOW,
    );

    await users.save(user);

    return user;
  };

  beforeEach(() => {
    users = new InMemoryUserRepository();
    memberships = new InMemoryMembershipRepository();
    tenants = new InMemoryTenantRepository();

    const clock = new FixedClock(NOW);

    useCase = new LoginUseCase(
      users,
      memberships,
      tenants,
      new FakePasswordHasher(),
      new SessionIssuer(
        new FakeAccessTokenService(),
        new InMemoryRefreshTokenRepository(),
        new FakeSecureTokenFactory(),
        new SequentialIdGenerator(),
        clock,
        new FakeSessionPolicy(),
      ),
    );
  });

  it('signs in and returns the tenant, role and session', async () => {
    await seedTenant('tenant-1', 'barberia-uno');
    await seedUser();
    await memberships.save(
      Membership.create(
        {
          id: 'membership-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          role: UserRole.Staff,
        },
        NOW,
      ),
    );

    const result = await useCase.execute({
      email: 'carlos@barberia.pe',
      password: PASSWORD,
    });

    expect(result.tenantId).toBe('tenant-1');
    expect(result.userId).toBe('user-1');
    expect(result.role).toBe(UserRole.Staff);
    expect(result.session.refreshToken).toBe('refresh-1');
  });

  it('accepts the email in any case', async () => {
    await seedTenant('tenant-1', 'barberia-uno');
    await seedUser();
    await memberships.save(
      Membership.create(
        {
          id: 'membership-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          role: UserRole.Owner,
        },
        NOW,
      ),
    );

    await expect(
      useCase.execute({ email: 'CARLOS@Barberia.PE', password: PASSWORD }),
    ).resolves.toMatchObject({ userId: 'user-1' });
  });

  it('rejects a wrong password', async () => {
    await seedTenant('tenant-1', 'barberia-uno');
    await seedUser();

    await expect(
      useCase.execute({ email: 'carlos@barberia.pe', password: 'incorrecta1' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects an unknown email with the same error as a wrong password', async () => {
    // Identical error and identical work: the API cannot be used to find out
    // which emails have an account.
    await expect(
      useCase.execute({ email: 'nadie@barberia.pe', password: PASSWORD }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('verifies a password even when the account does not exist', async () => {
    const hasher = new FakePasswordHasher();
    const verify = jest.spyOn(hasher, 'verify');

    const useCaseWithSpy = new LoginUseCase(
      users,
      memberships,
      tenants,
      hasher,
      new SessionIssuer(
        new FakeAccessTokenService(),
        new InMemoryRefreshTokenRepository(),
        new FakeSecureTokenFactory(),
        new SequentialIdGenerator(),
        new FixedClock(NOW),
        new FakeSessionPolicy(),
      ),
    );

    await expect(
      useCaseWithSpy.execute({
        email: 'nadie@barberia.pe',
        password: PASSWORD,
      }),
    ).rejects.toThrow(InvalidCredentialsError);

    // Equal timing: a missing account still pays for one hash verification.
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('refuses an account with no membership at all', async () => {
    await seedUser();

    await expect(
      useCase.execute({ email: 'carlos@barberia.pe', password: PASSWORD }),
    ).rejects.toThrow(NoActiveMembershipError);
  });

  it('refuses an account whose membership was deactivated', async () => {
    await seedTenant('tenant-1', 'barberia-uno');
    await seedUser();

    const membership = Membership.create(
      {
        id: 'membership-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: UserRole.Staff,
      },
      NOW,
    );
    membership.deactivate(NOW);
    await memberships.save(membership);

    await expect(
      useCase.execute({ email: 'carlos@barberia.pe', password: PASSWORD }),
    ).rejects.toThrow(NoActiveMembershipError);
  });

  it('refuses to sign in to a suspended business', async () => {
    const tenant = await seedTenant('tenant-1', 'barberia-uno');
    tenant.suspend(NOW);
    await tenants.save(tenant);
    await seedUser();
    await memberships.save(
      Membership.create(
        {
          id: 'membership-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          role: UserRole.Owner,
        },
        NOW,
      ),
    );

    await expect(
      useCase.execute({ email: 'carlos@barberia.pe', password: PASSWORD }),
    ).rejects.toThrow(NoActiveMembershipError);
  });

  it('enters the oldest active membership when a person works at two businesses', async () => {
    await seedTenant('tenant-old', 'barberia-antigua');
    await seedTenant('tenant-new', 'barberia-nueva');
    await seedUser();

    await memberships.save(
      Membership.create(
        {
          id: 'membership-new',
          tenantId: 'tenant-new',
          userId: 'user-1',
          role: UserRole.Staff,
        },
        new Date('2026-09-17T12:00:00.000Z'),
      ),
    );
    await memberships.save(
      Membership.create(
        {
          id: 'membership-old',
          tenantId: 'tenant-old',
          userId: 'user-1',
          role: UserRole.Owner,
        },
        new Date('2026-01-01T12:00:00.000Z'),
      ),
    );

    const result = await useCase.execute({
      email: 'carlos@barberia.pe',
      password: PASSWORD,
    });

    // MVP behaviour: no tenant switcher yet, so the oldest access wins.
    expect(result.tenantId).toBe('tenant-old');
  });

  it('skips a suspended business and enters the next active one', async () => {
    const suspended = await seedTenant(
      'tenant-suspended',
      'barberia-suspendida',
    );
    suspended.suspend(NOW);
    await tenants.save(suspended);
    await seedTenant('tenant-active', 'barberia-activa');
    await seedUser();

    await memberships.save(
      Membership.create(
        {
          id: 'membership-suspended',
          tenantId: 'tenant-suspended',
          userId: 'user-1',
          role: UserRole.Owner,
        },
        new Date('2026-01-01T12:00:00.000Z'),
      ),
    );
    await memberships.save(
      Membership.create(
        {
          id: 'membership-active',
          tenantId: 'tenant-active',
          userId: 'user-1',
          role: UserRole.Staff,
        },
        new Date('2026-02-01T12:00:00.000Z'),
      ),
    );

    await expect(
      useCase.execute({ email: 'carlos@barberia.pe', password: PASSWORD }),
    ).resolves.toMatchObject({ tenantId: 'tenant-active' });
  });
});
