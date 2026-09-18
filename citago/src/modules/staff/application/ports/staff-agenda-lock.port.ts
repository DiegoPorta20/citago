/**
 * Serializes changes to staff members' agendas.
 *
 * Checking "is this time free?" and then inserting is not safe on its own: two
 * requests for the same 10:00 slot can both read "free" before either writes.
 * Taking this lock first makes the second request wait until the first has
 * committed, so it sees the first booking and is rejected (rule AP-5).
 *
 * Must be called inside a transaction; the lock is released when it ends.
 * Several staff members are locked in a fixed order, so two requests moving
 * appointments between the same two barbers cannot deadlock each other.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class StaffAgendaLock {
  abstract acquire(
    tenantId: string,
    staffMemberIds: readonly string[],
  ): Promise<void>;
}
