import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

const port = process.env.EXPO_PORT ?? "8081";
const cliPath = path.join(process.cwd(), "node_modules", "expo", "bin", "cli");
let child: ChildProcess | undefined;
let shuttingDown = false;
let restartTimer: ReturnType<typeof setTimeout> | undefined;

function startMetro() {
  if (shuttingDown) return;

  child = spawn(
    process.execPath,
    [cliPath, "start", "--web", "--offline", "--port", port],
    {
      env: {
        ...process.env,
        EXPO_USE_METRO_WORKSPACE_ROOT: "1",
      },
      stdio: "inherit",
    },
  );

  child.once("error", (error) => {
    if (!shuttingDown) {
      console.error(`[Metro supervisor] failed to start: ${error.message}`);
    }
  });

  child.once("exit", (code, signal) => {
    child = undefined;
    if (shuttingDown) {
      process.exit(code ?? 0);
    }

    console.warn(
      `[Metro supervisor] Expo exited (code=${code ?? "null"}, signal=${signal ?? "none"}); restarting in 1s`,
    );
    restartTimer = setTimeout(startMetro, 1000);
  });
}

function stopMetro(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (restartTimer) clearTimeout(restartTimer);
  if (child && !child.killed) child.kill(signal);
  else process.exit(0);
}

process.once("SIGINT", () => stopMetro("SIGINT"));
process.once("SIGTERM", () => stopMetro("SIGTERM"));

startMetro();
