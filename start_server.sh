#!/bin/bash
# 开发服务器启动脚本
echo "🚀 启动USIS Brain开发服务器..."
export ENABLE_TELEGRAM=false
export NODE_ENV=development
node index.js
