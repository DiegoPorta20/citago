export abstract class SessionPolicy {
  abstract get refreshTokenTtlDays(): number;
}
