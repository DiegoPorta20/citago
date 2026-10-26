/**
 * A short-lived, purpose-bound token that lets an external web page (Meta's
 * Embedded Signup, Culqi's checkout) act for one business without ever seeing
 * a session. The app asks for it, opens the page in the browser with the token
 * in the URL fragment, and the page presents it back to the API.
 *
 * It is not an access token: the JWT guard never accepts it, and it only works
 * for the purpose it was issued for.
 */
export type HandoffPurpose = 'whatsapp-signup' | 'checkout';

export interface HandoffClaims {
  readonly tenantId: string;
  readonly userId: string;
  readonly purpose: HandoffPurpose;
  /** What the link is about, e.g. the plan to pay for. Signed with the rest. */
  readonly subject?: string;
}

export abstract class HandoffTokens {
  abstract issue(claims: HandoffClaims): string;

  /** `null` when the token is malformed, forged, expired or for another purpose. */
  abstract verify(token: string, purpose: HandoffPurpose): HandoffClaims | null;

  abstract readonly ttlSeconds: number;
}
