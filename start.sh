#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 没有检测到 Node.js，请先安装 Node.js 18 或更高版本。"
  exit 1
fi

node server/server.js
