import { DataSource } from 'typeorm';

import { validateEnvironment } from '../../src/config/environment.js';
import { buildDataSourceOptions } from '../../src/database/typeorm.config.js';

/**
 * Connection used by integration tests, pointing at the disposable test
 * database (`.env.test` → the `mysql-test` container).
 *
 * Migrations are applied on connect, so integration tests always run against
 * the same schema a deploy would produce — which also proves the migrations
 * work from an empty database.
 */
export async function createTestDataSource(): Promise<DataSource> {
  const env = validateEnvironment(process.env);
  const dataSource = new DataSource({
    ...buildDataSourceOptions(env),
    // Expected constraint violations are asserted by the tests themselves,
    // so driver logging would only add noise.
    logging: false,
  });

  await dataSource.initialize();
  await dataSource.runMigrations({ transaction: 'all' });

  return dataSource;
}

/** Order matters: children before parents, because every FK is RESTRICT. */
const TABLES_IN_DELETION_ORDER = [
  'whatsapp_channels',
  'messages',
  'conversations',
  'appointment_status_history',
  'appointments',
  'staff_time_off',
  'staff_schedules',
  'staff_members',
  'clients',
  'services',
  'refresh_tokens',
  'memberships',
  'users',
  'tenants',
] as const;

export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');

  try {
    for (const table of TABLES_IN_DELETION_ORDER) {
      await dataSource.query(`TRUNCATE TABLE \`${table}\``);
    }
  } finally {
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

/**
 * Typed wrapper around raw SQL.
 *
 * TypeORM types `query()` as `any`; the cast is confined to this one place so
 * tests can work with typed rows instead of spreading assertions around.
 */
export async function queryRows<T>(
  dataSource: DataSource,
  sql: string,
  parameters: unknown[] = [],
): Promise<T[]> {
  return dataSource.query(sql, parameters);
}
