# 开发环境设置指南

## 问题诊断

您的应用配置为Cloud Run部署（`.replit`中的`deploymentTarget = "cloudrun"`）。Cloud Run是无服务器平台，会在没有HTTP流量时自动缩放到零实例，导致进程静默退出。

您的应用有以下后台活动，不适合Cloud Run：
- ✅ Telegram Bot长轮询
- ✅ 数据库连接池
- ✅ N8N定时健康检查

##解决方案

### 方案1: 开发环境本地运行（推荐用于测试）

在开发环境中直接运行Node.js，绕过Cloud Run：

```bash
# 设置环境变量
export ENABLE_DB=true
export ENABLE_TELEGRAM=true  
export NODE_ENV=development
export PRIMARY_MODEL=gpt-4o-turbo

# 前台运行（保持shell连接）
node index.js

# 或在新的tmux/screen session中运行
screen -S usis_brain
node index.js
# Ctrl+A, D to detach
```

### 方案2: 生产环境Reserved VM部署（推荐用于生产）

根据Replit文档，应使用**Reserved VM Deployment**来运行需要持续运行的应用。

Reserved VM特点：
- ✅ 单实例always-on虚拟机
- ✅ 支持后台进程和长连接
- ✅ 可预测的成本和性能
- ✅ 适合Bot、API服务器、数据库连接

修改`.replit`配置：

```toml
[deployment]
deploymentTarget = "gce"  # 改为Reserved VM
run = ["bash", "start_production.sh"]
```

然后通过Replit UI创建Reserved VM Deployment。

### 方案3: 保持Cloud Run活跃（临时方案）

如果必须使用Cloud Run，需要定期发送HTTP请求防止缩放到零：

```bash
# 创建keep-alive脚本
cat > keep_alive.sh << 'KEEPALIVE'
#!/usr/bin/env bash
while true; do
  curl -s http://localhost:5000/health > /dev/null
  sleep 30
done
KEEPALIVE

chmod +x keep_alive.sh

# 在后台运行
./keep_alive.sh &
node index.js
```

## 当前修复状态

✅ API超时保护已添加（OpenAI 15秒，Finnhub 10秒）
✅ 单实例启动脚本已创建
⚠️  Cloud Run限制导致进程退出（需要Reserved VM）

## 下一步

1. **开发测试**：在shell前台运行`node index.js`测试功能
2. **生产部署**：联系Replit支持或通过UI切换到Reserved VM Deployment
3. **Telegram测试**：确保服务运行后，在Telegram发送"TSLA"测试

