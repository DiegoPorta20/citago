/**
 * The page Meta requires for Embedded Signup: it hosts the Facebook JS SDK,
 * which opens Meta's flow in a popup and hands back a one-time `code` plus the
 * ids of the account and number the customer created. Both halves go to our
 * API, which finishes the onboarding server-side.
 *
 * The app opens it with a short-lived token in the URL *fragment*, so the
 * token never reaches a server log. The script removes it from the address bar
 * at once and sends it only in an Authorization header.
 */
export const WHATSAPP_SIGNUP_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Conectar WhatsApp · CitaGo</title>
<link rel="stylesheet" href="pages.css">
</head>
<body>
<main>
<h1>Conectar tu WhatsApp</h1>
<p>Inicia sesión con Facebook y elige o crea la cuenta de WhatsApp Business de tu negocio. Meta te pedirá verificar tu número con un código por SMS o llamada.</p>
<button id="start" type="button" disabled>Continuar con Facebook</button>
<p id="status" role="status" aria-live="polite">Preparando…</p>
<p class="hint">CitaGo solo recibe permiso para leer y responder los mensajes de este número. Puedes desconectarlo cuando quieras desde la app.</p>
</main>
<script src="whatsapp-signup.js" defer></script>
</body>
</html>
`;

export const WHATSAPP_SIGNUP_JS = `(function () {
  'use strict';

  var params = new URLSearchParams(window.location.hash.slice(1));
  var token = params.get('t');
  window.history.replaceState(null, '', window.location.pathname);

  var button = document.getElementById('start');
  var status = document.getElementById('status');
  var api = window.location.pathname.replace(/\\/pages\\/[^/]*$/, '');
  var state = { config: null, code: null, session: null, submitting: false };

  var MESSAGES = {
    INVALID_HANDOFF_TOKEN: 'El enlace venció. Vuelve a la app y toca “Conectar con WhatsApp” otra vez.',
    WHATSAPP_SIGNUP_REJECTED: 'Meta no aceptó el registro. Inténtalo de nuevo desde la app.',
    WHATSAPP_NUMBER_IN_USE: 'Ese número ya está conectado a otro negocio de CitaGo.',
    WHATSAPP_UNAVAILABLE: 'No pudimos contactar con WhatsApp. Inténtalo en un momento.',
    WHATSAPP_SIGNUP_NOT_CONFIGURED: 'La conexión automática aún no está activa. Conecta el número manualmente desde la app.'
  };

  function say(kind, text) {
    status.setAttribute('data-state', kind);
    status.textContent = text;
  }

  function isFacebook(origin) {
    try {
      var url = new URL(origin);
      return url.protocol === 'https:' && (url.hostname === 'facebook.com' || url.hostname.slice(-13) === '.facebook.com');
    } catch (error) {
      return false;
    }
  }

  function authHeaders() {
    return { 'Authorization': 'Handoff ' + token, 'Content-Type': 'application/json' };
  }

  function explain(body) {
    return (body && MESSAGES[body.code]) || 'Algo salió mal. Vuelve a la app e inténtalo de nuevo.';
  }

  function fail(text) {
    state.submitting = false;
    state.code = null;
    state.session = null;
    button.disabled = false;
    say('error', text);
  }

  function finish() {
    if (state.submitting || !state.code || !state.session) { return; }
    state.submitting = true;
    button.disabled = true;
    say('', 'Conectando tu número…');

    fetch(api + '/whatsapp/embedded-signup/complete', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        code: state.code,
        phoneNumberId: state.session.phone_number_id,
        wabaId: state.session.waba_id
      })
    }).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (body) {
        if (response.ok) {
          button.hidden = true;
          say('ok', '¡Listo! Tu WhatsApp quedó conectado. Ya puedes volver a CitaGo.');
        } else {
          fail(explain(body));
        }
      });
    }).catch(function () {
      fail('No pudimos conectar con CitaGo. Revisa tu conexión e inténtalo de nuevo.');
    });
  }

  window.addEventListener('message', function (event) {
    if (!isFacebook(event.origin)) { return; }
    var data = event.data;
    try { if (typeof data === 'string') { data = JSON.parse(data); } } catch (error) { return; }
    if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') { return; }

    if (data.event === 'FINISH' && data.data && data.data.phone_number_id && data.data.waba_id) {
      state.session = data.data;
      finish();
    } else if (data.event === 'CANCEL') {
      say('error', 'Cancelaste el registro. Cuando quieras, vuelve a intentarlo.');
      button.disabled = false;
    }
  });

  function launch() {
    button.disabled = true;
    say('', 'Esperando a Meta…');
    window.FB.login(function (response) {
      if (response && response.authResponse && response.authResponse.code) {
        state.code = response.authResponse.code;
        finish();
      } else if (!state.session) {
        button.disabled = false;
        say('error', 'No se completó el inicio de sesión. Puedes intentarlo otra vez.');
      }
    }, {
      config_id: state.config.configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: '', sessionInfoVersion: '3' }
    });
  }

  function loadSdk(config) {
    window.fbAsyncInit = function () {
      window.FB.init({ appId: config.appId, autoLogAppEvents: true, xfbml: false, version: config.graphVersion });
      button.disabled = false;
      say('', '');
    };
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.onerror = function () { say('error', 'No se pudo cargar Facebook. Revisa tu conexión o desactiva bloqueadores.'); };
    document.head.appendChild(script);
  }

  button.addEventListener('click', launch);

  if (!token) {
    say('error', explain({ code: 'INVALID_HANDOFF_TOKEN' }));
    return;
  }

  fetch(api + '/whatsapp/embedded-signup/config', { headers: authHeaders() })
    .then(function (response) {
      return response.json().catch(function () { return null; }).then(function (body) {
        if (!response.ok || !body || !body.data) { throw body || {}; }
        state.config = body.data;
        loadSdk(body.data);
      });
    })
    .catch(function (body) { say('error', explain(body)); });
})();
`;
