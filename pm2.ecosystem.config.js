// PM2 Ecosystem 配置文件 - USIS Brain v5.1
// 使用: pm2 start pm2.ecosystem.config.js

module.exports = {
  apps: [{
    name: 'usis-brain',
    script: './index.js',
    
    // 实例配置
    instances: 1,  // 单实例（可根据CPU核心数调整）
    exec_mode: 'fork',
    
    // 自动重启策略
    watch: false,  // 生产环境不建议开启
    max_memory_restart: '2G',  // 内存超过2GB自动重启
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // 日志配置
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/var/log/usis-brain/error.log',
    out_file: '/var/log/usis-brain/output.log',
    merge_logs: true,
    
    // 重启策略
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // 优雅退出
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};

// 使用方法：
// 1. 创建日志目录: sudo mkdir -p /var/log/usis-brain
// 2. 启动应用: pm2 start pm2.ecosystem.config.js
// 3. 保存配置: pm2 save
// 4. 开机自启: pm2 startup
