module.exports = {
  apps: [{
    name: 'usis-brain',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: '.env',
    node_args: '-r dotenv/config'
  }]
};
