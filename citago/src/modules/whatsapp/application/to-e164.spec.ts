import { toE164 } from './process-whatsapp-webhook.use-case.js';

describe('toE164 (WhatsApp id → contact identifier)', () => {
  it.each([
    ['51999999999', '+51999999999'],
    // Mexican mobiles arrive with the legacy "1"; clients are stored without it.
    ['5215512345678', '+525512345678'],
    ['5491112345678', '+5491112345678'],
    // Unknown to the phone metadata: still a usable E.164 identifier.
    ['999000', '+999000'],
  ])('%s → %s', (waId, expected) => {
    expect(toE164(waId)).toBe(expected);
  });
});
