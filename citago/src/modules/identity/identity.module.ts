import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import type { EnvironmentVariables } from '../../config/environment.js';
import { TenantsModule } from '../tenants/tenants.module.js';
import { GetCurrentSessionUseCase } from './application/get-current-session/get-current-session.use-case.js';
import { LoginUseCase } from './application/login/login.use-case.js';
import { LogoutUseCase } from './application/logout/logout.use-case.js';
import { AccessTokenService } from './application/ports/access-token.service.js';
import { PasswordHasher } from './application/ports/password-hasher.port.js';
import { RefreshTokenRepository } from './application/ports/refresh-token.repository.js';
import { SecureTokenFactory } from './application/ports/secure-token-factory.port.js';
import { SessionPolicy } from './application/ports/session-policy.port.js';
import { RefreshSessionUseCase } from './application/refresh-session/refresh-session.use-case.js';
import { RegisterBusinessUseCase } from './application/register-business/register-business.use-case.js';
import { SessionIssuer } from './application/session-issuer.js';
import { MembershipRepository } from './domain/membership.repository.js';
import { UserRepository } from './domain/user.repository.js';
import { TypeOrmMembershipRepository } from './infrastructure/persistence/typeorm/typeorm-membership.repository.js';
import { TypeOrmRefreshTokenRepository } from './infrastructure/persistence/typeorm/typeorm-refresh-token.repository.js';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm/typeorm-user.repository.js';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher.js';
import { ConfigSessionPolicy } from './infrastructure/security/config-session-policy.js';
import { CryptoSecureTokenFactory } from './infrastructure/security/crypto-secure-token-factory.js';
import { JwtAccessTokenService } from './infrastructure/security/jwt-access-token.service.js';
import { AuthController } from './presentation/auth.controller.js';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard.js';
import { RolesGuard } from './presentation/guards/roles.guard.js';

/**
 * Accounts, memberships, sessions and the authorization primitives every other
 * module relies on.
 *
 * Depends on `TenantsModule` (a business is created during sign-up and its
 * status is checked on every request); the dependency runs one way only.
 *
 * The two guards are registered here as global guards: declaring them in this
 * module lets them inject identity providers while still protecting the whole
 * API. Order matters — authentication resolves the session, then the role
 * check runs against it.
 */
@Module({
  imports: [
    TenantsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: MembershipRepository, useClass: TypeOrmMembershipRepository },
    {
      provide: RefreshTokenRepository,
      useClass: TypeOrmRefreshTokenRepository,
    },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: AccessTokenService, useClass: JwtAccessTokenService },
    { provide: SecureTokenFactory, useClass: CryptoSecureTokenFactory },
    { provide: SessionPolicy, useClass: ConfigSessionPolicy },

    SessionIssuer,
    RegisterBusinessUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    GetCurrentSessionUseCase,

    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [UserRepository, MembershipRepository],
})
export class IdentityModule {}
