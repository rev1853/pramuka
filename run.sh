#!/usr/bin/env bash
# Install dependencies and run the Pramuka Quiz host with PM2.
# Usage:
#   ./run.sh            # install deps + build + (re)start server under PM2
#   ./run.sh install    # only install deps + build
#   ./run.sh start      # only start under PM2 (assumes deps + build are done)
#   ./run.sh stop       # stop the PM2 process
#   ./run.sh logs       # tail PM2 logs
#   ./run.sh restart    # restart under PM2 (no reinstall)
set -euo pipefail

APP_NAME="pramuka-quiz"
PORT="${PORT:-3005}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors (only when attached to a terminal)
if [ -t 1 ]; then
  C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'; C_RESET=$'\033[0m'
else
  C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_RESET=""
fi

log()  { printf "%s[%s]%s %s\n" "$C_BLUE" "$(date +%H:%M:%S)" "$C_RESET" "$*"; }
ok()   { printf "%s[%s] ✓%s %s\n" "$C_GREEN" "$(date +%H:%M:%S)" "$C_RESET" "$*"; }
warn() { printf "%s[%s] !%s %s\n" "$C_YELLOW" "$(date +%H:%M:%S)" "$C_RESET" "$*"; }
err()  { printf "%s[%s] ✗%s %s\n" "$C_RED" "$(date +%H:%M:%S)" "$C_RESET" "$*" >&2; }

require() {
  command -v "$1" >/dev/null 2>&1 || { err "$1 not found. Please install it first."; exit 1; }
}

install_deps() {
  log "Installing root dependencies…"
  npm install
  log "Installing server dependencies…"
  npm install --prefix server
  log "Installing client dependencies…"
  npm install --prefix client
  ok "Dependencies installed."
}

build_client() {
  log "Building client (vite build)…"
  npm run build --prefix client
  ok "Client built into client/dist."
}

pm2_start() {
  require pm2
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    warn "PM2 process '$APP_NAME' already exists. Restarting…"
    pm2 restart "$APP_NAME" --update-env
  else
    log "Starting server under PM2 (port $PORT)…"
    # Use the ecosystem config so the process metadata is persisted.
    pm2 start "$ROOT_DIR/ecosystem.config.cjs" --update-env
    pm2 save
  fi
  ok "Server running. App: http://localhost:$PORT"
  echo
  pm2 status
}

pm2_stop() {
  require pm2
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 stop "$APP_NAME" && pm2 delete "$APP_NAME" && pm2 save
    ok "Stopped and removed '$APP_NAME'."
  else
    warn "No PM2 process named '$APP_NAME' is running."
  fi
}

pm2_logs() {
  require pm2
  pm2 logs "$APP_NAME" --lines 200
}

pm2_restart() {
  require pm2
  pm2 restart "$APP_NAME" --update-env && ok "Restarted '$APP_NAME'."
}

case "${1:-all}" in
  install)
    install_deps
    build_client
    ;;
  start)
    pm2_start
    ;;
  stop)
    pm2_stop
    ;;
  restart)
    pm2_restart
    ;;
  logs)
    pm2_logs
    ;;
  all)
    install_deps
    build_client
    pm2_start
    ;;
  *)
    cat <<EOF
Usage: $0 {install|start|stop|restart|logs|all}
  install   Install all deps + build the client
  start     Start the server under PM2
  stop      Stop and remove the PM2 process
  restart   Restart the PM2 process
  logs      Tail PM2 logs
  all       (default) install + build + start
EOF
    exit 1
    ;;
esac