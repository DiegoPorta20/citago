import { WhatsAppChannel } from './whatsapp-channel.entity.js';
import { InvalidWhatsAppChannelDataError } from './whatsapp.errors.js';

const now = new Date('2026-09-18T12:00:00.000Z');
const connection = {
  id: 'channel-1',
  tenantId: 'tenant-1',
  phoneNumberId: '106540352242922',
  wabaId: '102290129340398',
  displayPhoneNumber: ' +51 1 555 0000 ',
  verifiedName: 'Barbería Demo',
  encryptedAccessToken: Buffer.from([1, 2, 3]),
};

describe('WhatsAppChannel', () => {
  it('connects a number', () => {
    const snapshot = WhatsAppChannel.connect(connection, now).toSnapshot();

    expect(snapshot).toMatchObject({
      phoneNumberId: '106540352242922',
      displayPhoneNumber: '+51 1 555 0000',
      connectedAt: now,
    });
  });

  it.each(['', 'abc', '123 456', '../1', '1'.repeat(33)])(
    'rejects the phone number id %p',
    (phoneNumberId) => {
      expect(() =>
        WhatsAppChannel.connect({ ...connection, phoneNumberId }, now),
      ).toThrow(InvalidWhatsAppChannelDataError);
    },
  );

  it('rejects a non-numeric WABA id and treats blank as none', () => {
    expect(() =>
      WhatsAppChannel.connect({ ...connection, wabaId: 'x' }, now),
    ).toThrow(InvalidWhatsAppChannelDataError);
    expect(
      WhatsAppChannel.connect({ ...connection, wabaId: ' ' }, now).toSnapshot()
        .wabaId,
    ).toBeNull();
  });

  it('replaces the connection on reconnect, keeping its identity', () => {
    const channel = WhatsAppChannel.connect(connection, now);
    const later = new Date('2026-09-19T12:00:00.000Z');

    channel.reconnect(
      {
        phoneNumberId: '999',
        displayPhoneNumber: '+51 1 555 9999',
        encryptedAccessToken: Buffer.from([9]),
      },
      later,
    );

    expect(channel.toSnapshot()).toMatchObject({
      id: 'channel-1',
      tenantId: 'tenant-1',
      phoneNumberId: '999',
      wabaId: null,
      connectedAt: later,
      createdAt: now,
    });
  });

  it('binds the token to the business and the number', () => {
    expect(WhatsAppChannel.tokenContext('t1', '123')).not.toBe(
      WhatsAppChannel.tokenContext('t2', '123'),
    );
    expect(WhatsAppChannel.tokenContext('t1', '123')).not.toBe(
      WhatsAppChannel.tokenContext('t1', '124'),
    );
  });
});
