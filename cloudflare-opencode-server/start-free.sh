#!/usr/bin/env bash
set -euo pipefail

if ! command -v opencode >/dev/null 2>&1; then
  echo "Installing OpenCode CLI..."
  npm install -g @opencode/cli
fi

if ! command -v wrangler >/dev/null 2>&1; then
  echo "Installing Cloudflare Wrangler..."
  npm install -g wrangler
fi

STATUS="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:4096/global/health || true)"

if [ "$STATUS" = "200" ] || [ "$STATUS" = "401" ]; then
  if [ -z "${OPENCODE_SERVER_PASSWORD:-}" ]; then
    echo "OpenCode is already running. Set OPENCODE_SERVER_PASSWORD to its existing password, then rerun."
    exit 1
  fi
  if ! curl -fsS -u "opencode:${OPENCODE_SERVER_PASSWORD}" http://127.0.0.1:4096/global/health >/dev/null; then
    echo "The supplied OPENCODE_SERVER_PASSWORD does not match the running server."
    exit 1
  fi
  echo "Using the already-running OpenCode server."
else
  if [ -z "${OPENCODE_SERVER_PASSWORD:-}" ]; then
    export OPENCODE_SERVER_PASSWORD="$(openssl rand -hex 24)"
    echo
    echo "OpenCode server password (save this):"
    echo "$OPENCODE_SERVER_PASSWORD"
    echo
  else
    export OPENCODE_SERVER_PASSWORD
  fi

  nohup opencode serve --hostname 127.0.0.1 --port 4096 >/tmp/opencode-server.log 2>&1 &
  echo "Starting OpenCode server..."
  for i in $(seq 1 30); do
    if curl -fsS -u "opencode:${OPENCODE_SERVER_PASSWORD}" http://127.0.0.1:4096/global/health >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ! curl -fsS -u "opencode:${OPENCODE_SERVER_PASSWORD}" http://127.0.0.1:4096/global/health >/dev/null 2>&1; then
    echo "OpenCode did not start. Log:"
    cat /tmp/opencode-server.log
    exit 1
  fi
fi

echo
echo "Starting free Cloudflare Quick Tunnel."
echo "Keep this terminal running. The generated URL changes when restarted."
echo "Use username: opencode"
echo "Use the password printed above (or OPENCODE_SERVER_PASSWORD)."
echo
npx --yes wrangler@latest tunnel quick-start http://127.0.0.1:4096
