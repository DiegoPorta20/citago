import { config as loadDotEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import {
  NodeEnvironment,
  validateEnvironment,
} from '../../config/environment.js';
import { buildDataSourceOptions } from '../typeorm.config.js';
import { runDevSeed } from './dev-seed.js';

/**
 * Entry point for `pnpm seed`.
 *
 * Refuses to run against production. Seeding is a development convenience, and
 * a mistake here would write fake businesses into real data.
 */
async function main(): Promise<void> {
  loadDotEnv({ quiet: true });

  const env = validateEnvironment(process.env);

  if (env.NODE_ENV === NodeEnvironment.Production) {
    throw new Error('Refusing to seed: NODE_ENV is production.');
  }

  const dataSource = new DataSource(buildDataSourceOptions(env));
  await dataSource.initialize();

  try {
    const summary = await runDevSeed(dataSource);

    console.log(`Seeded tenant ${summary.tenantId} (${env.DB_DATABASE})`);
    console.log(`  ${summary.serviceCount} services in the catalogue`);
    for (const user of summary.users) {
      console.log(
        `  ${user.role.padEnd(5)} ${user.email} / ${summary.password}`,
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

await main();
