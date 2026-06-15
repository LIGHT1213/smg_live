#!/usr/bin/env bash
# smg-live-relay 服务管理脚本
# 用法: manage.sh {start|stop|status|restart|log} [端口]
#
# relay 服务代码在 skill 内部 (../relay),无需额外配置即可用。
# 如需指向其他位置的 relay,用环境变量 RELAY_DIR 覆盖。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELAY_DIR="${RELAY_DIR:-$SKILL_DIR/relay}"
PID_FILE="$RELAY_DIR/.relay.pid"
LOG_FILE="$RELAY_DIR/.relay.log"
PORT="${2:-8080}"

_is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null
}

_cleanup_stale() {
  pkill -f "node $RELAY_DIR/server.js" 2>/dev/null || true
  pkill -9 -f "Google Chrome for Testing" 2>/dev/null || true
  sleep 1
}

_current_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "(未知)"
}

case "${1:-}" in
  start)
    if _is_running; then
      echo "已在运行 (PID $(cat "$PID_FILE"))"
      echo "播放地址: http://$(_current_ip):$PORT/live.m3u8"
      exit 0
    fi
    _cleanup_stale
    if [ ! -d "$RELAY_DIR" ]; then
      echo "❌ 找不到 relay 目录: $RELAY_DIR"
      echo "   请用 RELAY_DIR 环境变量指定。"
      exit 1
    fi
    if [ ! -f "$RELAY_DIR/server.js" ]; then
      echo "❌ relay 目录中找不到 server.js: $RELAY_DIR"
      exit 1
    fi
    cd "$RELAY_DIR"
    [ -d node_modules ] || { echo "首次运行,正在安装依赖 (puppeteer + Chromium,约 150MB)..."; npm install >/dev/null 2>&1 || { echo "❌ npm install 失败"; exit 1; }; }
    env -u HTTP_PROXY -u HTTPS_PROXY PORT="$PORT" nohup node server.js > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "启动中 (PID $(cat "$PID_FILE")),等待抓流..."
    for i in $(seq 1 20); do
      sleep 2
      if curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/live.m3u8" 2>/dev/null | grep -q 200; then
        echo "✅ 已就绪"
        echo "本机:   http://localhost:$PORT/live.m3u8"
        echo "局域网: http://$(_current_ip):$PORT/live.m3u8"
        echo "日志:   $LOG_FILE"
        exit 0
      fi
      if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "❌ 进程已退出,日志末尾:"
        tail -5 "$LOG_FILE" 2>/dev/null
        rm -f "$PID_FILE"
        exit 1
      fi
    done
    echo "⚠️  40s 未就绪,查看日志: $LOG_FILE"
    exit 1
    ;;
  stop)
    if _is_running; then
      PID=$(cat "$PID_FILE")
      kill "$PID" 2>/dev/null || true
      _cleanup_stale
      rm -f "$PID_FILE"
      echo "已停止 (PID $PID)"
    else
      _cleanup_stale
      rm -f "$PID_FILE"
      echo "未在运行"
    fi
    ;;
  status)
    if _is_running; then
      echo "运行中 (PID $(cat "$PID_FILE"))"
      curl -s -o /dev/null -w "m3u8 可访问: HTTP %{http_code}\n" "http://127.0.0.1:$PORT/live.m3u8" 2>/dev/null || echo "m3u8 不可访问"
      echo "播放地址: http://$(_current_ip):$PORT/live.m3u8"
    else
      echo "未在运行"
      exit 1
    fi
    ;;
  restart)
    "$0" stop >/dev/null 2>&1 || true
    exec "$0" start "$PORT"
    ;;
  log)
    tail -n "${3:-30}" "$LOG_FILE" 2>/dev/null || echo "无日志"
    ;;
  *)
    echo "用法: $0 {start|stop|status|restart|log} [端口]"
    echo ""
    echo "环境变量:"
    echo "  RELAY_DIR  指定 relay 目录 (默认: skill 内的 relay/)"
    exit 1
    ;;
esac
