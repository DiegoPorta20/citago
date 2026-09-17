import { Email, InvalidEmailError } from './email.js';

describe('Email', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(Email.create('  Carlos@Barberia.PE  ').value).toBe(
      'carlos@barberia.pe',
    );
  });

  it('treats addresses differing only in case as the same', () => {
    // This is what stops `Ana@demo.local` from becoming a second account.
    expect(
      Email.create('ANA@demo.local').equals(Email.create('ana@demo.local')),
    ).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['no at sign', 'carlos.barberia.pe'],
    ['no domain', 'carlos@'],
    ['no local part', '@barberia.pe'],
    ['domain without dot', 'carlos@barberia'],
    ['with spaces', 'car los@barberia.pe'],
    ['double at', 'carlos@@barberia.pe'],
  ])('rejects an address with %s', (_case, value) => {
    expect(() => Email.create(value)).toThrow(InvalidEmailError);
  });

  it('rejects an address longer than the column allows', () => {
    const tooLong = `${'a'.repeat(160)}@demo.local`;

    expect(() => Email.create(tooLong)).toThrow(InvalidEmailError);
  });

  it('never echoes the offending value in the error', () => {
    try {
      Email.create('not-an-email');
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as InvalidEmailError).message).not.toContain(
        'not-an-email',
      );
    }
  });
});
