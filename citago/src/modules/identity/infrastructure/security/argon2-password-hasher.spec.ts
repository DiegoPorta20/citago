import { Argon2PasswordHasher } from './argon2-password-hasher.js';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();
  const password = 'unaClaveSegura1';

  it('produces an argon2id hash that does not contain the password', async () => {
    const hash = await hasher.hash(password);

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(password);
  });

  it('salts every hash, so the same password never produces the same digest', async () => {
    const [first, second] = await Promise.all([
      hasher.hash(password),
      hasher.hash(password),
    ]);

    expect(first).not.toBe(second);
  });

  it('accepts the right password and rejects a wrong one', async () => {
    const hash = await hasher.hash(password);

    await expect(hasher.verify(hash, password)).resolves.toBe(true);
    await expect(hasher.verify(hash, 'otraClave123')).resolves.toBe(false);
  });

  it('treats an unreadable hash as a wrong password instead of failing', async () => {
    // A legacy or corrupted value must produce 401, not 500.
    await expect(hasher.verify('not-a-hash', password)).resolves.toBe(false);
  });
});
