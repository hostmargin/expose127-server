'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const cfg = require('./config');

fs.mkdirSync(path.dirname(cfg.DB_PATH), { recursive: true });

const db = new DatabaseSync(cfg.DB_PATH);

// WAL mode lets the tunnel-server and the expose127 dashboard process both
// read/write this file at the same time without stepping on each other.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 3000;');

db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    token      TEXT PRIMARY KEY,
    client_id  INTEGER NOT NULL,
    email      TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS tunnels (
    subdomain    TEXT PRIMARY KEY,
    client_id    INTEGER,
    connected_at INTEGER,
    closed_at    INTEGER
  );

  CREATE TABLE IF NOT EXISTS requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER,
    subdomain   TEXT,
    method      TEXT,
    path        TEXT,
    status_code INTEGER,
    duration_ms INTEGER,
    ts          INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_requests_client ON requests(client_id, ts DESC);
`);

const stmts = {
  findToken:      db.prepare('SELECT client_id, email FROM tokens WHERE token = ?'),
  insertToken:    db.prepare('INSERT INTO tokens (token, client_id, email, created_at) VALUES (?, ?, ?, ?)'),

  upsertTunnel:   db.prepare(`
    INSERT INTO tunnels (subdomain, client_id, connected_at, closed_at)
    VALUES (?, ?, ?, NULL)
    ON CONFLICT(subdomain) DO UPDATE SET client_id = excluded.client_id, connected_at = excluded.connected_at, closed_at = NULL
  `),
  closeTunnel:    db.prepare('UPDATE tunnels SET closed_at = ? WHERE subdomain = ?'),
  activeTunnels:  db.prepare('SELECT subdomain, connected_at FROM tunnels WHERE client_id = ? AND closed_at IS NULL ORDER BY connected_at DESC'),

  insertRequest:  db.prepare(`
    INSERT INTO requests (client_id, subdomain, method, path, status_code, duration_ms, ts)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  recentRequests: db.prepare(`
    SELECT method, path, status_code, duration_ms, ts
    FROM requests
    WHERE client_id = ? AND subdomain = ?
    ORDER BY ts DESC
    LIMIT ?
  `),
  pruneRequests:  db.prepare('DELETE FROM requests WHERE ts < ?'),
};

function findClientByToken(token) {
  if (!token) return null;
  return stmts.findToken.get(token) || null;
}

function markTunnelConnected(subdomain, clientId) {
  stmts.upsertTunnel.run(subdomain, clientId, Date.now());
}

function markTunnelClosed(subdomain) {
  stmts.closeTunnel.run(Date.now(), subdomain);
}

function logRequest({ clientId, subdomain, method, path: reqPath, statusCode, durationMs }) {
  stmts.insertRequest.run(clientId, subdomain, method, reqPath, statusCode, durationMs, Date.now());
}

function pruneOldRequests(retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  stmts.pruneRequests.run(cutoff);
}

module.exports = {
  db,
  findClientByToken,
  markTunnelConnected,
  markTunnelClosed,
  logRequest,
  pruneOldRequests,
};
