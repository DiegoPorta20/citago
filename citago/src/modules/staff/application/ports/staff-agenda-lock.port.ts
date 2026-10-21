export abstract class StaffAgendaLock {
  abstract acquire(
    tenantId: string,
    staffMemberIds: readonly string[],
  ): Promise<void>;
}
