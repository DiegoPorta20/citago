import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'citago:isPublic';

/**
 * Opens an endpoint to unauthenticated callers.
 *
 * Authentication is deny-by-default: the guard is global, so forgetting this
 * decorator makes an endpoint private (safe), while a new public endpoint has
 * to say so out loud (visible in review).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
