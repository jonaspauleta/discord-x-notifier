module.exports = {
  apps: [
    {
      name: "discord-x-notifier",
      script: "dist/index.js",
      restart_delay: 5000,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
