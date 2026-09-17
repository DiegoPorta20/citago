/**
 * Hashes and verifies passwords.
 *
 * The port exists so the hashing algorithm stays an infrastructure detail:
 * swapping argon2 for something else must not touch a single use case.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class PasswordHasher {
  abstract hash(plainPassword: string): Promise<string>;

  abstract verify(hash: string, plainPassword: string): Promise<boolean>;
}
