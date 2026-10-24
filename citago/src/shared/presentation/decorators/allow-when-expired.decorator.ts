import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_EXPIRED_KEY = 'citago:allowWhenExpired';

/**
 * Lets an endpoint keep working after the free trial ends. Reserved for what a
 * business needs in order to pay and get back in: choosing a plan, switching
 * business. Reads (GET) never need it.
 */
export const AllowWhenExpired = () => SetMetadata(ALLOW_WHEN_EXPIRED_KEY, true);
