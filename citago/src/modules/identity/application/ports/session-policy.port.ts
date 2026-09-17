/**
 * Session lifetimes, resolved from configuration.
 *
 * A port so use cases never read environment variables themselves.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class SessionPolicy {
  abstract get refreshTokenTtlDays(): number;
}
