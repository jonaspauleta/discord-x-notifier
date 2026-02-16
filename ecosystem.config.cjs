const { readFileSync } = require("fs");
const { resolve } = require("path");

let handles;
try {
  handles = JSON.parse(readFileSync(resolve(__dirname, "handles.json"), "utf-8"));
} catch {
  handles = [];
}

module.exports = {
  apps: handles.map((handle, index) => ({
    name: `discord-x-notifier-${handle.replace(/^@/, "")}`,
    script: "dist/index.js",
    restart_delay: 5000 + index * 5000,
    max_restarts: 10,
    env: {
      NODE_ENV: "production",
      HANDLE: handle.replace(/^@/, ""),
    },
  })),
};
