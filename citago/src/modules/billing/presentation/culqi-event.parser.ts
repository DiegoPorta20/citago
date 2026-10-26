/**
 * Culqi tells us "something about subscription X happened"; we do not trust
 * the payload for anything but X. Everything else is read back from Culqi.
 *
 * `data` arrives as a JSON string in some events and as an object in others.
 * Events that name no subscription (a card, a token, a one-off charge) return
 * `null` and are ignored.
 */
export function subscriptionIdFromEvent(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  let data: unknown = payload.data;

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }

  if (!isRecord(data)) {
    return null;
  }
  if (data.object === 'subscription' && isId(data.id)) {
    return data.id;
  }

  return isId(data.subscription_id) ? data.subscription_id : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{3,64}$/.test(value);
}
