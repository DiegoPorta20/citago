import {
  GRACE_DAYS,
  SubscriptionState,
  type Subscription,
} from './subscription.entity.js';

export enum NoticeKind {
  /** The free trial ends within two days. */
  TrialEnding = 'TRIAL_ENDING',
  /** The free trial ended and nothing was paid. */
  TrialEnded = 'TRIAL_ENDED',
  /** The renewal did not go through; the business still works for a few days. */
  PaymentPastDue = 'PAYMENT_PAST_DUE',
  /** The renewal never went through and the grace period is over. */
  SubscriptionLapsed = 'SUBSCRIPTION_LAPSED',
}

export interface Notice {
  readonly kind: NoticeKind;
  /**
   * What the notice is about, so each is sent once: `trial` for the trial's,
   * the paid period's end date for the payment ones (the next period that
   * fails is a new reason to write).
   */
  readonly ref: string;
}

/** How long after the end a "it ended" notice is still worth sending. */
export const NOTICE_LOOKBACK_DAYS = 7;

const TRIAL_ENDING_DAYS = 2;

/**
 * Which email, if any, a subscription calls for right now. Pure: the same
 * subscription at the same instant always gives the same answer, which is what
 * lets the job run as often as it likes.
 */
export function noticeFor(
  subscription: Subscription,
  now: Date,
): Notice | null {
  const state = subscription.stateAt(now);
  const periodEnd = subscription.currentPeriodEnd;

  if (periodEnd === null) {
    if (state === SubscriptionState.Trialing) {
      return subscription.daysLeftAt(now) <= TRIAL_ENDING_DAYS
        ? { kind: NoticeKind.TrialEnding, ref: 'trial' }
        : null;
    }

    return daysSince(subscription.trialEndsAt, now) <= NOTICE_LOOKBACK_DAYS
      ? { kind: NoticeKind.TrialEnded, ref: 'trial' }
      : null;
  }

  // Someone who cancelled knows; they do not need to be told it ended.
  if (!subscription.renews) {
    return null;
  }

  const ref = periodEnd.toISOString().slice(0, 10);

  if (state === SubscriptionState.PastDue) {
    return { kind: NoticeKind.PaymentPastDue, ref };
  }

  return state === SubscriptionState.Expired &&
    daysSince(periodEnd, now) <= GRACE_DAYS + NOTICE_LOOKBACK_DAYS
    ? { kind: NoticeKind.SubscriptionLapsed, ref }
    : null;
}

function daysSince(then: Date, now: Date): number {
  return (now.getTime() - then.getTime()) / (24 * 60 * 60 * 1000);
}
