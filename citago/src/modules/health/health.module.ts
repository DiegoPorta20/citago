import { Module } from '@nestjs/common';

import { HealthController } from './presentation/health.controller.js';

/**
 * Operational endpoint only: no domain, no application layer.
 * The architecture stays proportional to the problem.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
