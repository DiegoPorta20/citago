import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { EmailDeliveryError } from '../../application/ports/email-sender.port.js';
import { SesEmailSender } from './ses-email-sender.js';

interface Captured {
  method?: string;
  url?: string;
  body?: Record<string, unknown>;
}

describe('SesEmailSender', () => {
  let server: Server;
  let endpoint: string;
  let captured: Captured;
  let reply: {
    status: number;
    body: unknown;
    headers?: Record<string, string>;
  };

  beforeAll(async () => {
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];

      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        captured = {
          method: request.method,
          url: request.url,
          body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'),
        };
        response.writeHead(reply.status, {
          'Content-Type': 'application/json',
          ...reply.headers,
        });
        response.end(JSON.stringify(reply.body));
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  });

  beforeEach(() => {
    captured = {};
    reply = { status: 200, body: { MessageId: 'ses-1' } };
  });

  const sender = () =>
    new SesEmailSender('CitaGo <avisos@citago.pe>', 'us-east-1', {
      endpoint,
      credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'secret' },
      maxAttempts: 1,
    });

  it('posts the message to the SES v2 send-email endpoint', async () => {
    await sender().send({
      to: 'dueno@barberia.pe',
      subject: 'Tu prueba termina pronto',
      text: 'Hola',
      html: '<p>Hola</p>',
    });

    expect(captured.method).toBe('POST');
    expect(captured.url).toBe('/v2/email/outbound-emails');
    expect(captured.body).toMatchObject({
      FromEmailAddress: 'CitaGo <avisos@citago.pe>',
      Destination: { ToAddresses: ['dueno@barberia.pe'] },
      Content: {
        Simple: {
          Subject: { Data: 'Tu prueba termina pronto', Charset: 'UTF-8' },
          Body: {
            Text: { Data: 'Hola', Charset: 'UTF-8' },
            Html: { Data: '<p>Hola</p>', Charset: 'UTF-8' },
          },
        },
      },
    });
  });

  it('sends text only when there is no html', async () => {
    await sender().send({ to: 'a@b.pe', subject: 'S', text: 'T' });

    const simple = (captured.body?.Content as { Simple: { Body: object } })
      .Simple;

    expect(simple.Body).not.toHaveProperty('Html');
  });

  it('reports a rejected message as a permanent failure', async () => {
    reply = {
      status: 400,
      body: { message: 'Email address is not verified.' },
      headers: { 'x-amzn-errortype': 'MessageRejected' },
    };

    const failure = await sender()
      .send({ to: 'a@b.pe', subject: 'S', text: 'T' })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(EmailDeliveryError);
    expect((failure as EmailDeliveryError).retryable).toBe(false);
  });

  it('reports an SES outage as retryable', async () => {
    reply = { status: 503, body: { message: 'Service unavailable' } };

    const failure = await sender()
      .send({ to: 'a@b.pe', subject: 'S', text: 'T' })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(EmailDeliveryError);
    expect((failure as EmailDeliveryError).retryable).toBe(true);
  });

  it('refuses to start without a sender address', () => {
    expect(() => new SesEmailSender('  ', 'us-east-1')).toThrow(/EMAIL_FROM/);
  });
});
