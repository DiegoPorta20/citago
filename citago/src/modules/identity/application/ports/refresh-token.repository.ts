/**
 * A refresh token as stored.
 *
 * Only the hash is persisted, so a database dump hands out no sessions.
 * This is infrastructure state, not a business concept, which is why it lives
 * in the application layer instead of the domain.
 */
export interface StoredRefreshToken {
  readonly id: string;
  readonly userId: string;
  /**
   * Denormalized on purpose: it lets the refresh flow look the membership up
   * with its tenant, so MembershipRepository keeps every read tenant-scoped.
   */
  readonly tenantId: string;
  readonly membershipId: string;
  readonly tokenHash: string;
  /** Rotation chain: every token descended from one sign-in shares it. */
  readonly familyId: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly replacedById: string | null;
  readonly createdAt: Date;
}

export interface NewRefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/**
 * Persistence contract for refresh tokens.
 *
 * `findByHash` is the second documented exception to tenant scoping
 * (see docs/adr/0004-tenant-isolation.md): the tenant is unknown until the
 * token is resolved, and the token itself identifies the session.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class RefreshTokenRepository {
  abstract insert(token: NewRefreshToken): Promise<void>;

  abstract findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;

  /** Marks one token as rotated, pointing at its successor. */
  abstract markRotated(
    id: string,
    replacedById: string,
    rotatedAt: Date,
  ): Promise<void>;

  /**
   * Revokes every token of a family.
   *
   * Used on sign-out and, critically, when a rotated token is presented again:
   * that means it leaked, so the whole chain dies.
   */
  abstract revokeFamily(familyId: string, revokedAt: Date): Promise<void>;

  /** Housekeeping for expired rows; safe to call at any time. */
  abstract deleteExpired(now: Date): Promise<number>;
}
