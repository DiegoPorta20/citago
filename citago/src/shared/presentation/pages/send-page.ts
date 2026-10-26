import type { Response } from 'express';

export interface PageSecurity {
  /** Extra origins each directive may use, on top of this server ('self'). */
  readonly scripts?: readonly string[];
  readonly connections?: readonly string[];
  readonly frames?: readonly string[];
  readonly images?: readonly string[];
}

/**
 * Serves one of the few pages this API hosts for third parties (Meta's sign-up,
 * Culqi's checkout). They need looser rules than the JSON API's helmet
 * defaults, but only as much as each one needs: scripts come from this server
 * plus the one provider, nothing is inline, and the page can't be framed.
 */
export function sendPage(
  response: Response,
  kind: 'html' | 'js' | 'css',
  body: string,
  security: PageSecurity = {},
): void {
  const list = (extra: readonly string[] | undefined) =>
    ["'self'", ...(extra ?? [])].join(' ');

  response
    .status(200)
    .setHeader(
      'Content-Type',
      kind === 'html'
        ? 'text/html; charset=utf-8'
        : kind === 'js'
          ? 'text/javascript; charset=utf-8'
          : 'text/css; charset=utf-8',
    )
    .setHeader(
      'Content-Security-Policy',
      [
        "default-src 'none'",
        `script-src ${list(security.scripts)}`,
        "style-src 'self'",
        `connect-src ${list(security.connections)}`,
        `frame-src ${(security.frames ?? ["'none'"]).join(' ')}`,
        `img-src ${list(security.images)} data:`,
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    )
    // Helmet's default (same-origin) would cut the link between this page and
    // the provider's login popup, which is how the result comes back.
    .setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
    .setHeader('Referrer-Policy', 'no-referrer')
    .setHeader('Cache-Control', 'no-store')
    .send(body);
}
