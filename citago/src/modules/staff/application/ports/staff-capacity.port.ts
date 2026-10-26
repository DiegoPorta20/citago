/**
 * How many active professionals a business may have. Staff defines the port
 * and billing implements it, because the answer depends on the plan: staff
 * never learns what a plan is.
 */
export abstract class StaffCapacity {
  /**
   * Throws if the business cannot have one more active professional.
   * `currentActive` is how many it has now.
   */
  abstract assertCanAddOne(
    tenantId: string,
    currentActive: number,
  ): Promise<void>;
}
