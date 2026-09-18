import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { AppointmentsModule } from './modules/appointments/appointments.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { ConversationsModule } from './modules/conversations/conversations.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { WhatsAppWebhookModule } from './modules/whatsapp/whatsapp-webhook.module.js';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { SharedModule } from './shared/infrastructure/shared.module.js';
import { AllExceptionsFilter } from './shared/presentation/filters/all-exceptions.filter.js';
import { RequestLoggingInterceptor } from './shared/presentation/interceptors/request-logging.interceptor.js';
import { ResponseEnvelopeInterceptor } from './shared/presentation/interceptors/response-envelope.interceptor.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    SharedModule,
    DatabaseModule,
    HealthModule,
    TenantsModule,
    IdentityModule,
    CatalogModule,
    ClientsModule,
    StaffModule,
    AppointmentsModule,
    ConversationsModule,
    WhatsAppModule,
    WhatsAppWebhookModule,
  ],
  providers: [
    // Rate limiting is applied as Express middleware in app.setup.ts, because
    // @nestjs/throttler is still CommonJS and cannot be loaded from the
    // ESM-only @nestjs/common of Nest 12 (see docs/adr/0003-esm-and-jest.md).
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
