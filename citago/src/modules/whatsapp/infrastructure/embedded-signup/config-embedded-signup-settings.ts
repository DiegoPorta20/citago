import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../../../config/environment.js';
import {
  EmbeddedSignupSettings,
  type EmbeddedSignupConfig,
} from '../../application/ports/embedded-signup-settings.port.js';

@Injectable()
export class ConfigEmbeddedSignupSettings extends EmbeddedSignupSettings {
  readonly pageBaseUrl: string;
  private readonly settings: EmbeddedSignupConfig | null;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();

    const appId = config.get('WHATSAPP_APP_ID', { infer: true }).trim();
    const secret = config.get('WHATSAPP_APP_SECRET', { infer: true }).trim();
    const configId = config
      .get('WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID', { infer: true })
      .trim();

    this.pageBaseUrl = config
      .get('PUBLIC_BASE_URL', { infer: true })
      .replace(/\/+$/, '');
    this.settings =
      appId && secret && configId
        ? {
            appId,
            configId,
            graphVersion: config.get('WHATSAPP_GRAPH_API_VERSION', {
              infer: true,
            }),
          }
        : null;
  }

  get(): EmbeddedSignupConfig | null {
    return this.settings;
  }
}
