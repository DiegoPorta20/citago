export interface GeneratedToken {
  /** The value handed to the client. Never stored. */
  readonly value: string;
  /** What gets persisted. */
  readonly hash: string;
}

/**
 * Creates and hashes opaque refresh tokens.
 *
 * A port rather than a direct call to `node:crypto` so use cases stay
 * deterministic in tests, and so the hashing choice is one file to change.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class SecureTokenFactory {
  abstract create(): GeneratedToken;

  abstract hash(value: string): string;
}
