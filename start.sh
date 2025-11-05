#!/usr/bin/env bash
set -euo pipefail
echo "[USIS Brain] hard reload @$(date)"
echo -n "[USIS Brain] git rev: " && git rev-parse --short HEAD || true
pkill -9 node 2>/dev/null || true
sleep 1
# 若要更稳：短期改用 4o-turbo 做主脑
export PRIMARY_MODEL=${PRIMARY_MODEL:-gpt-4o-turbo}
NODE_ENV=production node index.js
