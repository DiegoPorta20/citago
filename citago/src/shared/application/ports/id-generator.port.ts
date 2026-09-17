/**
 * Generates entity identifiers.
 *
 * Identifiers are created by the application, not by the database, so an entity
 * is fully valid before it is persisted.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class IdGenerator {
  abstract generate(): string;
}
