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

export enum EmailProvider {
  /** Writes the message to the log. Development and tests. */
  Log = 'log',
  Ses = 'ses',
}

const asBoolean = () =>
  Transform(({ value }) => value === true || value === 'true' || value === '1');

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

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  @MaxLength(64)
  DB_DATABASE: string;

  @asBoolean()
  @IsBoolean()
  DB_LOGGING: boolean = false;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

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

  @asBoolean()
  @IsBoolean()
  DEV_TOOLS_ENABLED: boolean = false;

  @IsOptional()
  @IsString()
  CORS_ORIGINS: string = '';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 120;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  THROTTLE_TTL: number = 60_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT: number = 20;

  @IsBase64()
  @Length(44, 44, {
    message: 'ENCRYPTION_KEY must be 32 bytes encoded in base64',
  })
  ENCRYPTION_KEY: string;

  @IsOptional()
  @IsString()
  WHATSAPP_APP_SECRET: string = '';

  @IsOptional()
  @IsString()
  WHATSAPP_VERIFY_TOKEN: string = '';

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  WHATSAPP_GRAPH_API_URL: string = 'https://graph.facebook.com';

  @Matches(/^v\d+\.\d+$/)
  WHATSAPP_GRAPH_API_VERSION: string = 'v23.0';

  /** Public https origin of this API: the pages Meta and Culqi open are served from it. */
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  PUBLIC_BASE_URL: string = 'http://localhost:3000';

  /** Meta app id and Embedded Signup configuration id (Facebook Login for Business). */
  @IsOptional()
  @IsString()
  WHATSAPP_APP_ID: string = '';

  @IsOptional()
  @IsString()
  WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: string = '';

  @IsEnum(EmailProvider)
  EMAIL_PROVIDER: EmailProvider = EmailProvider.Log;

  /** Sender, e.g. `CitaGo <avisos@citago.pe>`. Must be a verified SES identity. */
  @IsOptional()
  @IsString()
  EMAIL_FROM: string = '';

  @IsString()
  SES_REGION: string = 'us-east-1';

  @IsOptional()
  @IsString()
  CULQI_PUBLIC_KEY: string = '';

  @IsOptional()
  @IsString()
  CULQI_SECRET_KEY: string = '';

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  CULQI_API_URL: string = 'https://api.culqi.com/v2';

  /** Secret path segment of the webhook URL configured in CulqiPanel. */
  @IsOptional()
  @IsString()
  CULQI_WEBHOOK_SECRET: string = '';

  /** Plans are created once in CulqiPanel; these map ours to theirs. */
  @IsOptional()
  @IsString()
  CULQI_PLAN_STARTER_ID: string = '';

  @IsOptional()
  @IsString()
  CULQI_PLAN_PRO_ID: string = '';

  @IsOptional()
  @IsString()
  CULQI_PLAN_BUSINESS_ID: string = '';

  /** Runs the trial/payment reminder job inside this process. */
  @asBoolean()
  @IsBoolean()
  REMINDERS_ENABLED: boolean = false;
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
