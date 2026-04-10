module.exports = {
  apps: [
    {
      name: "nexo-api",
      cwd: "apps/api",
      script: "pnpm",
      args: "run start",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 10,
      autorestart: true,
      watch: false,
    },
    {
      name: "nexo-bots",
      cwd: "apps/bots",
      script: "pnpm",
      args: "run start",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 10,
      autorestart: true,
      watch: false,
    },
  ],
};
