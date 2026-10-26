import type {
  HandoffClaims,
  HandoffPurpose,
  HandoffTokens,
} from '../application/ports/handoff-tokens.port.js';
import { InvalidHandoffTokenError } from '../domain/handoff.errors.js';

const SCHEME = 'Handoff ';

/**
 * Reads `Authorization: Handoff <token>` and verifies it for one purpose.
 * The token travels in a header (never in a URL the server sees), so it stays
 * out of access logs and `Referer`.
 */
export function requireHandoff(
  tokens: HandoffTokens,
  header: string | undefined,
  purpose: HandoffPurpose,
): HandoffClaims {
  const token = header?.startsWith(SCHEME)
    ? header.slice(SCHEME.length).trim()
    : '';
  const claims = token ? tokens.verify(token, purpose) : null;

  if (!claims) {
    throw new InvalidHandoffTokenError();
  }

  return claims;
}
