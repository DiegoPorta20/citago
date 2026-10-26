import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  NodeEnvironment,
  type EnvironmentVariables,
} from '../../config/environment.js';
import { SendSubscriptionRemindersUseCase } from './application/send-subscription-reminders.use-case.js';

const FIRST_RUN_DELAY_MS = 60 * 1000;
const INTERVAL_MS = 60 * 60 * 1000;

/**
 * Runs the reminders once an hour inside the API process. No queue or cron
 * service: the job is idempotent and claims each notice in the database, so a
 * second instance or a restart cannot double-send. Off unless REMINDERS_ENABLED.
 */
@Injectable()
export class RemindersScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RemindersScheduler.name);
  private readonly enabled: boolean;
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly reminders: SendSubscriptionRemindersUseCase,
  ) {
    this.enabled =
      config.get('REMINDERS_ENABLED', { infer: true }) &&
      config.get('NODE_ENV', { infer: true }) !== NodeEnvironment.Test;
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      return;
    }

    const first = setTimeout(() => void this.tick(), FIRST_RUN_DELAY_MS);
    const every = setInterval(() => void this.tick(), INTERVAL_MS);

    first.unref();
    every.unref();
    this.timers = [first, every];
    this.logger.log('Subscription reminders enabled (hourly).');
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers = [];
  }

  async tick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const summary = await this.reminders.execute();

      if (summary.sent > 0) {
        this.logger.log(
          `Reminders: ${summary.sent} sent, ${summary.examined} subscriptions examined.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Reminder run failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
