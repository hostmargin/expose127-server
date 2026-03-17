#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# hostmargin tunnel server — one-time VPS setup script
# Run as root on a fresh Ubuntu 22.04 / 24.04 server:
#   curl -sL https://raw.githubusercontent.com/hostmargin/server/main/setup.sh | bash
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${DOMAIN:-hostmargin.com}"
APP_DIR="/opt/hostmargin-server"
APP_USER="hostmargin"

echo ""
echo "=== hostmargin server setup ==="
echo "Domain: $DOMAIN"
echo ""

# ── 1. System packages ────────────────────────────────────────────────────────
echo "[1/8] Installing system packages..."
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw

# ── 2. Node.js 20 ─────────────────────────────────────────────────────────────
echo "[2/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
echo "[3/8] Installing PM2..."
npm install -g pm2

# ── 4. Create app user ────────────────────────────────────────────────────────
echo "[4/8] Creating app user '$APP_USER'..."
id "$APP_USER" &>/dev/null || useradd -r -s /bin/bash -m -d "/home/$APP_USER" "$APP_USER"

# ── 5. Clone server repo ──────────────────────────────────────────────────────
echo "[5/8] Setting up app directory..."
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# If already cloned, just pull; otherwise clone
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" pull
else
  echo "  NOTE: Place your server code in $APP_DIR"
  echo "  e.g.: git clone https://github.com/hostmargin/server.git $APP_DIR"
fi

# ── 6. Firewall ───────────────────────────────────────────────────────────────
echo "[6/8] Configuring firewall..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 4000/tcp # WebSocket from CLI (or handle via Nginx — see nginx.conf)
ufw --force enable

# ── 7. SSL certificate ────────────────────────────────────────────────────────
echo "[7/8] Getting wildcard SSL certificate..."
echo "  You need a wildcard cert for *.$DOMAIN"
echo "  Run this command manually (requires DNS challenge):"
echo ""
echo "  certbot certonly --manual --preferred-challenges dns \\"
echo "    -d $DOMAIN -d *.$DOMAIN"
echo ""
echo "  Then press Enter to continue..."
read -r

# ── 8. Nginx config ───────────────────────────────────────────────────────────
echo "[8/8] Writing Nginx config..."
cat > /etc/nginx/sites-available/hostmargin << NGINX
# WebSocket endpoint — CLI clients connect here
server {
    listen 443 ssl;
    server_name tunnel.$DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location /register {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       \$host;
        proxy_read_timeout 86400s;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000;
    }
}

# Wildcard subdomain — public tunnel traffic
server {
    listen 443 ssl;
    server_name ~^(?P<sub>.+)\.$DOMAIN\$;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
        client_max_body_size 10m;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN *.$DOMAIN tunnel.$DOMAIN;
    return 301 https://\$host\$request_uri;
}
NGINX

ln -sf /etc/nginx/sites-available/hostmargin /etc/nginx/sites-enabled/hostmargin
nginx -t && systemctl reload nginx

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Place your server code in $APP_DIR"
echo "  2. cp $APP_DIR/.env.example $APP_DIR/.env  and edit it"
echo "  3. cd $APP_DIR && npm ci"
echo "  4. pm2 start src/server.js --name hostmargin-server"
echo "  5. pm2 save && pm2 startup"
echo ""
