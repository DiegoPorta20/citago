import { config as loadDotEnv } from 'dotenv';

const result = loadDotEnv({ path: '.env.test', quiet: true });

if (result.error) {
  throw new Error(
    'Missing .env.test. Copy .env.example, point it at the mysql-test container (port 3307) and try again.',
  );
}

process.env.NODE_ENV = 'test';
process.env.SWAGGER_ENABLED = 'false';
