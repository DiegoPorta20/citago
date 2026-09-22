import {
  FakePasswordHasher,
  FakeSecureTokenFactory,
  FixedClock,
  ImmediateTransactionRunner,
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  SequentialIdGenerator,
} from '../../../../../test/support/fakes/identity.fakes.js';
import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { Email } from '../../../../shared/domain/email.js';
import { UserRole } from '../../../../shared/domain/user-role.js';
import {
  CannotChangeOwnAccessError,
  LastOwnerError,
  MembershipNotFoundError,
  RoleChangeNotAllowedError,
  UserAlreadyInTeamError,
} from '../../domain/errors/team.errors.js';
import { MembershipStatus } from '../../domain/membership-status.js';
import { Membership } from '../../domain/membership.entity.js';
import { User } from '../../domain/user.entity.js';
import {
  AddTeamMemberUseCase,
  ChangeTeamMemberAccessUseCase,
  ListTeamMembersUseCase,
  TeamPolicy,
} from './team.use-cases.js';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const NOW = new Date('2026-09-21T15:00:00.000Z');

describe('Team management', () => {
  let users: InMemoryUserRepository;
  let memberships: InMemoryMembershipRepository;
  let add: AddTeamMemberUseCase;
  let change: ChangeTeamMemberAccessUseCase;
  let list: ListTeamMembersUseCase;
  let sequence: number;

  const account = async (
    name: string,
    email: string,
    tenantId = TENANT,
    role = UserRole.Staff,
    status = MembershipStatus.Active,
  ): Promise<{ user: User; membership: Membership }> => {
    sequence += 1;
    const user = User.create(
      {
        id: `user-${sequence}`,
        email: Email.create(email),
        passwordHash: 'hashed',
        name,
      },
      NOW,
    );
    const membership = Membership.create(
      {
        id: `membership-${sequence}`,
        tenantId,
        userId: user.id,
        role,
      },
      NOW,
    );

    if (status === MembershipStatus.Inactive) {
      membership.deactivate(NOW);
    }

    await users.save(user);
    await memberships.save(membership);

    return { user, membership };
  };

  const auth = (role: UserRole, userId: string): AuthContext => ({
    userId,
    tenantId: TENANT,
    membershipId: `membership-of-${userId}`,
    role,
  });

  beforeEach(async () => {
    sequence = 0;
    users = new InMemoryUserRepository();
    memberships = new InMemoryMembershipRepository();

    const policy = new TeamPolicy();
    const clock = new FixedClock(NOW);
    const transaction = new ImmediateTransactionRunner();

    add = new AddTeamMemberUseCase(
      memberships,
      users,
      new FakePasswordHasher(),
      new FakeSecureTokenFactory(),
      policy,
      transaction,
      new SequentialIdGenerator(),
      clock,
    );
    change = new ChangeTeamMemberAccessUseCase(
      memberships,
      users,
      policy,
      transaction,
      clock,
    );
    list = new ListTeamMembersUseCase(memberships, users);

    await account('Carlos', 'owner@demo.local', TENANT, UserRole.Owner);
  });

  describe('listing', () => {
    it('shows everyone of this business, revoked people included', async () => {
      await account('Luis', 'luis@demo.local');
      await account(
        'Ana',
        'ana@demo.local',
        TENANT,
        UserRole.Admin,
        MembershipStatus.Inactive,
      );
      await account('Ajeno', 'ajeno@otra.local', OTHER_TENANT);

      const result = await list.execute(auth(UserRole.Owner, 'user-1'));

      expect(result.map((view) => view.user.name)).toEqual([
        'Carlos',
        'Luis',
        'Ana',
      ]);
      expect(result[2].membership.status).toBe(MembershipStatus.Inactive);
    });
  });

  describe('adding access', () => {
    it('creates the account and hands over a temporary password, once', async () => {
      const result = await add.execute(auth(UserRole.Owner, 'user-1'), {
        name: 'Luis Torres',
        email: 'luis@demo.local',
        role: UserRole.Staff,
      });

      expect(result.temporaryPassword).toEqual(expect.any(String));
      expect(
        (result.temporaryPassword as string).length,
      ).toBeGreaterThanOrEqual(10);
      expect(result.member.membership.role).toBe(UserRole.Staff);
    });

    it('returns no password when the inviter chose one', async () => {
      const result = await add.execute(auth(UserRole.Owner, 'user-1'), {
        name: 'Luis',
        email: 'luis@demo.local',
        role: UserRole.Staff,
        password: 'unaClaveSegura1',
      });

      expect(result.temporaryPassword).toBeNull();
    });

    it('attaches an existing account instead of duplicating the person', async () => {
      const outsider = await account(
        'Ana',
        'ana@demo.local',
        OTHER_TENANT,
        UserRole.Owner,
      );

      const result = await add.execute(auth(UserRole.Owner, 'user-1'), {
        name: 'Ana',
        email: 'ana@demo.local',
        role: UserRole.Staff,
      });

      expect(result.member.user.id).toBe(outsider.user.id);
      expect(result.temporaryPassword).toBeNull();
      // Their access to the other business is untouched.
      expect(outsider.membership.role).toBe(UserRole.Owner);
    });

    it('refuses someone who already has access here', async () => {
      await account('Luis', 'luis@demo.local');

      await expect(
        add.execute(auth(UserRole.Owner, 'user-1'), {
          name: 'Luis',
          email: 'luis@demo.local',
          role: UserRole.Staff,
        }),
      ).rejects.toThrow(UserAlreadyInTeamError);
    });

    it('lets an ADMIN add staff, but never a peer or an owner', async () => {
      const admin = auth(UserRole.Admin, 'user-9');

      await expect(
        add.execute(admin, {
          name: 'Luis',
          email: 'luis@demo.local',
          role: UserRole.Staff,
        }),
      ).resolves.toBeDefined();

      await expect(
        add.execute(admin, {
          name: 'Ana',
          email: 'ana@demo.local',
          role: UserRole.Admin,
        }),
      ).rejects.toThrow(RoleChangeNotAllowedError);
    });
  });

  describe('changing access', () => {
    it('promotes and demotes', async () => {
      const luis = await account('Luis', 'luis@demo.local');

      const promoted = await change.changeRole(
        auth(UserRole.Owner, 'user-1'),
        luis.membership.id,
        UserRole.Admin,
      );

      expect(promoted.membership.role).toBe(UserRole.Admin);
    });

    it('revokes and restores without deleting anything', async () => {
      const luis = await account('Luis', 'luis@demo.local');
      const owner = auth(UserRole.Owner, 'user-1');

      const revoked = await change.revoke(owner, luis.membership.id);

      expect(revoked.membership.status).toBe(MembershipStatus.Inactive);

      const restored = await change.restore(owner, luis.membership.id);

      expect(restored.membership.status).toBe(MembershipStatus.Active);
      expect(restored.membership.role).toBe(UserRole.Staff);
    });

    it('keeps at least one active OWNER (rule ID-1)', async () => {
      const second = await account(
        'Ana',
        'ana@demo.local',
        TENANT,
        UserRole.Owner,
      );
      const ana = auth(UserRole.Owner, second.user.id);

      // Only one other owner left: the first one cannot be pushed out.
      await expect(change.revoke(ana, 'membership-1')).resolves.toBeDefined();

      await expect(
        change.changeRole(
          auth(UserRole.Owner, 'user-1'),
          second.membership.id,
          UserRole.Admin,
        ),
      ).rejects.toThrow(LastOwnerError);
    });

    it('never lets anyone lock themselves out (rule ID-7)', async () => {
      const owner = auth(UserRole.Owner, 'user-1');

      await expect(change.revoke(owner, 'membership-1')).rejects.toThrow(
        CannotChangeOwnAccessError,
      );
      await expect(
        change.changeRole(owner, 'membership-1', UserRole.Staff),
      ).rejects.toThrow(CannotChangeOwnAccessError);
    });

    it('stops an ADMIN from touching an owner or a peer', async () => {
      const admin = auth(UserRole.Admin, 'user-9');

      await expect(change.revoke(admin, 'membership-1')).rejects.toThrow(
        RoleChangeNotAllowedError,
      );
    });

    it('hides a membership of another business behind a not found', async () => {
      const outsider = await account('Ajeno', 'ajeno@otra.local', OTHER_TENANT);

      await expect(
        change.revoke(auth(UserRole.Owner, 'user-1'), outsider.membership.id),
      ).rejects.toThrow(MembershipNotFoundError);
    });
  });
});
