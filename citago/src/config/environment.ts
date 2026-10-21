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
