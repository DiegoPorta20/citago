import { config as loadDotEnv } from 'dotenv';

/**
 * End-to-end tests talk to the real test database.
 *
 * Only `.env.test` is loaded — never `.env` — so a test run can never touch
 * the development database.
 */
const result = loadDotEnv({ path: '.env.test', quiet: true });

if (result.error) {
  throw new Error(
    'Missing .env.test. Copy .env.example, point it at the mysql-test container (port 3307) and try again.',
  );
}

process.env.NODE_ENV = 'test';
process.env.SWAGGER_ENABLED = 'false';
