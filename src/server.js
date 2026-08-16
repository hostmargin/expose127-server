'use strict';

const http          = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { v4: uuidv4 }= require('uuid');

const cfg           = require('./config');
const { uniqueSubdomain }              = require('./subdomains');
const { RateLimiter }                  = require('./rate-limit');
const { noTunnelPage, rateLimitPage, timeoutPage, bodyTooLargePage } = require('./pages');
const db            = require('./db');

// ── State ─────────────────────────────────────────────────────────────────────
// subdomain → WebSocket (CLI connection)
const tunnels     = new Map();

// IP → rate-limiter window (shared instance)
const rateLimiter = new RateLimiter(cfg.RATE_LIMIT_RPM);

// ── Helpers ───────────────────────────────────────────────────────────────────
function getIP(req) {
  // Respect X-Forwarded-For when behind Nginx
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0] : req.socket.remoteAddress || '').trim();
}

function log(level, msg) {
  const t = new Date().toISOString();
  console.log(`[${t}] [${level.toUpperCase()}] ${msg}`);
}

// ── WebSocket server — CLI clients connect here ───────────────────────────────
const wss = new WebSocketServer({ port: cfg.WS_PORT });

wss.on('listening', () => {
  log('info', `WS server  listening on ws://0.0.0.0:${cfg.WS_PORT}/register`);
});

wss.on('connection', (ws, req) => {

  // ── 1. Check tunnel capacity ──────────────────────────────────────────────
  if (tunnels.size >= cfg.MAX_TUNNELS) {
    ws.send(JSON.stringify({ type: 'error', message: 'Server is at capacity. Try again later.', fatal: true }));
    ws.close(1013, 'Server full');
    return;
  }

  // ── 2. Auth token check (if VALID_TOKENS is configured) ───────────────────
  const url   = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token') || req.headers['x-hm-token'] || '';

  if (cfg.VALID_TOKENS.length > 0 && !cfg.VALID_TOKENS.includes(token)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid or missing auth token.', fatal: true }));
    ws.close(4001, 'Unauthorized');
    log('warn', `Rejected connection — bad token from ${getIP(req)}`);
    return;
  }

  // Resolve which dashboard account (if any) owns this tunnel — a personal
  // token issued from the expose127 dashboard, unrelated to VALID_TOKENS above.
  // No token, or a token that doesn't match anyone (including a revoked one),
  // just means "anonymous" — the tunnel still works and is still recorded
  // (client_id NULL), it just won't show up in any customer's own dashboard,
  // only in the admin panel's cross-client view.
  const owner    = db.findClientByToken(token);
  const clientId = owner ? owner.client_id : null;

  // ── 3. Assign subdomain ───────────────────────────────────────────────────
  const requested = url.searchParams.get('subdomain') || null;
  const subdomain = uniqueSubdomain(tunnels, requested);

  ws.subdomain       = subdomain;
  ws.clientId        = clientId;
  ws.pendingRequests = new Map(); // requestId → { resolve, reject }
  ws.connectedAt     = Date.now();

  tunnels.set(subdomain, ws);
  db.markTunnelConnected(subdomain, clientId);
  log('info', `[+] ${subdomain}.${cfg.BASE_DOMAIN}  (total: ${tunnels.size})`);

  // ── 4. Tell CLI its public URL ────────────────────────────────────────────
  ws.send(JSON.stringify({
    type:      'tunnel_ready',
    subdomain,
    url:       `https://${subdomain}.${cfg.BASE_DOMAIN}`,
  }));

  // ── 5. Keepalive ping every 25 s ─────────────────────────────────────────
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 25_000);

  // ── 6. Handle messages from CLI (responses to forwarded requests) ─────────
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'response') {
      const pending = ws.pendingRequests.get(msg.requestId);
      if (pending) {
        ws.pendingRequests.delete(msg.requestId);
        pending.resolve(msg);
      }
    }
    // pong — no action needed
  });

  // ── 7. Cleanup on disconnect ──────────────────────────────────────────────
  ws.on('close', () => {
    clearInterval(pingInterval);
    tunnels.delete(subdomain);
    db.markTunnelClosed(subdomain);

    // Reject any requests still waiting on this tunnel
    for (const [, pending] of ws.pendingRequests) {
      pending.reject(new Error('Tunnel closed'));
    }
    ws.pendingRequests.clear();

    log('info', `[-] ${subdomain}.${cfg.BASE_DOMAIN}  (total: ${tunnels.size})`);
  });

  ws.on('error', (err) => {
    log('error', `WS error on ${subdomain}: ${err.message}`);
  });
});

// ── HTTP server — public tunnel traffic ───────────────────────────────────────
const httpServer = http.createServer(async (req, res) => {
  const host      = req.headers.host || '';
  const subdomain = host.split('.')[0];
  const ip        = getIP(req);

  // ── Health check (no subdomain routing needed) ───────────────────────────
  if (subdomain === 'tunnel' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      status:        'ok',
      activeTunnels: tunnels.size,
      uptime:        Math.floor(process.uptime()),
    }));
    return;
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  if (!rateLimiter.check(ip)) {
    res.writeHead(429, { 'content-type': 'text/html', 'retry-after': '60' });
    res.end(rateLimitPage());
    log('warn', `Rate limited: ${ip} → ${subdomain}`);
    return;
  }

  // ── Find tunnel ───────────────────────────────────────────────────────────
  const tunnelWs = tunnels.get(subdomain);
  if (!tunnelWs || tunnelWs.readyState !== WebSocket.OPEN) {
    res.writeHead(502, { 'content-type': 'text/html' });
    res.end(noTunnelPage(subdomain));
    return;
  }

  // ── Read request body (with size limit) ───────────────────────────────────
  const bodyChunks = [];
  let bodySize     = 0;
  let bodyAborted  = false;

  await new Promise((resolve) => {
    req.on('data', (chunk) => {
      bodySize += chunk.length;
      if (bodySize > cfg.MAX_BODY_BYTES) {
        bodyAborted = true;
        req.destroy();
        resolve();
        return;
      }
      bodyChunks.push(chunk);
    });
    req.on('end',   resolve);
    req.on('error', resolve);
  });

  if (bodyAborted) {
    res.writeHead(413, { 'content-type': 'text/html' });
    res.end(bodyTooLargePage());
    return;
  }

  const bodyB64 = bodyChunks.length
    ? Buffer.concat(bodyChunks).toString('base64')
    : null;

  // ── Forward request to CLI via WebSocket ──────────────────────────────────
  const requestId = uuidv4();

  const responsePromise = new Promise((resolve, reject) => {
    tunnelWs.pendingRequests.set(requestId, { resolve, reject });

    // 30 s timeout
    setTimeout(() => {
      tunnelWs.pendingRequests.delete(requestId);
      reject(new Error('timeout'));
    }, 30_000);
  });

  try {
    tunnelWs.send(JSON.stringify({
      type:      'request',
      requestId,
      method:    req.method,
      path:      req.url,
      headers:   req.headers,
      body:      bodyB64,
    }));
  } catch (err) {
    res.writeHead(502, { 'content-type': 'text/html' });
    res.end(noTunnelPage(subdomain));
    return;
  }

  // ── Wait for CLI response ─────────────────────────────────────────────────
  let tunnelResponse;
  try {
    tunnelResponse = await responsePromise;
  } catch (err) {
    if (err.message === 'timeout') {
      res.writeHead(504, { 'content-type': 'text/html' });
      res.end(timeoutPage());
    } else {
      res.writeHead(502, { 'content-type': 'text/html' });
      res.end(noTunnelPage(subdomain));
    }
    return;
  }

  // ── Stream response back to browser ──────────────────────────────────────
  const resHeaders = { ...tunnelResponse.headers };
  // Remove hop-by-hop headers that confuse Node's http module
  ['transfer-encoding', 'connection', 'keep-alive', 'upgrade',
   'proxy-authenticate', 'proxy-authorization', 'te', 'trailers']
    .forEach(h => delete resHeaders[h]);

  res.writeHead(tunnelResponse.statusCode || 200, resHeaders);

  if (tunnelResponse.body) {
    res.end(Buffer.from(tunnelResponse.body, 'base64'));
  } else {
    res.end();
  }

  db.logRequest({
    clientId:   tunnelWs.clientId,
    subdomain,
    method:     req.method,
    path:       req.url,
    statusCode: tunnelResponse.statusCode || 200,
    durationMs: tunnelResponse.durationMs || 0,
  });

  log('info', `${req.method} ${tunnelResponse.statusCode} ${subdomain} ${req.url}`);
});

httpServer.listen(cfg.HTTP_PORT, () => {
  log('info', `HTTP server listening on http://0.0.0.0:${cfg.HTTP_PORT}`);
  log('info', `Tunnels served as https://<subdomain>.${cfg.BASE_DOMAIN}`);
  log('info', `Max tunnels: ${cfg.MAX_TUNNELS}  |  Rate limit: ${cfg.RATE_LIMIT_RPM} rpm  |  Auth: ${cfg.VALID_TOKENS.length > 0 ? 'enabled' : 'open'}`);
});

// ── Request-log retention ──────────────────────────────────────────────────────
setInterval(() => {
  db.pruneOldRequests(cfg.LOG_RETENTION_DAYS);
}, 60 * 60 * 1000).unref();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  log('info', `${signal} received — shutting down gracefully`);

  // Notify all connected CLI clients
  for (const [subdomain, ws] of tunnels) {
    try {
      ws.send(JSON.stringify({ type: 'error', message: 'Server is restarting.', fatal: false }));
      ws.close(1001, 'Server shutting down');
    } catch (_) {}
  }

  httpServer.close(() => {
    log('info', 'HTTP server closed');
    process.exit(0);
  });

  // Force exit after 5 s if connections won't close
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Catch unhandled errors — log but don't crash
process.on('uncaughtException',  (err) => log('error', `Uncaught: ${err.message}`));
process.on('unhandledRejection', (err) => log('error', `Unhandled: ${err}`));
