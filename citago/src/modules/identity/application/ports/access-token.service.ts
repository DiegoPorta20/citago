export interface AccessTokenClaims {
  readonly sub: string;
  readonly tid: string;
  readonly mid: string;
}

export abstract class AccessTokenService {
  abstract issue(claims: AccessTokenClaims): Promise<string>;

  abstract verify(token: string): Promise<AccessTokenClaims | null>;

  abstract get expiresInSeconds(): number;
}
