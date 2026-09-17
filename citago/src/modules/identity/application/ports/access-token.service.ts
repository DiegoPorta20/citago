/**
 * Claims carried by an access token.
 *
 * Intentionally minimal: identifiers only. The **role is not included** — it is
 * read from the membership on every request, so a role change or a revoked
 * access takes effect immediately instead of when the token expires.
 *
 * Never put a password, an external access token or any secret in here.
 */
export interface AccessTokenClaims {
  /** User id. */
  readonly sub: string;
  /** Tenant id. */
  readonly tid: string;
  /** Membership id: the session is bound to one access grant. */
  readonly mid: string;
}

/**
 * Issues and verifies access tokens.
 *
 * Signing is an infrastructure concern (today JWT/HS256): the use cases only
 * know that a session produces an opaque, verifiable string.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class AccessTokenService {
  abstract issue(claims: AccessTokenClaims): Promise<string>;

  /** Returns null for anything invalid: bad signature, expired, malformed. */
  abstract verify(token: string): Promise<AccessTokenClaims | null>;

  /** Lifetime in seconds, so the API can tell the client when to refresh. */
  abstract get expiresInSeconds(): number;
}
