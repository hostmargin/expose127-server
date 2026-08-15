'use strict';
require('dotenv').config();

module.exports = {
  WS_PORT:        parseInt(process.env.WS_PORT   || '4000'),
  HTTP_PORT:      parseInt(process.env.HTTP_PORT  || '3000'),
  BASE_DOMAIN:    process.env.BASE_DOMAIN         || 'hostmargin.com',
  MAX_TUNNELS:    parseInt(process.env.MAX_TUNNELS || '1000'),
  RATE_LIMIT_RPM: parseInt(process.env.RATE_LIMIT_RPM || '60'),
  MAX_BODY_BYTES: parseInt(process.env.MAX_BODY_BYTES  || String(10 * 1024 * 1024)),

  // Valid auth tokens — empty array means open access
  VALID_TOKENS: process.env.VALID_TOKENS
    ? process.env.VALID_TOKENS.split(',').map(t => t.trim()).filter(Boolean)
    : [],

  // Shared SQLite file (also read/written by the expose127 dashboard app)
  DB_PATH: process.env.DB_PATH || require('path').join(__dirname, '..', 'data', 'expose127.db'),

  // How long to keep request log rows before pruning (days)
  LOG_RETENTION_DAYS: parseInt(process.env.LOG_RETENTION_DAYS || '7'),
};
