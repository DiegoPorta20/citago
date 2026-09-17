import { config as loadDotEnv } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';

import { validateEnvironment } from '../config/environment.js';
import { MIGRATIONS } from './migrations/index.js';
import { ORM_ENTITIES } from './orm-entities.js';

/** The subset of the environment the database connection depends on. */
export interface DatabaseEnvironment {
  readonly DB_HOST: string;
  readonly DB_PORT: number;
  readonly DB_USERNAME: string;
  readonly DB_PASSWORD: string;
  readonly DB_DATABASE: string;
  readonly DB_LOGGING: boolean;
}

/**
 * Single source of truth for the database connection.
 *
 * Used by the Nest application (through DatabaseModule) and by the TypeORM CLI
 * (through the default export below), so both always agree.
 */
export function buildDataSourceOptions(
  env: DatabaseEnvironment,
): DataSourceOptions {
  return {
    type: 'mysql',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,

    // Never true, in any environment: it would let the ORM rewrite the schema.
    // All schema changes go through versioned migrations.
    synchronize: false,
    // Migrations are an explicit deploy step, never a side effect of booting.
    migrationsRun: false,

    // Timestamps are stored and read as UTC. Without this the driver would
    // shift DATETIME values to the server's local time zone.
    timezone: 'Z',
    charset: 'utf8mb4',
    // BIGINT and DECIMAL arrive as strings, so money never touches a JS number.
    supportBigNumbers: true,
    bigNumberStrings: true,

    logging: env.DB_LOGGING ? 'all' : ['error', 'warn', 'migration'],
    // Registered explicitly rather than by glob: see orm-entities.ts.
    entities: ORM_ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',
  };
}

/** Entry point for the TypeORM CLI (`pnpm typeorm ...`). */
loadDotEnv();

export default new DataSource(
  buildDataSourceOptions(validateEnvironment(process.env)),
);
