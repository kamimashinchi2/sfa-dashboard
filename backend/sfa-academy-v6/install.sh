#!/usr/bin/env bash
# Reruns are safe: package tar exit 1 (file changed while reading) is a warning;
# the Caddy key and apt list are replaced via temp files; iptables -C and
# systemctl enable/restart can run again; the answer-key temp name is new each
# time and removed on EXIT; /etc/sfa/cohort-invite is created only if missing,
# cohort-invite is created only if missing, so `sfa invite` is not regenerated.
set -eEuo pipefail
umask 077
DOMAIN=92-5-230-55.sslip.io
APP_DIR=''
REBUILD=1
VERBOSE=0
PROXY=auto
SFA_LOG=''
SFA_IN_ERR=0
KEY_TMP=''

say_terminal() {
  if { true >&3; } 2>/dev/null; then
    printf '%s\n' "$1" >&3
  else
    printf '%s\n' "$1" >&2
  fi
}

on_err() {
  local rc=$1 line=$2 src=''
  [[ $SFA_IN_ERR == 1 ]] && return
  SFA_IN_ERR=1
  # Script text, not the expanded command, so values and secrets are not printed.
  src=$(sed -n "${line}p" "$0" 2>/dev/null || true)
  src=${src#"${src%%[![:space:]]*}"}
  local msg="SFA installer failed at line ${line} (exit ${rc}): ${src:-unknown command}"
  say_terminal "$msg"
  if [[ -n $SFA_LOG ]]; then
    printf '%s\n' "$msg" >> "$SFA_LOG" || true
  fi
}
trap 'on_err $? $LINENO' ERR

cleanup_key() {
  if [[ -n ${KEY_TMP} && -f $KEY_TMP ]]; then
    rm -f "$KEY_TMP" || true
  fi
}
trap cleanup_key EXIT

die() {
  say_terminal "$1"
  if [[ -n $SFA_LOG ]]; then
    printf '%s\n' "$1" >> "$SFA_LOG" || true
  fi
  exit 1
}

stage() {
  echo "=== SFA installer: $1 ==="
}

# mode is "direct" (tests) or "pm2" (runuser + PM2 user's PATH).
check_node() {
  local mode=$1 bin='' ver='' major='' minor='' rest=''
  if [[ $mode == direct ]]; then
    bin=$(command -v node || true)
  else
    bin=$(runuser -u "$PM2_USER" -- env "PATH=$PM2_PATH" bash -c 'command -v node' || true)
  fi
  if [[ -z $bin ]]; then
    die "Node was not found for PM2 user ${PM2_USER} (PATH ${PM2_PATH}). Node 22.6 or newer is required. Upgrade with: nvm install 22, then restart PM2 as ${PM2_USER} so sfa-dashboard uses that Node."
  fi
  if [[ $mode == direct ]]; then
    ver=$(node -p 'process.versions.node' 2>/dev/null || true)
  else
    ver=$(runuser -u "$PM2_USER" -- env "PATH=$PM2_PATH" node -p 'process.versions.node' 2>/dev/null || true)
  fi
  ver=${ver#v}
  ver=${ver%%[[:space:]]*}
  major=${ver%%.*}
  rest=${ver#*.}
  minor=${rest%%.*}
  if ! [[ $major =~ ^[0-9]+$ && $minor =~ ^[0-9]+$ ]]; then
    die "Could not read a Node version for PM2 user ${PM2_USER} at ${bin} (PATH ${PM2_PATH}). Node 22.6 or newer is required. Upgrade with: nvm install 22, then restart PM2 as ${PM2_USER}."
  fi
  if (( major < 22 || (major == 22 && minor < 6) )); then
    die "Node ${ver} at ${bin} is too old for PM2 user ${PM2_USER} (PATH ${PM2_PATH}). Node 22.6 or newer is required. Upgrade with: nvm install 22, then restart PM2 as ${PM2_USER} so sfa-dashboard uses that Node."
  fi
  echo "Node ${ver} at ${bin} (PM2 user ${PM2_USER})"
}

# Code and the virtualenv contain no secrets. Capital X adds execute for
# directories and for files that are already executable (gunicorn, backup.sh).
publish_opt_sfa() {
  local root=$1
  chmod -R u=rwX,go=rX "$root"
}

redact_stream() {
  sed -E 's/([A-Za-z_][A-Za-z0-9_]*=)[^[:space:]]+/\1***/g'
}

wait_unit_http() {
  local unit=$1 url=$2 code=000
  for _ in $(seq 1 30); do
    code=$(curl --silent --output /dev/null --max-time 2 --write-out '%{http_code}' "$url" || true)
    if [[ $code == 200 ]]; then
      echo "$unit healthy: $url -> 200"
      return 0
    fi
    sleep 1
  done
  echo "$unit did not become healthy: $url last HTTP ${code}."
  journalctl -u "$unit" -n 20 --no-pager 2>&1 | redact_stream || true
  return 1
}

wait_unit_active() {
  local unit=$1
  for _ in $(seq 1 30); do
    if systemctl is-active --quiet "$unit"; then
      echo "$unit is active"
      return 0
    fi
    sleep 1
  done
  echo "$unit is not active after 30s."
  journalctl -u "$unit" -n 20 --no-pager 2>&1 | redact_stream || true
  return 1
}

nginx_holds_443() {
  ss -ltnpH 2>/dev/null | grep -E '[:.]443([^0-9]|$)' | grep -q nginx
}

choose_proxy() {
  case $PROXY in
    nginx|caddy) return;;
    auto) ;;
    *) die "Unknown --proxy ${PROXY} (use caddy, nginx, or auto)";;
  esac
  if systemctl is-active --quiet nginx 2>/dev/null || nginx_holds_443; then
    PROXY=nginx
  else
    PROXY=caddy
  fi
}

render_nginx_site() {
  local cert=${CERT_DIR:-/etc/letsencrypt/live/$DOMAIN}
  cat <<NGX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location ^~ /.well-known/acme-challenge/ { root /var/www/sfa-acme; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};
    ssl_certificate     ${cert}/fullchain.pem;
    ssl_certificate_key ${cert}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    server_tokens off;
    client_max_body_size 250m;
    client_body_timeout 300s;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy no-referrer always;

    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header Connection "";
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    location ^~ /api/v1/ { return 404; }
    location ^~ /echo/ { proxy_pass http://127.0.0.1:8081; }
    location / {
        proxy_set_header X-SFA-Client-IP \$remote_addr;
        proxy_pass http://127.0.0.1:3000;
    }
}
NGX
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN=$2; shift 2;;
    --app-dir) APP_DIR=$2; shift 2;;
    --rebuild-next) REBUILD=1; shift;;
    --no-rebuild-next) REBUILD=0; shift;;
    --verbose) VERBOSE=1; shift;;
    --proxy) PROXY=$2; shift 2;;
    *) echo "Unknown option: $1"; exit 2;;
  esac
done
[[ $DOMAIN =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]+$ ]] || die 'Invalid hostname'
# Test-only paths. Unset by default; production runs never enter them.
if [[ ${SFA_INSTALL_TEST_PROXY:-} == 1 ]]; then
  choose_proxy
  printf '%s\n' "$PROXY"
  exit 0
fi
if [[ ${SFA_INSTALL_RENDER_NGINX:-} == 1 ]]; then
  CERT_DIR=${SFA_TEST_CERT_DIR:-/etc/letsencrypt/live/$DOMAIN}
  render_nginx_site
  exit 0
fi
if [[ ${SFA_INSTALL_TEST_PERMS:-} == 1 ]]; then
  root=${SFA_TEST_OPT:?}
  umask 077
  mkdir -p "$root/.venv/bin"
  printf '#!/usr/bin/env python3\n' > "$root/.venv/bin/gunicorn"
  chmod 700 "$root" "$root/.venv" "$root/.venv/bin" "$root/.venv/bin/gunicorn"
  printf 'print(1)\n' > "$root/plain.py"
  chmod 600 "$root/plain.py"
  umask 022
  publish_opt_sfa "$root"
  if [[ -n ${SFA_TEST_WRAPPER:-} ]]; then
    printf '#!/bin/sh\n' > "$SFA_TEST_WRAPPER"
    chmod 755 "$SFA_TEST_WRAPPER"
  fi
  stat -c '%a %n' "$root" "$root/.venv" "$root/.venv/bin" "$root/.venv/bin/gunicorn" "$root/plain.py"
  if [[ -n ${SFA_TEST_WRAPPER:-} ]]; then stat -c '%a %n' "$SFA_TEST_WRAPPER"; fi
  exit 0
fi
if [[ ${SFA_INSTALL_TEST_PREFLIGHT:-} == 1 ]]; then
  PM2_USER=${SFA_TEST_PM2_USER:-pm2user}
  PM2_PATH=${SFA_TEST_PM2_PATH:-$PATH}
  check_node direct
  exit 0
fi
[[ $EUID -eq 0 ]] || die 'Run with sudo bash install.sh'
# shellcheck source=/dev/null
source /etc/os-release
[[ $ID == ubuntu && ( $VERSION_ID == 22.04 || $VERSION_ID == 24.04 ) ]] || die 'Supported: Ubuntu 22.04 or 24.04 only'
case "$(dpkg --print-architecture)" in amd64|arm64) ;; *) die 'Supported CPU: amd64/arm64';; esac
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mkdir -p /etc/sfa /var/log
chmod 700 /etc/sfa
touch /var/log/sfa-install.log
chmod 600 /var/log/sfa-install.log
SFA_LOG=/var/log/sfa-install.log
exec 3>&1
exec 4>>"$SFA_LOG"
if [[ $VERBOSE == 1 ]]; then
  # Trace goes to the private log only, never the terminal copy the operator may paste.
  BASH_XTRACEFD=4
  set -x
fi
if command -v stdbuf >/dev/null 2>&1; then
  exec > >(stdbuf -oL -eL tee -a "$SFA_LOG") 2>&1
else
  exec > >(tee -a "$SFA_LOG") 2>&1
fi
echo 'SFA v6 installer: no secret values are printed. No git pull is performed.'
stage 'packages'
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y ca-certificates curl gnupg debian-keyring debian-archive-keyring apt-transport-https python3-venv python3-pip postgresql postgresql-client libmagic1 unzip iptables iptables-persistent
stage 'python env'
if ! id sfa >/dev/null 2>&1; then useradd --system --home-dir /var/lib/sfa --create-home --shell /usr/sbin/nologin sfa; fi
install -d -m 750 -o root -g sfa /etc/sfa
install -d -m 700 -o sfa -g sfa /var/lib/sfa /var/lib/sfa/uploads
install -d -m 700 /var/backups/sfa
# Keep prior package for local rollback; no data deletion.
if [[ -d /opt/sfa/sfa_api ]]; then
  tar_rc=0
  tar -czf "/var/backups/sfa/package-$(date +%Y%m%d-%H%M%S).tar.gz" -C /opt/sfa --exclude=.venv --exclude=__pycache__ . || tar_rc=$?
  if [[ $tar_rc -eq 1 ]]; then
    echo 'Package backup finished with a tar warning (a file changed while it was read). Continuing.'
  elif [[ $tar_rc -ne 0 ]]; then
    die "Package backup failed (tar exit ${tar_rc})."
  fi
fi
# /opt/sfa is code and a virtualenv, not secrets. umask 077 would make it mode 700
# and sfa-api would fail with 203/EXEC (cannot traverse or exec gunicorn).
umask 022
install -d -m 755 /opt/sfa
cp -a "$ROOT/sfa_api" "$ROOT/tools" "$ROOT/echo_client.py" "$ROOT/backup.sh" "$ROOT/requirements.txt" /opt/sfa/
cp "$ROOT/"*.schema.json /opt/sfa/
chown -R root:root /opt/sfa
python3 -m venv /opt/sfa/.venv
/opt/sfa/.venv/bin/pip install --disable-pip-version-check -q -r /opt/sfa/requirements.txt
publish_opt_sfa /opt/sfa
umask 077
stage 'CLI'
# Written before later steps so `sfa` exists if preflight or configure stops the run.
# The wrapper does not read config; `sfa_api.cli` parses arguments first and calls
# Config.env() only for commands that need the database.
cat > /usr/local/bin/sfa <<'SH'
#!/usr/bin/env bash
set -euo pipefail
export PYTHONPATH=/opt/sfa
exec /opt/sfa/.venv/bin/python -m sfa_api.cli "$@"
SH
chmod 755 /usr/local/bin/sfa
# A rerun may have created the wrapper under umask 077; 0755 is required for every user.
[[ -x /usr/local/bin/sfa ]] || die '/usr/local/bin/sfa is not executable'
HELPER=/opt/sfa/tools/configure.py
stage 'discover'
# Vendored tree: backend/sfa-academy-v6/install.sh → repository root (the Next app).
# A standalone zip extract has no next.config.ts two levels up and keeps PM2 cwd discovery.
if [[ -z ${APP_DIR} ]]; then
  CANDIDATE=$(cd -- "$ROOT/../.." && pwd)
  if [[ -f "$CANDIDATE/package.json" && -f "$CANDIDATE/next.config.ts" ]]; then
    APP_DIR=$CANDIDATE
  fi
fi
/opt/sfa/.venv/bin/python "$HELPER" discover "$APP_DIR"
# Re-resolve pm2/node in case install-state.json still points at an old Node.
/opt/sfa/.venv/bin/python "$HELPER" pm2 refresh
get() {
  local key=$1 val=''
  if ! val=$(/opt/sfa/.venv/bin/python "$HELPER" get "$key"); then
    die "Could not read installer state '${key}' after discover."
  fi
  printf '%s\n' "$val"
}
APP_DIR=$(get app); PM2_USER=$(get user); PM2_PATH=$(get path)
stage 'preflight'
# Require the integration marker and modern Node BEFORE stopping old services.
[[ -f "$APP_DIR/.sfa-v6-ready" ]] || die 'Apply Cursor prompt, test and pull first (.sfa-v6-ready missing). Old bridge left running.'
check_node pm2
stage 'database'
systemctl enable --now postgresql
/opt/sfa/.venv/bin/python "$HELPER" configure "$DOMAIN"
export PYTHONPATH=/opt/sfa
stage 'answer key'
# Current build private answer key (server answerKeyData.ts hydration; never a public asset).
install -d -m 750 -o root -g sfa /etc/sfa/answer-keys
COMMIT=$(git -C "$APP_DIR" rev-parse HEAD)
KEY_TMP=$(mktemp /etc/sfa/answer-keys/.key-XXXXXX)
if ! runuser -u "$PM2_USER" -- env "PATH=$PM2_PATH" node /opt/sfa/tools/extract_answer_key.mjs "$APP_DIR" "$COMMIT" > "$KEY_TMP" 2> /var/log/sfa-key-extract.log; then
  die 'Private answer-key extraction failed; old bridge left running. Review /var/log/sfa-key-extract.log privately.'
fi
install -m 640 -o root -g sfa "$KEY_TMP" "/etc/sfa/answer-keys/$COMMIT.json"
rm -f "$KEY_TMP"
KEY_TMP=''
stage 'migrate'
sfa migrate
stage 'services'
# Snapshot legacy data before stopping processes; SQLite consistent backup is made using its backup API.
/opt/sfa/.venv/bin/python - <<'PY'
import json,sqlite3,subprocess,time,tarfile
from pathlib import Path
from sfa_api.config import Config
from sfa_api.service import Service
from sfa_api.legacy import import_sqlite
state=json.loads(Path('/etc/sfa/install-state.json').read_text()); svc=Service(Config.env())
for i,root in enumerate(state.get('legacy_data',[])):
    root=Path(root); backup=Path('/var/backups/sfa')/('legacy-'+str(int(time.time()))+'-'+str(i)); backup.mkdir(mode=0o700)
    with sqlite3.connect(str(root/'bridge.sqlite3')) as source, sqlite3.connect(str(backup/'bridge.sqlite3')) as target: source.backup(target)
    # Preserve complete directory, including attachments. No deletions.
    with tarfile.open(str(backup)+'.tar.gz','w:gz') as tar: tar.add(root,arcname='legacy')
    # Import originals read-only while old bot is stopped below, before API starts.
PY
# Cut over only identified old academy API/bot PM2 processes after backups.
/opt/sfa/.venv/bin/python "$HELPER" pm2 stop-legacy
/opt/sfa/.venv/bin/python - <<'PY'
import json
from pathlib import Path
from sfa_api.config import Config
from sfa_api.service import Service
from sfa_api.legacy import import_sqlite
s=Service(Config.env()); state=json.loads(Path('/etc/sfa/install-state.json').read_text())
for root in state.get('legacy_data',[]): print(import_sqlite(s,Path(root)/'bridge.sqlite3'))
PY
cat > /etc/systemd/system/sfa-api.service <<'UNIT'
[Unit]
Description=SFA v6 API (loopback only)
After=network.target postgresql.service
Requires=postgresql.service
[Service]
User=sfa
Group=sfa
WorkingDirectory=/opt/sfa
EnvironmentFile=/etc/sfa/sfa.env
Environment=PYTHONDONTWRITEBYTECODE=1
ExecStart=/opt/sfa/.venv/bin/gunicorn --workers 2 --threads 2 --bind 127.0.0.1:8081 --timeout 180 --error-logfile - sfa_api.wsgi:app
Restart=on-failure
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/sfa
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/sfa-bot.service <<'UNIT'
[Unit]
Description=SFA optional Telegram notifications
After=sfa-api.service network-online.target
[Service]
User=sfa
Group=sfa
WorkingDirectory=/opt/sfa
EnvironmentFile=/etc/sfa/sfa.env
Environment=PYTHONDONTWRITEBYTECODE=1
ExecStart=/opt/sfa/.venv/bin/python -m sfa_api.bot
Restart=on-failure
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/sfa
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/sfa-backup.service <<'UNIT'
[Unit]
Description=SFA root-only consistent local backup
After=postgresql.service
[Service]
Type=oneshot
WorkingDirectory=/opt/sfa
Environment=PYTHONPATH=/opt/sfa
ExecStart=/opt/sfa/backup.sh
UMask=0077
UNIT
cat > /etc/systemd/system/sfa-backup.timer <<'UNIT'
[Unit]
Description=SFA nightly backup (Europe/Amsterdam)
[Timer]
OnCalendar=*-*-* 03:15:00 Europe/Amsterdam
Persistent=true
RandomizedDelaySec=120
[Install]
WantedBy=timers.target
UNIT
chmod 755 /opt/sfa/backup.sh
publish_opt_sfa /opt/sfa
systemctl daemon-reload
systemctl enable --now sfa-api sfa-backup.timer
systemctl restart sfa-api
wait_unit_http sfa-api http://127.0.0.1:8081/echo/v1/health || die 'sfa-api failed to serve /echo/v1/health. Journal lines are above.'
if /opt/sfa/.venv/bin/python -c 'from sfa_api.config import Config;import sys;sys.exit(not bool(Config.env().bot_token))'; then
  systemctl enable --now sfa-bot
  systemctl restart sfa-bot
  wait_unit_active sfa-bot || die 'sfa-bot failed to stay active. Journal lines are above.'
else
  systemctl disable --now sfa-bot || true
  echo 'Telegram is optional and currently disabled (no token found).'
fi
chown -R sfa:sfa /var/lib/sfa
stage 'web'
choose_proxy
echo "Proxy: $PROXY"
if [[ $PROXY == nginx ]]; then
  command -v nginx >/dev/null || die 'nginx is not installed, and --proxy nginx will not install Caddy.'
  systemctl disable --now caddy >/dev/null 2>&1 || true
  echo 'Caddy stopped and disabled if it was present.'
  if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
    SITE=/etc/nginx/sites-available/sfa-academy.conf
    LINK=/etc/nginx/sites-enabled/sfa-academy.conf
  else
    SITE=/etc/nginx/conf.d/sfa-academy.conf
    LINK=''
  fi
  install -d -m 755 /var/www/sfa-acme
  enable_site() { if [[ -n $LINK ]]; then ln -sfn "$SITE" "$LINK"; fi; }
  backup_site() { if [[ -f $SITE ]]; then cp -a "$SITE" "$SITE.bak-$(date +%Y%m%d-%H%M%S)"; fi; }
  rollback_site() {
    local latest=''
    latest=$(find "$(dirname "$SITE")" -maxdepth 1 -name "$(basename "$SITE").bak-*" | sort | tail -n1 || true)
    if [[ -n $latest ]]; then cp -a "$latest" "$SITE"; else rm -f "$SITE"; if [[ -n $LINK ]]; then rm -f "$LINK"; fi; fi
  }
  apply_nginx() {
    if ! nginx -t; then
      echo 'nginx config test failed; restoring the previous academy site file. Other sites were not edited.'
      rollback_site
      nginx -t || true
      die 'nginx -t failed; academy site rolled back.'
    fi
    systemctl reload nginx
  }
  CERT_DIR=/etc/letsencrypt/live/$DOMAIN
  if [[ ! -f $CERT_DIR/fullchain.pem ]]; then
    backup_site
    cat > "$SITE" <<NGX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location ^~ /.well-known/acme-challenge/ { root /var/www/sfa-acme; }
    location / { return 301 https://\$host\$request_uri; }
}
NGX
    enable_site
    apply_nginx
    if ! command -v certbot >/dev/null 2>&1; then
      apt-get update -qq
      apt-get install -y certbot
    fi
    if ! certbot certonly --webroot -w /var/www/sfa-acme -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --deploy-hook 'systemctl reload nginx'; then
      die "Certificate request failed for ${DOMAIN}. An existing certificate is reused when fullchain.pem is already present."
    fi
  else
    echo 'Reusing the existing certificate.'
  fi
  backup_site
  CERT_DIR=/etc/letsencrypt/live/$DOMAIN
  render_nginx_site > "$SITE"
  enable_site
  apply_nginx
  echo 'nginx site installed.'
else
stage 'caddy'
# Official Caddy apt repository; no curl | shell. Replace any existing key/list in place.
caddy_key=$(mktemp)
if ! curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o "$caddy_key"; then
  rm -f "$caddy_key"
  die 'Could not download the Caddy signing key. An existing keyring was left unchanged.'
fi
install -d -m 755 /usr/share/keyrings
install -m 644 "$caddy_key" /usr/share/keyrings/caddy-stable-archive-keyring.gpg
rm -f "$caddy_key"
caddy_list=$(mktemp)
if ! curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o "$caddy_list"; then
  rm -f "$caddy_list"
  die 'Could not download the Caddy apt source. An existing source list was left unchanged.'
fi
install -m 644 "$caddy_list" /etc/apt/sources.list.d/caddy-stable.list
rm -f "$caddy_list"
apt-get update -qq && apt-get install -y caddy
if [[ -f /etc/caddy/Caddyfile && ! -f /etc/caddy/Caddyfile.pre-sfa6 ]]; then cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.pre-sfa6; fi
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy no-referrer
        -Server
    }
    request_body {
        max_size 250MB
    }
    # API namespace is internal; never proxy it directly from the Internet.
    handle /api/v1/* {
        respond 404
    }
    handle /echo/* {
        reverse_proxy 127.0.0.1:8081
    }
    handle {
        # Caddy overwrites this header with the immediate remote host.
        reverse_proxy 127.0.0.1:3000 {
            header_up X-SFA-Client-IP {http.request.remote.host}
        }
    }
}
CADDY
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
fi
stage 'firewall'
# Preserve existing firewall chains. Insert allow rules before Oracle's terminal REJECT.
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -m comment --comment sfa6-web -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport "$port" -m comment --comment sfa6-web -j ACCEPT
  if command -v ufw >/dev/null 2>&1 && ufw status | python3 -c 'import sys;sys.exit("Status: active" not in sys.stdin.read())'; then ufw allow "$port/tcp"; fi
done
install -d -m 755 /etc/iptables
iptables-save > /etc/iptables/rules.v4
if [[ $PROXY == nginx ]]; then
  systemctl enable --now nginx
  systemctl reload nginx
else
  systemctl enable --now caddy
  systemctl reload caddy
fi
stage 'build'
# Rebuild as app owner, not root. Build output could contain app-generated secrets: keep private, not installer log.
if [[ $REBUILD == 1 ]]; then
  # shellcheck disable=SC2016 # $1 is deliberately expanded by the child shell
  if ! runuser -u "$PM2_USER" -- env "PATH=$PM2_PATH" bash -c 'cd "$1" && npm ci && npm run build' _ "$APP_DIR" > /var/log/sfa-next-build.log 2>&1; then
    die 'Next build failed; private log /var/log/sfa-next-build.log. Do not send it unreviewed.'
  fi
fi
stage 'restart'
/opt/sfa/.venv/bin/python "$HELPER" pm2 restart
python3 - <<'CHECK'
import subprocess
rows=subprocess.check_output(['ss','-ltnH'],text=True).splitlines()
for line in rows:
    endpoint=line.split()[3]
    if endpoint.endswith((':3000',':8081')) and endpoint not in ('127.0.0.1:3000','127.0.0.1:8081','[::1]:3000','[::1]:8081'):
        raise SystemExit('Unsafe public listener. Set PM2 Next start args to --hostname 127.0.0.1, then rerun installer. No HTTP fallback permitted.')
CHECK
stage 'https'
# Do not imply HTTPS succeeded or weaken cookies if issuance/OCI networking fails.
HTTPS_OK=0
health_url="https://$DOMAIN/echo/v1/health"
home_url="https://$DOMAIN/"
health_code=000
home_code=000
for _ in $(seq 1 12); do
  health_code=$(curl --silent --output /dev/null --max-time 10 --write-out '%{http_code}' "$health_url" || true)
  home_code=$(curl --silent --output /dev/null --max-time 10 --write-out '%{http_code}' "$home_url" || true)
  if [[ $health_code == 200 && $home_code == 200 ]]; then HTTPS_OK=1; break; fi
  sleep 5
done
if [[ $HTTPS_OK == 1 ]]; then
  # Close old public ports; loopback remains accessible. These rules survive reboot.
  for port in 3000 8081; do
    iptables -C INPUT ! -i lo -p tcp --dport "$port" -m comment --comment sfa6-private -j REJECT 2>/dev/null || iptables -I INPUT 1 ! -i lo -p tcp --dport "$port" -m comment --comment sfa6-private -j REJECT
    if command -v ufw >/dev/null 2>&1 && ufw status | python3 -c 'import sys;sys.exit("Status: active" not in sys.stdin.read())'; then ufw deny "$port/tcp"; fi
  done
  iptables-save > /etc/iptables/rules.v4
  echo 'HTTPS verified; ports 3000/8081 blocked publicly.'
else
  [[ $health_code == 200 ]] || echo "HTTPS check failed: ${health_url} returned HTTP ${health_code:-000}"
  [[ $home_code == 200 ]] || echo "HTTPS check failed: ${home_url} returned HTTP ${home_code:-000}"
  echo 'HTTPS NOT VERIFIED: check OCI VCN/NSG TCP 80/443 ingress and the proxy certificate logs. No HTTP login fallback is enabled.'
fi
echo "Site: https://$DOMAIN"
if [[ ! -f /etc/sfa/cohort-invite ]]; then sfa invite > /etc/sfa/cohort-invite; chmod 600 /etc/sfa/cohort-invite; fi
# FD3 is original terminal, not the installer logfile; never log bearer invite tokens.
echo 'Cohort invite (private; only share with your cohort):' >&3
while IFS= read -r line; do printf '%s\n' "$line" >&3; done < /etc/sfa/cohort-invite
echo 'Invite saved privately in /etc/sfa/cohort-invite (not in installer log).'
sfa backup-now
echo 'Echo key: /etc/sfa/echo-api-key. Show once in PRIVATE terminal with sudo sfa show-echo-key; enter only in Echo secure form, never chat.'
echo 'Apply Cursor prompt before this installer; Next was rebuilt/restarted unless --no-rebuild-next was given.'
echo 'No email service required. A grading routine still needs to be configured in Echo after secure key setup.'
if [[ $HTTPS_OK != 1 ]]; then exit 3; fi
