import { config as loadDotEnv } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';

import { validateEnvironment } from '../config/environment.js';
import { MIGRATIONS } from './migrations/index.js';
import { ORM_ENTITIES } from './orm-entities.js';

export interface DatabaseEnvironment {
  readonly DB_HOST: string;
  readonly DB_PORT: number;
  readonly DB_USERNAME: string;
  readonly DB_PASSWORD: string;
  readonly DB_DATABASE: string;
  readonly DB_LOGGING: boolean;
}

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

    synchronize: false,
    migrationsRun: false,

    timezone: 'Z',
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: true,

    logging: env.DB_LOGGING ? 'all' : ['error', 'warn', 'migration'],
    entities: ORM_ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',
  };
}

loadDotEnv();

export default new DataSource(
  buildDataSourceOptions(validateEnvironment(process.env)),
);
