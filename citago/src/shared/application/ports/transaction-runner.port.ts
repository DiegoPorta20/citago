/**
 * Runs a unit of work atomically.
 *
 * A use case that must change several aggregates together wraps them in
 * `run()`; it never learns which database or ORM is underneath. Nested calls
 * join the outer transaction instead of opening a second one.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class TransactionRunner {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
