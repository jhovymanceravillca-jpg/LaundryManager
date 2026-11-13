module.exports = {
  apps: [{
    name: 'laundry-manager-api',
    script: 'dist/server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '300M',
    env_production: { NODE_ENV: 'production' }
  }]
};
