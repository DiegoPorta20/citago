export interface GeneratedToken {
  readonly value: string;
  readonly hash: string;
}

export abstract class SecureTokenFactory {
  abstract create(): GeneratedToken;

  abstract hash(value: string): string;
}
