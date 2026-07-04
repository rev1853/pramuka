// PM2 process definition for the Pramuka Quiz host.
// The server (server/index.js) serves the built client from client/dist in production.
module.exports = {
  apps: [
    {
      name: 'pramuka-quiz',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3005,
      },
      max_restarts: 10,
      max_memory_restart: '512M',
      time: true,
    },
  ],
};