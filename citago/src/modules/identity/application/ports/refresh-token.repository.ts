export interface StoredRefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly tokenHash: string;
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

export abstract class RefreshTokenRepository {
  abstract insert(token: NewRefreshToken): Promise<void>;

  abstract findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;

  abstract markRotated(
    id: string,
    replacedById: string,
    rotatedAt: Date,
  ): Promise<void>;

  abstract revokeFamily(familyId: string, revokedAt: Date): Promise<void>;

  abstract deleteExpired(now: Date): Promise<number>;
}
