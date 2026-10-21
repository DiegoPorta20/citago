export abstract class PasswordHasher {
  abstract hash(plainPassword: string): Promise<string>;

  abstract verify(hash: string, plainPassword: string): Promise<boolean>;
}
