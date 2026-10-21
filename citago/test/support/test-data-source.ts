import { DataSource } from 'typeorm';

import { validateEnvironment } from '../../src/config/environment.js';
import { buildDataSourceOptions } from '../../src/database/typeorm.config.js';

export async function createTestDataSource(): Promise<DataSource> {
  const env = validateEnvironment(process.env);
  const dataSource = new DataSource({
    ...buildDataSourceOptions(env),
    logging: false,
  });

  await dataSource.initialize();
  await dataSource.runMigrations({ transaction: 'all' });

  return dataSource;
}

const TABLES_IN_DELETION_ORDER = [
  'whatsapp_channels',
  'messages',
  'conversations',
  'sale_lines',
  'sales',
  'appointment_status_history',
  'appointments',
  'staff_time_off',
  'staff_schedules',
  'staff_members',
  'clients',
  'services',
  'business_hours',
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

export async function queryRows<T>(
  dataSource: DataSource,
  sql: string,
  parameters: unknown[] = [],
): Promise<T[]> {
  return dataSource.query(sql, parameters);
}
