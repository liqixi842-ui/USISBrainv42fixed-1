#!/usr/bin/env bash
set -euo pipefail
echo "[USIS Brain] hard reload @$(date)"
echo -n "[USIS Brain] git rev: " && git rev-parse --short HEAD || true
pkill -9 node 2>/dev/null || true
sleep 1
NODE_ENV=production node index.js
