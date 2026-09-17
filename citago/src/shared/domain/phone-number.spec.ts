import { InvalidPhoneNumberError, PhoneNumber } from './phone-number.js';

describe('PhoneNumber', () => {
  describe('normalization', () => {
    it.each([
      ['a local number', '999999999'],
      ['with spaces', '999 999 999'],
      ['with the country prefix', '+51999999999'],
      ['with prefix and spaces', '+51 999 999 999'],
      ['with dashes', '999-999-999'],
      ['with a national prefix in parentheses', '(999) 999 999'],
    ])('resolves %s to the same E.164 value', (_case, raw) => {
      // All of these are the same person; anything else duplicates customers.
      expect(PhoneNumber.create(raw, 'PE').value).toBe('+51999999999');
    });

    it('keeps an explicit foreign prefix over the tenant country', () => {
      const spanish = PhoneNumber.create('+34 600 000 000', 'PE');

      expect(spanish.value).toBe('+34600000000');
      expect(spanish.country).toBe('ES');
    });

    it('uses the tenant country for numbers typed without a prefix', () => {
      expect(PhoneNumber.create('11 2345-6789', 'AR').value).toBe(
        '+541123456789',
      );
    });

    it('reports the country it resolved to', () => {
      expect(PhoneNumber.create('999999999', 'PE').country).toBe('PE');
    });
  });

  describe('validation', () => {
    it.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['too short for its country', '123'],
      ['letters', 'no tengo'],
      ['a plausible-looking but impossible number', '+51000000000'],
    ])('rejects %s', (_case, raw) => {
      expect(() => PhoneNumber.create(raw, 'PE')).toThrow(
        InvalidPhoneNumberError,
      );
    });

    it('rejects an unknown default country instead of guessing', () => {
      expect(() => PhoneNumber.create('999999999', 'XX')).toThrow(
        InvalidPhoneNumberError,
      );
    });

    it('never echoes the number in the error, because it is personal data', () => {
      try {
        PhoneNumber.create('123', 'PE');
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as InvalidPhoneNumberError).message).not.toContain('123');
        expect((error as InvalidPhoneNumberError).details).toBeUndefined();
      }
    });
  });

  describe('stored numbers', () => {
    it('rebuilds a stored value without re-validating it', () => {
      // Country phone plans change; a stored customer must stay readable.
      expect(PhoneNumber.fromE164('+51999999999').value).toBe('+51999999999');
    });

    it('compares by value', () => {
      expect(
        PhoneNumber.create('999 999 999', 'PE').equals(
          PhoneNumber.fromE164('+51999999999'),
        ),
      ).toBe(true);
    });
  });
});
