import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBase64,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

const asBoolean = () =>
  Transform(({ value }) => value === true || value === 'true' || value === '1');

/**
 * Every environment-dependent value the application needs.
 *
 * The application must fail at boot when one of these is missing or invalid:
 * a misconfigured service that starts is worse than one that refuses to.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @MaxLength(255)
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 3306;

  @IsString()
  @MaxLength(255)
  DB_USERNAME: string;

  /** May be empty for a local database without a password. */
  @IsString()
  DB_PASSWORD: string;

  @IsString()
  @MaxLength(64)
  DB_DATABASE: string;

  /** Logs every SQL statement. Useful in development, noisy anywhere else. */
  @asBoolean()
  @IsBoolean()
  DB_LOGGING: boolean = false;

  /** Signing key for access tokens. Must be long enough to resist guessing. */
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  /** Access token lifetime. Short by design: revocation relies on it. */
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS: number = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS: number = 30;

  @asBoolean()
  @IsBoolean()
  SWAGGER_ENABLED: boolean = true;

  /**
   * Development-only endpoints, such as the inbound message simulator.
   * Off by default: forgetting to set it can never expose them.
   */
  @asBoolean()
  @IsBoolean()
  DEV_TOOLS_ENABLED: boolean = false;

  /**
   * Comma-separated list of allowed browser origins. Empty disables CORS,
   * which is the correct default: the client is a native application.
   */
  @IsOptional()
  @IsString()
  CORS_ORIGINS: string = '';

  /** Requests allowed per window, per IP. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 120;

  /** Rate limit window in milliseconds. */
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  THROTTLE_TTL: number = 60_000;

  /**
   * Requests allowed per window on the authentication endpoints, per IP.
   * Much stricter than the global limit: this is the credential-stuffing door.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT: number = 20;

  /**
   * Key for encrypting secrets at rest (WhatsApp access tokens): 32 random
   * bytes, base64-encoded. Losing it makes stored tokens unreadable; leaking it
   * exposes them. Keep it out of the database backups' reach.
   */
  @IsBase64()
  @Length(44, 44, {
    message: 'ENCRYPTION_KEY must be 32 bytes encoded in base64',
  })
  ENCRYPTION_KEY: string;

  /**
   * Meta app secret. Verifies the X-Hub-Signature-256 of every webhook.
   * Empty disables the webhook: it rejects everything (fails closed).
   */
  @IsOptional()
  @IsString()
  WHATSAPP_APP_SECRET: string = '';

  /** Shared secret Meta echoes when subscribing the webhook. Empty disables it. */
  @IsOptional()
  @IsString()
  WHATSAPP_VERIFY_TOKEN: string = '';

  /** Graph API base URL. Overridden in tests with a local fake. */
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  WHATSAPP_GRAPH_API_URL: string = 'https://graph.facebook.com';

  @Matches(/^v\d+\.\d+$/)
  WHATSAPP_GRAPH_API_VERSION: string = 'v23.0';
}

export function validateEnvironment(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    exposeDefaultValues: true,
  });

  const errors = validateSync(parsed, {
    skipMissingProperties: false,
    whitelist: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return parsed;
}
