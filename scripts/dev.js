import { spawn } from "node:child_process";

const processes = [
  ["api", "node", ["server/index.js"]],
  ["web", "./node_modules/.bin/vite", ["--host", "127.0.0.1", "--port", "5174"]]
];

const children = processes.map(([name, command, args]) => {
  const child = spawn(command, args, {
    stdio: "inherit"
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown();
    }
  });

  return child;
});

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", shutdown);
