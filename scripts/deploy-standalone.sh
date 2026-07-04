#!/usr/bin/env bash
# CloudMantou standalone 生产部署脚本（非 Docker）
# 用法：在项目根目录执行  bash scripts/deploy-standalone.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="${PM2_APP_NAME:-cloudmantou}"
NODE_MIN_MAJOR=20

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令: $1"
}

check_node() {
  require_cmd node
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [ "$major" -lt "$NODE_MIN_MAJOR" ]; then
    die "需要 Node >= ${NODE_MIN_MAJOR}，当前: $(node -v)"
  fi
}

check_env() {
  local missing=()
  for key in DATABASE_URL AUTH_SECRET CARD_SECRET_SALT SETTINGS_ENCRYPTION_KEY SITE_URL; do
    if [ -z "${!key:-}" ]; then
      if [ -f .env ] && grep -q "^${key}=" .env 2>/dev/null; then
        continue
      fi
      missing+=("$key")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    die "缺少环境变量: ${missing[*]}（请在 .env 或 shell 中配置）"
  fi
}

load_dotenv() {
  if [ -f .env ]; then
    log "加载 .env"
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
}

install_deps() {
  require_cmd pnpm
  log "安装依赖..."
  pnpm install --frozen-lockfile
}

run_migrate() {
  log "执行数据库迁移..."
  npx prisma migrate deploy
}

build_app() {
  log "构建生产包..."
  pnpm build
}

stage_standalone() {
  log "复制 static / public 到 standalone..."
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public
  mkdir -p .next/standalone/public/uploads
}

restart_pm2() {
  local server_js="$ROOT_DIR/.next/standalone/server.js"
  [ -f "$server_js" ] || die "未找到 $server_js，请先 build"

  if command -v pm2 >/dev/null 2>&1; then
    log "通过 PM2 重启 $APP_NAME..."
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
      pm2 restart "$APP_NAME" --update-env
    else
      cd .next/standalone
      pm2 start server.js --name "$APP_NAME" --cwd "$ROOT_DIR/.next/standalone"
      cd "$ROOT_DIR"
    fi
    pm2 save || true
  else
    log "未安装 PM2，请手动启动:"
    log "  cd .next/standalone && NODE_ENV=production node server.js"
  fi
}

main() {
  log "开始部署 CloudMantou @ $(git describe --tags --always 2>/dev/null || echo 'unknown')"
  check_node
  load_dotenv
  check_env
  install_deps
  run_migrate
  build_app
  stage_standalone
  restart_pm2
  log "部署完成。"
}

main "$@"