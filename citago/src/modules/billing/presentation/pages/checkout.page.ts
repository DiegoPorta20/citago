/**
 * The card form for subscribing. Culqi's checkout (a script served by Culqi)
 * collects the card and returns a one-time token, so card data never touches
 * this server (PCI scope stays with Culqi). The token goes to our API, which
 * creates the customer, saves the card and starts the monthly charge.
 *
 * Like the WhatsApp page, it arrives with a short-lived token in the URL
 * fragment, removes it from the address bar at once, and sends it only in an
 * Authorization header.
 */
export const CHECKOUT_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Pagar suscripción · CitaGo</title>
<link rel="stylesheet" href="pages.css">
</head>
<body>
<main>
<h1>Activar tu plan</h1>
<p id="summary">Preparando…</p>
<button id="pay" type="button" disabled>Ingresar tarjeta</button>
<p id="status" role="status" aria-live="polite"></p>
<p class="hint">El cobro es mensual y se renueva solo; puedes cancelarlo cuando quieras desde la app. Tu tarjeta la procesa Culqi: CitaGo nunca ve el número.</p>
</main>
<script src="checkout.js" defer></script>
</body>
</html>
`;

export const CHECKOUT_JS = `(function () {
  'use strict';

  var params = new URLSearchParams(window.location.hash.slice(1));
  var token = params.get('t');
  window.history.replaceState(null, '', window.location.pathname);

  var button = document.getElementById('pay');
  var status = document.getElementById('status');
  var summary = document.getElementById('summary');
  var api = window.location.pathname.replace(/\\/pages\\/[^/]*$/, '');
  var state = { checkout: null, submitting: false };

  var MESSAGES = {
    INVALID_HANDOFF_TOKEN: 'El enlace venció. Vuelve a la app y toca “Pagar” otra vez.',
    PAYMENT_DECLINED: 'El banco no aceptó la tarjeta. Prueba con otra o consulta con tu banco.',
    PAYMENT_UNAVAILABLE: 'No pudimos contactar con el servicio de pagos. Inténtalo en un momento.',
    PAYMENTS_NOT_CONFIGURED: 'Los pagos en línea aún no están activos.',
    ALREADY_SUBSCRIBED: 'Ese plan ya está activo. No se te cobró de nuevo.',
    SUBSCRIPTION_NOT_FOUND: 'No encontramos tu suscripción. Vuelve a la app.'
  };

  function say(kind, text) {
    status.setAttribute('data-state', kind);
    status.textContent = text;
  }

  function authHeaders() {
    return { 'Authorization': 'Handoff ' + token, 'Content-Type': 'application/json' };
  }

  function explain(body) {
    return (body && MESSAGES[body.code]) || 'Algo salió mal. Vuelve a la app e inténtalo de nuevo.';
  }

  function money(plan) {
    var symbol = plan.currency === 'PEN' ? 'S/ ' : plan.currency + ' ';
    return symbol + plan.monthlyPrice;
  }

  function pay(card) {
    if (state.submitting) { return; }
    state.submitting = true;
    button.disabled = true;
    say('', 'Procesando el pago…');

    fetch(api + '/billing/checkout/complete', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ tokenId: card.id, email: card.email })
    }).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (body) {
        if (state.checkout && state.checkout.close) { state.checkout.close(); }
        if (response.ok) {
          button.hidden = true;
          say('ok', '¡Listo! Tu plan está activo. Ya puedes volver a CitaGo.');
        } else {
          state.submitting = false;
          button.disabled = false;
          say('error', explain(body));
        }
      });
    }).catch(function () {
      state.submitting = false;
      button.disabled = false;
      say('error', 'No pudimos conectar con CitaGo. Revisa tu conexión e inténtalo de nuevo.');
    });
  }

  function start(config) {
    var checkout = new window.CulqiCheckout(config.publicKey, {
      settings: { title: 'CitaGo', currency: config.plan.currency, amount: 0 },
      options: { lang: 'auto', modal: true, paymentMethods: { tarjeta: true } }
    });

    checkout.culqi = function () {
      if (checkout.token) {
        pay(checkout.token);
      } else if (checkout.error) {
        say('error', (checkout.error && checkout.error.user_message) || 'No se pudo leer la tarjeta. Inténtalo de nuevo.');
      }
    };

    state.checkout = checkout;
    button.disabled = false;
    button.addEventListener('click', function () {
      say('', '');
      checkout.open();
    });
  }

  function loadCulqi(config) {
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://js.culqi.com/checkout-js';
    script.onload = function () { start(config); };
    script.onerror = function () { say('error', 'No se pudo cargar el formulario de pago. Revisa tu conexión o desactiva bloqueadores.'); };
    document.head.appendChild(script);
  }

  if (!token) {
    summary.textContent = '';
    say('error', explain({ code: 'INVALID_HANDOFF_TOKEN' }));
    return;
  }

  fetch(api + '/billing/checkout/config', { headers: authHeaders() })
    .then(function (response) {
      return response.json().catch(function () { return null; }).then(function (body) {
        if (!response.ok || !body || !body.data) { throw body || {}; }
        summary.textContent = 'Plan ' + body.data.plan.name + ' · ' + money(body.data.plan) + ' al mes';
        loadCulqi(body.data);
      });
    })
    .catch(function (body) {
      summary.textContent = '';
      say('error', explain(body));
    });
})();
`;
