'use strict';

const { BASE_DOMAIN } = require('./config');

const BASE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;
         min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
    .card{text-align:center;max-width:480px}
    .code{font-size:5rem;font-weight:700;color:#38bdf8;line-height:1}
    .title{font-size:1.4rem;margin:.75rem 0 .5rem;color:#f1f5f9}
    .msg{color:#94a3b8;line-height:1.6;font-size:.95rem}
    code{background:#1e293b;padding:.15rem .45rem;border-radius:.3rem;font-family:monospace;font-size:.9em}
    .hint{margin-top:1.5rem;color:#64748b;font-size:.85rem}
    a{color:#38bdf8;text-decoration:none}
  </style>
  <title>{{TITLE}} — {{DOMAIN}}</title>
</head>
<body>
  <div class="card">
    <div class="code">{{CODE}}</div>
    <div class="title">{{TITLE}}</div>
    <p class="msg">{{MSG}}</p>
    <p class="hint">{{HINT}}</p>
  </div>
</body>
</html>`;

function render(code, title, msg, hint) {
  return BASE
    .replace(/\{\{CODE\}\}/g,   code)
    .replace(/\{\{TITLE\}\}/g,  title)
    .replace(/\{\{MSG\}\}/g,    msg)
    .replace(/\{\{HINT\}\}/g,   hint)
    .replace(/\{\{DOMAIN\}\}/g, BASE_DOMAIN);
}

function noTunnelPage(subdomain) {
  return render(
    '502',
    'Tunnel not found',
    `No active tunnel for <code>${subdomain}.${BASE_DOMAIN}</code>.`,
    `Start one with <code>hostmargin tunnel &lt;port&gt;</code> — or <a href="https://${BASE_DOMAIN}">learn more</a>.`
  );
}

function rateLimitPage() {
  return render(
    '429',
    'Too many requests',
    'You\'re sending requests too fast.',
    'Please slow down and try again in a moment.'
  );
}

function timeoutPage() {
  return render(
    '504',
    'Gateway timeout',
    'Your local server didn\'t respond in time.',
    'Make sure your app is running and not blocked.'
  );
}

function bodyTooLargePage() {
  return render(
    '413',
    'Payload too large',
    'The request body exceeds the tunnel size limit.',
    ''
  );
}

module.exports = { noTunnelPage, rateLimitPage, timeoutPage, bodyTooLargePage };
