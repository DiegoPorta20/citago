import { NodeEnvironment, validateEnvironment } from './environment.js';

const validEnv = {
  DB_HOST: '127.0.0.1',
  DB_USERNAME: 'root',
  DB_PASSWORD: 'secret',
  DB_DATABASE: 'citago',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
};

describe('validateEnvironment', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnvironment({ ...validEnv });

    expect(env.NODE_ENV).toBe(NodeEnvironment.Development);
    expect(env.PORT).toBe(3000);
    expect(env.DB_PORT).toBe(3306);
    expect(env.DB_LOGGING).toBe(false);
    expect(env.THROTTLE_LIMIT).toBe(120);
  });

  it('coerces numeric and boolean strings coming from the process environment', () => {
    const env = validateEnvironment({
      ...validEnv,
      PORT: '8080',
      DB_PORT: '3307',
      DB_LOGGING: 'true',
      SWAGGER_ENABLED: 'false',
    });

    expect(env.PORT).toBe(8080);
    expect(env.DB_PORT).toBe(3307);
    expect(env.DB_LOGGING).toBe(true);
    expect(env.SWAGGER_ENABLED).toBe(false);
  });

  it('accepts an empty database password for local development', () => {
    expect(() =>
      validateEnvironment({ ...validEnv, DB_PASSWORD: '' }),
    ).not.toThrow();
  });

  it('fails fast when a required variable is missing', () => {
    const { DB_HOST: _omitted, ...withoutHost } = validEnv;

    expect(() => validateEnvironment(withoutHost)).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects an out-of-range port instead of silently starting', () => {
    expect(() => validateEnvironment({ ...validEnv, PORT: '70000' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects a JWT secret that is too short to resist guessing', () => {
    expect(() =>
      validateEnvironment({ ...validEnv, JWT_ACCESS_SECRET: 'too-short' }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('rejects an access token lifetime outside the accepted range', () => {
    expect(() =>
      validateEnvironment({ ...validEnv, JWT_ACCESS_TTL_SECONDS: '86400' }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('defaults the session lifetimes', () => {
    const env = validateEnvironment({ ...validEnv });

    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.AUTH_THROTTLE_LIMIT).toBe(20);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() =>
      validateEnvironment({ ...validEnv, NODE_ENV: 'staging' }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('ignores unrelated process variables', () => {
    expect(() =>
      validateEnvironment({ ...validEnv, PATH: '/usr/bin', HOME: '/home/dev' }),
    ).not.toThrow();
  });
});
