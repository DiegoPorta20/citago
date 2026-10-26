/** What the browser page needs to start Meta's Embedded Signup. */
export interface EmbeddedSignupConfig {
  readonly appId: string;
  readonly configId: string;
  readonly graphVersion: string;
}

export abstract class EmbeddedSignupSettings {
  /** `null` until the Meta app id, secret and configuration id are set. */
  abstract get(): EmbeddedSignupConfig | null;

  abstract readonly pageBaseUrl: string;
}
