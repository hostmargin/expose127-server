// PM2 ecosystem file
// Start with: pm2 start ecosystem.config.js
// Or:         pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name:         'hostmargin-server',
      script:       'src/server.js',
      cwd:          '/opt/hostmargin-server',

      // Restart automatically if it crashes
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,

      // Use all CPU cores (each process handles its own tunnel Map —
      // for multi-process you'd need Redis; single process is fine up to ~10k tunnels)
      instances:    1,

      // Logs
      out_file:     '/var/log/hostmargin/out.log',
      error_file:   '/var/log/hostmargin/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Watch for changes in production (disabled)
      watch:        false,

      env: {
        NODE_ENV:    'development',
        WS_PORT:     '4000',
        HTTP_PORT:   '3000',
        BASE_DOMAIN: 'hostmargin.com',
      },

      env_production: {
        NODE_ENV:    'production',
        WS_PORT:     '4000',
        HTTP_PORT:   '3000',
        BASE_DOMAIN: 'hostmargin.com',
        MAX_TUNNELS: '5000',
        RATE_LIMIT_RPM: '120',
      },
    },
  ],
};
