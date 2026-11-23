'use strict';

// Landing page served on the bare domain (hmrg.xyz / www.hmrg.xyz).
// Self-contained: inline CSS + JS, no external requests except one font file.

const { BASE_DOMAIN } = require('./config');

const DASHBOARD_URL = 'https://expose127.hostmargin.com';

function landingPage({ activeTunnels = 0 } = {}) {
  const D = BASE_DOMAIN;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>expose127 — localhost, made public</title>
<meta name="description" content="Share your localhost with the world in one command. Free, instant HTTPS URLs on ${D}.">
<meta property="og:title" content="expose127 — localhost, made public">
<meta property="og:description" content="One command. A public HTTPS URL for your local app.">
<meta name="theme-color" content="#0a0a0a">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230a0a0a'/%3E%3Cpath d='M10 11l5 5-5 5M17 21h6' stroke='%23fff' stroke-width='2.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#fafafa; --fg:#0a0a0a; --muted:#737373; --faint:#a3a3a3;
    --line:#e5e5e5; --card:#ffffff; --term:#0a0a0a; --term-fg:#e5e5e5;
    --accent:#16a34a;
  }
  @media (prefers-color-scheme: dark){
    :root{
      --bg:#0a0a0a; --fg:#fafafa; --muted:#a3a3a3; --faint:#525252;
      --line:#1f1f1f; --card:#111111; --term:#111111; --term-fg:#e5e5e5;
      --accent:#4ade80;
    }
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-font-smoothing:antialiased}
  body{font-family:Inter,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);
       line-height:1.6;min-height:100vh;display:flex;flex-direction:column}
  a{color:inherit;text-decoration:none}
  .mono{font-family:'JetBrains Mono',ui-monospace,Menlo,monospace}
  .wrap{width:100%;max-width:960px;margin:0 auto;padding:0 24px}

  /* nav */
  nav{display:flex;align-items:center;justify-content:space-between;padding:28px 0}
  .logo{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:-.01em}
  .logo i{width:22px;height:22px;border-radius:6px;background:var(--fg);display:grid;place-items:center}
  .logo i svg{width:14px;height:14px}
  .nav-links{display:flex;gap:28px;font-size:14px;color:var(--muted)}
  .nav-links a:hover{color:var(--fg)}

  /* hero */
  .hero{padding:96px 0 64px;text-align:center}
  .pill{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);
        border:1px solid var(--line);border-radius:999px;padding:5px 14px 5px 10px;margin-bottom:36px}
  .dot{width:7px;height:7px;border-radius:50%;background:var(--accent);position:relative}
  .dot::after{content:"";position:absolute;inset:-4px;border-radius:50%;background:var(--accent);
              opacity:.35;animation:pulse 2s ease-out infinite}
  @keyframes pulse{0%{transform:scale(.5);opacity:.5}100%{transform:scale(1.6);opacity:0}}
  h1{font-size:clamp(40px,7.5vw,76px);font-weight:600;letter-spacing:-.045em;line-height:1.02}
  h1 span{color:var(--faint)}
  .sub{margin:24px auto 0;max-width:520px;font-size:18px;color:var(--muted)}

  /* install */
  .install{margin:44px auto 0;display:inline-flex;align-items:center;gap:14px;
           background:var(--card);border:1px solid var(--line);border-radius:12px;
           padding:14px 14px 14px 20px;font-size:15px}
  .install .prompt{color:var(--faint);user-select:none}
  .copy{border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;
        border-radius:8px;padding:6px 12px;font:500 13px Inter,system-ui,sans-serif;transition:.15s}
  .copy:hover{color:var(--fg);border-color:var(--muted)}
  .copy.ok{color:var(--accent);border-color:var(--accent)}

  /* terminal */
  .term{margin:72px auto 0;max-width:720px;background:var(--term);color:var(--term-fg);
        border-radius:14px;border:1px solid var(--line);text-align:left;overflow:hidden;
        box-shadow:0 30px 80px -30px rgba(0,0,0,.35)}
  .term-bar{display:flex;gap:7px;padding:14px 16px;border-bottom:1px solid #1f1f1f}
  .term-bar b{width:11px;height:11px;border-radius:50%;background:#2a2a2a}
  .term-body{padding:22px 24px 26px;font-size:13.5px;line-height:1.9;min-height:250px;white-space:pre;overflow-x:auto}
  .t-dim{color:#737373} .t-ok{color:#4ade80} .t-url{color:#fff;text-decoration:underline;text-underline-offset:3px;text-decoration-color:#525252}
  .t-get{color:#60a5fa} .t-post{color:#f472b6}
  .caret{display:inline-block;width:8px;height:16px;background:#e5e5e5;vertical-align:-3px;animation:blink 1s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}

  /* features */
  .grid{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);margin-top:120px}
  .f{padding:40px 28px 44px 0}
  .f + .f{padding-left:28px;border-left:1px solid var(--line)}
  .f .n{font-size:12px;color:var(--faint);margin-bottom:18px}
  .f h3{font-size:16px;font-weight:600;letter-spacing:-.01em;margin-bottom:8px}
  .f p{font-size:14.5px;color:var(--muted)}

  /* flow */
  .flow{padding:96px 0;text-align:center;border-top:1px solid var(--line)}
  .eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-bottom:36px}
  .chain{display:flex;align-items:center;justify-content:center;gap:0;flex-wrap:wrap}
  .node{font-size:14px;padding:10px 18px;border:1px solid var(--line);border-radius:10px;background:var(--card)}
  .wire{width:56px;height:1px;background:var(--line);position:relative;overflow:hidden}
  .wire::after{content:"";position:absolute;top:0;left:-30%;width:30%;height:100%;
               background:var(--fg);animation:flow 2.2s linear infinite}
  @keyframes flow{to{left:100%}}

  /* usage */
  .usage{border-top:1px solid var(--line);padding:80px 0;display:grid;grid-template-columns:1fr 1.4fr;gap:48px;align-items:start}
  .usage h2{font-size:28px;font-weight:600;letter-spacing:-.03em;line-height:1.15}
  .usage h2 + p{color:var(--muted);margin-top:12px;font-size:15px}
  .cmds{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--card)}
  .cmd{display:flex;justify-content:space-between;gap:16px;padding:14px 18px;font-size:13.5px}
  .cmd + .cmd{border-top:1px solid var(--line)}
  .cmd span:last-child{color:var(--faint);font-family:Inter,system-ui,sans-serif;font-size:13px;white-space:nowrap}

  footer{margin-top:auto;border-top:1px solid var(--line);padding:28px 0;font-size:13px;color:var(--faint)}
  footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
  footer a:hover{color:var(--fg)}

  @media (max-width:760px){
    .nav-links a:not(:last-child){display:none}
    .hero{padding:56px 0 40px}
    .install{font-size:14px;max-width:100%}
    .term{margin-top:48px}
    .term-body{font-size:12px;padding:18px}
    .grid{grid-template-columns:1fr;margin-top:72px}
    .f,.f + .f{padding:28px 0;border-left:0}
    .f + .f{border-top:1px solid var(--line)}
    .chain{flex-direction:column}
    .wire{width:1px;height:28px}
    .wire::after{left:0;top:-30%;width:100%;height:30%;animation-name:flowv}
    @keyframes flowv{to{top:100%}}
    .usage{grid-template-columns:1fr;gap:28px;padding:64px 0}
    .cmd{flex-direction:column;gap:2px}
  }
  @media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
</head>
<body>

<div class="wrap">
  <nav>
    <a href="/" class="logo"><i><svg viewBox="0 0 16 16" fill="none" stroke="var(--bg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5l3 3-3 3M9 11h3"/></svg></i>expose127</a>
    <div class="nav-links">
      <a href="#how">How it works</a>
      <a href="#usage">Usage</a>
      <a href="https://www.npmjs.com/package/expose127" target="_blank" rel="noopener">npm</a>
      <a href="${DASHBOARD_URL}">Dashboard →</a>
    </div>
  </nav>

  <section class="hero">
    <div class="pill"><span class="dot"></span>${activeTunnels > 0 ? `${activeTunnels} tunnel${activeTunnels === 1 ? '' : 's'} live right now` : 'All systems operational'}</div>
    <h1>localhost,<br><span>made public.</span></h1>
    <p class="sub">One command gives your local app a secure, shareable HTTPS URL. No signup, no config, no waiting.</p>

    <div class="install mono">
      <span class="prompt">$</span><span id="cmd">npx expose127 3000</span>
      <button class="copy" id="copy" type="button">Copy</button>
    </div>

    <div class="term mono" aria-hidden="true">
      <div class="term-bar"><b></b><b></b><b></b></div>
      <div class="term-body" id="term"></div>
    </div>
  </section>

  <section class="grid">
    <div class="f"><div class="n mono">01</div><h3>Instant</h3><p>A public URL in under a second. Works with any framework — Laravel, Next.js, Django, plain PHP.</p></div>
    <div class="f"><div class="n mono">02</div><h3>Secure by default</h3><p>Every tunnel gets HTTPS on <span class="mono">*.${D}</span>. Your machine never opens a port.</p></div>
    <div class="f"><div class="n mono">03</div><h3>Built for sharing</h3><p>Demo to clients, test webhooks, preview on your phone. Live request log right in your terminal.</p></div>
  </section>

  <section class="flow" id="how">
    <div class="eyebrow">How it works</div>
    <div class="chain mono">
      <div class="node">localhost:3000</div><div class="wire"></div>
      <div class="node">expose127</div><div class="wire"></div>
      <div class="node">${D}</div><div class="wire"></div>
      <div class="node">the internet</div>
    </div>
  </section>

  <section class="usage" id="usage">
    <div>
      <h2>Everything you need.<br>Nothing you don't.</h2>
      <p>Run it with npx, or install globally for the shortest command.</p>
    </div>
    <div class="cmds mono">
      <div class="cmd"><span>npx expose127 3000</span><span>Expose port 3000</span></div>
      <div class="cmd"><span>expose127 8000 --subdomain my-app</span><span>Pick your own URL</span></div>
      <div class="cmd"><span>expose127 3000 --protocol https</span><span>Local HTTPS server</span></div>
      <div class="cmd"><span>npm install -g expose127</span><span>Install globally</span></div>
    </div>
  </section>
</div>

<footer>
  <div class="wrap">
    <span>© ${new Date().getFullYear()} expose127 · by <a href="https://hostmargin.com">Hostmargin</a></span>
    <span><a href="${DASHBOARD_URL}">Dashboard</a> · <a href="https://www.npmjs.com/package/expose127" target="_blank" rel="noopener">npm</a></span>
  </div>
</footer>

<script>
(function(){
  var btn = document.getElementById('copy');
  btn.addEventListener('click', function(){
    var text = document.getElementById('cmd').textContent;
    var done = function(){ btn.textContent = 'Copied'; btn.classList.add('ok');
      setTimeout(function(){ btn.textContent = 'Copy'; btn.classList.remove('ok'); }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
  });

  var term = document.getElementById('term');
  var words = ['swift','calm','bright','quiet','bold','lucky'];
  var nouns = ['river','wave','cloud','pine','comet','harbor'];
  var sub = words[Math.floor(Math.random()*6)] + '-' + nouns[Math.floor(Math.random()*6)] + '-' + (1000 + Math.floor(Math.random()*9000));
  var url = 'https://' + sub + '.${D}';

  var lines = [
    { type:true,  html:'<span class="t-dim">$</span> npx expose127 3000' },
    { html:'' },
    { html:'  <span class="t-dim">Status</span>       <span class="t-ok">● online</span>' },
    { html:'  <span class="t-dim">Public URL</span>   <span class="t-url">' + url + '</span>' },
    { html:'  <span class="t-dim">Forwarding</span>   → http://localhost:3000' },
    { html:'' },
    { html:'  <span class="t-dim">12:04:11</span>  <span class="t-get">GET </span>  <span class="t-ok">200</span>  /' },
    { html:'  <span class="t-dim">12:04:12</span>  <span class="t-get">GET </span>  <span class="t-ok">200</span>  /assets/app.css' },
    { html:'  <span class="t-dim">12:04:19</span>  <span class="t-post">POST</span>  <span class="t-ok">201</span>  /api/webhook' }
  ];

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { term.innerHTML = lines.map(function(l){ return l.html; }).join('\\n'); return; }

  var out = '', i = 0;
  function render(extra){ term.innerHTML = out + (extra || '') + '<span class="caret"></span>'; }
  function next(){
    if (i >= lines.length) { render(); return; }
    var l = lines[i++];
    if (l.type) {
      var plain = 'npx expose127 3000', c = 0;
      (function typeChar(){
        render('<span class="t-dim">$</span> ' + plain.slice(0, c));
        if (c++ < plain.length) setTimeout(typeChar, 55); else { out += l.html + '\\n'; setTimeout(next, 450); }
      })();
    } else {
      out += l.html + '\\n'; render(); setTimeout(next, i > 6 ? 700 : 140);
    }
  }
  setTimeout(next, 500);
})();
</script>
</body>
</html>`;
}

module.exports = { landingPage };
