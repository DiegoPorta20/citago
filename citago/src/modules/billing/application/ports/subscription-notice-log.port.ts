import type { Notice } from '../../domain/notice.js';

export abstract class SubscriptionNoticeLog {
  /**
   * Records that this notice is being sent. `false` means someone already did
   * (another instance, a previous run): do not send it again.
   */
  abstract claim(
    subscriptionId: string,
    notice: Notice,
    now: Date,
  ): Promise<boolean>;

  /** Gives the claim back when sending failed in a way worth retrying. */
  abstract release(subscriptionId: string, notice: Notice): Promise<void>;
}
