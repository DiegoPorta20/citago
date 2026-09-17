/**
 * Source of the current time.
 *
 * Use cases depend on this instead of `new Date()` so that time-dependent
 * business rules (availability, appointment windows) are testable.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class Clock {
  /** Current instant, always in UTC. */
  abstract now(): Date;
}
