import { NoticeKind } from '../domain/notice.js';

export interface NoticeContext {
  readonly businessName: string;
  readonly daysLeft: number;
}

export interface RenderedNotice {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const WHERE = 'En la app: Más → Plan y suscripción.';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function days(count: number): string {
  return count === 1 ? '1 día' : `${count} días`;
}

/**
 * Plain, short, in Spanish, and honest about what happens to the data: it is
 * never deleted, only read-only. The business name is the only thing that
 * comes from outside, and it is escaped in the HTML.
 */
export function renderNotice(
  kind: NoticeKind,
  context: NoticeContext,
): RenderedNotice {
  const { businessName } = context;
  let subject: string;
  let paragraphs: string[];

  switch (kind) {
    case NoticeKind.TrialEnding:
      subject = `Tu prueba gratis de CitaGo termina en ${days(Math.max(context.daysLeft, 1))}`;
      paragraphs = [
        `La prueba gratis de ${businessName} está por terminar.`,
        'Para seguir haciendo cambios sin interrupciones, elige y activa un plan. Tus citas, clientes y ventas no se pierden en ningún caso.',
        WHERE,
      ];
      break;
    case NoticeKind.TrialEnded:
      subject = 'Terminó tu prueba gratis de CitaGo';
      paragraphs = [
        `La prueba gratis de ${businessName} terminó.`,
        'Puedes seguir viendo tu agenda, clientes y ventas, pero no hacer cambios hasta activar un plan.',
        WHERE,
      ];
      break;
    case NoticeKind.PaymentPastDue:
      subject = 'No pudimos cobrar tu suscripción de CitaGo';
      paragraphs = [
        `No pudimos cobrar la renovación de ${businessName}.`,
        'Seguimos intentándolo y tu negocio sigue funcionando unos días más. Revisa que tu tarjeta tenga fondos o actívala con otra.',
        WHERE,
      ];
      break;
    case NoticeKind.SubscriptionLapsed:
      subject = 'Tu suscripción de CitaGo venció';
      paragraphs = [
        `La suscripción de ${businessName} venció porque no pudimos cobrar la renovación.`,
        'Tus datos están a salvo y puedes verlos, pero no hacer cambios hasta volver a activar un plan.',
        WHERE,
      ];
      break;
  }

  return {
    subject,
    text: `Hola,\n\n${paragraphs.join('\n\n')}\n\n— CitaGo`,
    html: `<p>Hola,</p>${paragraphs
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join('')}<p>— CitaGo</p>`,
  };
}
