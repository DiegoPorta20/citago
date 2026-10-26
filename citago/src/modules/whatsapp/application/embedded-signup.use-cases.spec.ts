import {
  FakeHandoffTokens,
  FixedSignupSettings,
  FakeSecretCipher,
  InMemoryWhatsAppChannelRepository,
  ScriptedCloudApi,
  TOKEN,
} from '../../../../test/support/fakes/whatsapp.fakes.js';
import {
  FixedClock,
  ImmediateTransactionRunner,
  SequentialIdGenerator,
} from '../../../../test/support/fakes/identity.fakes.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import {
  WhatsAppSignupNotConfiguredError,
  WhatsAppSignupRejectedError,
} from '../domain/embedded-signup.errors.js';
import {
  WhatsAppNumberInUseError,
  WhatsAppUnavailableError,
} from '../domain/whatsapp.errors.js';
import { WhatsAppChannel } from '../domain/whatsapp-channel.entity.js';
import {
  CompleteEmbeddedSignupUseCase,
  GetEmbeddedSignupConfigUseCase,
  StartEmbeddedSignupUseCase,
  WhatsAppChannelConnector,
} from './embedded-signup.use-cases.js';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const NUMBER = '106540352242922';
const WABA = '102290129340398';

const owner: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-a',
  membershipId: 'membership-1',
  role: UserRole.Owner,
};

describe('Embedded Signup', () => {
  let channels: InMemoryWhatsAppChannelRepository;
  let cloud: ScriptedCloudApi;
  let complete: CompleteEmbeddedSignupUseCase;

  const build = (settings = new FixedSignupSettings()) => {
    const clock = new FixedClock(NOW);

    complete = new CompleteEmbeddedSignupUseCase(
      settings,
      cloud,
      new WhatsAppChannelConnector(
        channels,
        new FakeSecretCipher(),
        new ImmediateTransactionRunner(),
        new SequentialIdGenerator(),
        clock,
      ),
    );
  };

  const finish = (tenantId = 'tenant-a', code = 'code-1') =>
    complete.execute(tenantId, {
      code,
      phoneNumberId: NUMBER,
      wabaId: WABA,
    });

  beforeEach(() => {
    channels = new InMemoryWhatsAppChannelRepository();
    cloud = new ScriptedCloudApi();
    build();
  });

  describe('completing the sign-up', () => {
    it('onboards in Meta’s order: code, check the number, subscribe, register', async () => {
      await finish();

      expect(cloud.calls).toEqual([
        'exchangeCode:code-1',
        `getPhoneNumber:${NUMBER}`,
        `subscribeApp:${WABA}:${TOKEN}`,
        `registerPhone:${NUMBER}`,
      ]);
    });

    it('connects the number to the business that started the flow', async () => {
      const channel = await finish();
      const snapshot = channel.toSnapshot();

      expect(snapshot).toMatchObject({
        tenantId: 'tenant-a',
        phoneNumberId: NUMBER,
        wabaId: WABA,
        displayPhoneNumber: '+51 999 999 999',
        verifiedName: 'Barbería',
      });
      await expect(channels.findByTenant('tenant-a')).resolves.toBeDefined();
    });

    it('stores the token encrypted for this business and number only', async () => {
      const channel = await finish();
      const stored = channel.toSnapshot().encryptedAccessToken;
      const cipher = new FakeSecretCipher();

      expect(stored.toString()).not.toBe(TOKEN);
      expect(
        cipher.decrypt(
          stored,
          WhatsAppChannel.tokenContext('tenant-a', NUMBER),
        ),
      ).toBe(TOKEN);
      expect(() =>
        cipher.decrypt(
          stored,
          WhatsAppChannel.tokenContext('tenant-b', NUMBER),
        ),
      ).toThrow();
    });

    it('replaces the number when the business signs up again', async () => {
      await finish();
      await complete.execute('tenant-a', {
        code: 'code-2',
        phoneNumberId: '106540352242999',
        wabaId: WABA,
      });

      expect(channels.channels.size).toBe(1);
      await expect(channels.findByTenant('tenant-a')).resolves.toMatchObject({
        phoneNumberId: '106540352242999',
      });
    });

    it('rejects a code Meta refuses, and changes nothing', async () => {
      cloud.failAt('exchangeCode', 'REJECTED');

      await expect(finish()).rejects.toThrow(WhatsAppSignupRejectedError);
      expect(cloud.calls).toEqual(['exchangeCode:code-1']);
      expect(channels.channels.size).toBe(0);
    });

    it('refuses a token that cannot see the number, before subscribing or registering', async () => {
      cloud.failAt('getPhoneNumber', 'UNAUTHORIZED');

      await expect(finish()).rejects.toThrow(WhatsAppSignupRejectedError);
      expect(cloud.calls.some((call) => call.startsWith('subscribeApp'))).toBe(
        false,
      );
      expect(cloud.calls.some((call) => call.startsWith('registerPhone'))).toBe(
        false,
      );
      expect(channels.channels.size).toBe(0);
    });

    it.each(['subscribeApp', 'registerPhone'])(
      'saves nothing when %s fails, so the app never shows a number that cannot work',
      async (step) => {
        cloud.failAt(step, 'REJECTED');

        await expect(finish()).rejects.toThrow(WhatsAppSignupRejectedError);
        expect(channels.channels.size).toBe(0);
      },
    );

    it('reports Meta being down as unavailable, not as a rejected sign-up', async () => {
      cloud.failAt('exchangeCode', 'UNAVAILABLE');

      await expect(finish()).rejects.toThrow(WhatsAppUnavailableError);
    });

    it('does not take a number another business already connected', async () => {
      await finish('tenant-a');

      await expect(finish('tenant-b', 'code-3')).rejects.toThrow(
        WhatsAppNumberInUseError,
      );
      await expect(channels.findByTenant('tenant-a')).resolves.toMatchObject({
        phoneNumberId: NUMBER,
      });
    });

    it('does nothing until the Meta app is configured', async () => {
      build(new FixedSignupSettings(null));

      await expect(finish()).rejects.toThrow(WhatsAppSignupNotConfiguredError);
      expect(cloud.calls).toEqual([]);
    });
  });

  describe('starting the sign-up', () => {
    const tokens = () => new FakeHandoffTokens();

    it('returns a page URL whose token is in the fragment and works only for this flow', () => {
      const handoff = tokens();
      const { url, expiresInSeconds } = new StartEmbeddedSignupUseCase(
        new FixedSignupSettings(),
        handoff,
      ).execute(owner);

      const [page, fragment] = url.split('#');
      const token = new URLSearchParams(fragment).get('t') ?? '';

      expect(page).toBe('https://api.citago.test/api/v1/pages/whatsapp-signup');
      expect(expiresInSeconds).toBe(900);
      expect(handoff.verify(token, 'whatsapp-signup')).toEqual({
        tenantId: 'tenant-a',
        userId: 'user-1',
        purpose: 'whatsapp-signup',
      });
      expect(handoff.verify(token, 'checkout')).toBeNull();
    });

    it('refuses to hand out a link while the Meta app is not configured', () => {
      expect(() =>
        new StartEmbeddedSignupUseCase(
          new FixedSignupSettings(null),
          tokens(),
        ).execute(owner),
      ).toThrow(WhatsAppSignupNotConfiguredError);
    });

    it('serves the page what it needs to start the SDK', () => {
      expect(
        new GetEmbeddedSignupConfigUseCase(new FixedSignupSettings()).execute(),
      ).toEqual({
        appId: 'app-1',
        configId: 'config-1',
        graphVersion: 'v23.0',
      });
      expect(() =>
        new GetEmbeddedSignupConfigUseCase(
          new FixedSignupSettings(null),
        ).execute(),
      ).toThrow(WhatsAppSignupNotConfiguredError);
    });
  });
});
