#!/bin/bash
# USIS Brain v3 Daemon - Auto-restart on crash

while true; do
  echo "🚀 Starting USIS Brain v3 at $(date)"
  node index.js
  EXIT_CODE=$?
  echo "⚠️ Process exited with code $EXIT_CODE at $(date)"
  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Clean exit, stopping daemon"
    break
  fi
  echo "🔄 Restarting in 5 seconds..."
  sleep 5
done
