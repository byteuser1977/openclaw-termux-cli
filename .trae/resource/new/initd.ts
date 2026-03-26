import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { colorize, isRich, theme } from "../terminal/theme.js";
import { formatGatewayServiceDescription } from "./constants.js";
import type { GatewayServiceRuntime } from "./service-runtime.js";
import { resolveHomeDir } from "./paths.js";

const toPosixPath = (value: string) => value.replace(/\\/g, "/");

const formatLine = (label: string, value: string) => {
  const rich = isRich();
  return `${colorize(rich, theme.muted, `${label}:`)} ${colorize(rich, theme.command, value)}`;
};

function resolveInitdScriptPath(env: Record<string, string | undefined>): string {
  const home = toPosixPath(resolveHomeDir(env));
  return path.posix.join(home, ".init.d", "openclaw-gateway");
}

function resolvePidFilePath(env: Record<string, string | undefined>): string {
  const home = toPosixPath(resolveHomeDir(env));
  return path.posix.join(home, ".openclaw", "gateway.pid");
}

function resolveLogFilePath(env: Record<string, string | undefined>): string {
  const home = toPosixPath(resolveHomeDir(env));
  return path.posix.join(home, ".openclaw", "gateway.log");
}

function buildInitdScript({
  description,
  programArguments,
  workingDirectory,
  environment,
  pidFile,
  logFile,
}: {
  description: string;
  programArguments: string[];
  workingDirectory?: string;
  environment?: Record<string, string | undefined>;
  pidFile: string;
  logFile: string;
}): string {
  const envVars = Object.entries(environment || {})
    .map(([key, value]) => `export ${key}="${value || ""}"`)
    .join("\n");

  const cmd = programArguments.map((arg) => `"${arg}"`).join(" ");
  const workDir = workingDirectory || '$(dirname "$0")';

  return `#!/bin/sh
### BEGIN INIT INFO
# Provides:          openclaw-gateway
# Required-Start:    $remote_fs $syslog
# Required-Stop:     $remote_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: OpenClaw Gateway Service
# Description:       ${description}
### END INIT INFO

PIDFILE="${pidFile}"
LOGFILE="${logFile}"
WORKDIR="${workDir}"
CMD="${cmd}"

${envVars}

case "$1" in
  start)
    echo "Starting OpenClaw Gateway service..."
    if [ -f "$PIDFILE" ]; then
      if kill -0 $(cat "$PIDFILE") 2>/dev/null; then
        echo "Service already running"
        exit 0
      fi
      rm -f "$PIDFILE"
    fi
    cd "$WORKDIR"
    nohup $CMD > "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    echo "Service started with PID $(cat "$PIDFILE")"
    ;;
  stop)
    echo "Stopping OpenClaw Gateway service..."
    if [ ! -f "$PIDFILE" ]; then
      echo "Service not running"
      exit 0
    fi
    if kill $(cat "$PIDFILE") 2>/dev/null; then
      rm -f "$PIDFILE"
      echo "Service stopped"
    else
      echo "Failed to stop service"
      exit 1
    fi
    ;;
  restart)
    $0 stop
    sleep 1
    $0 start
    ;;
  status)
    if [ -f "$PIDFILE" ]; then
      if kill -0 $(cat "$PIDFILE") 2>/dev/null; then
        echo "Service running with PID $(cat "$PIDFILE")"
        exit 0
      else
        echo "Service not running but PID file exists"
        exit 1
      fi
    else
      echo "Service not running"
      exit 3
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 2
    ;;
esac
`;
}

async function executeCommand(
  command: string,
  args: string[],
  options?: { encoding: BufferEncoding },
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, options ?? { encoding: "utf-8" }, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout?.toString() ?? "");
      }
    });
  });
}

async function assertInitdAvailable() {
  // init.d is always available on systems that don't have systemd
  // No need for special checks
}

export async function installInitdService({
  env,
  stdout,
  programArguments,
  workingDirectory,
  environment,
  description,
}: {
  env: Record<string, string | undefined>;
  stdout: NodeJS.WritableStream;
  programArguments: string[];
  workingDirectory?: string;
  environment?: Record<string, string | undefined>;
  description?: string;
}): Promise<{ scriptPath: string }> {
  await assertInitdAvailable();

  const scriptPath = resolveInitdScriptPath(env);
  const pidFile = resolvePidFilePath(env);
  const logFile = resolveLogFilePath(env);

  await fs.mkdir(path.dirname(scriptPath), { recursive: true });
  await fs.mkdir(path.dirname(pidFile), { recursive: true });

  const serviceDescription =
    description ??
    formatGatewayServiceDescription({
      profile: env.OPENCLAW_PROFILE,
      version: environment?.OPENCLAW_SERVICE_VERSION ?? env.OPENCLAW_SERVICE_VERSION,
    });

  const script = buildInitdScript({
    description: serviceDescription,
    programArguments,
    workingDirectory,
    environment,
    pidFile,
    logFile,
  });

  await fs.writeFile(scriptPath, script, "utf8");
  await fs.chmod(scriptPath, 0o755);

  // 创建到 /etc/init.d/ 的链接
  const etcInitdPath = "/etc/init.d/openclaw-gateway";
  try {
    // 尝试删除已存在的链接
    await fs.unlink(etcInitdPath).catch(() => {});
    // 创建符号链接
    await fs.symlink(scriptPath, etcInitdPath);
    stdout.write(`${formatLine("Linked to system init.d", etcInitdPath)}\n`);
  } catch (error) {
    stdout.write(`Warning: Failed to create symlink in /etc/init.d/: ${String(error)}\n`);
    stdout.write("You may need to run this command with sudo privileges\n");
  }

  // 启动服务
  const startResult = await executeCommand(scriptPath, ["start"], {
    encoding: "utf8",
  });

  stdout.write("\n");
  stdout.write(`${formatLine("Installed init.d service", scriptPath)}\n`);
  stdout.write(`${startResult}\n`);

  return { scriptPath };
}

export async function uninstallInitdService({
  env,
  stdout,
}: {
  env: Record<string, string | undefined>;
  stdout: NodeJS.WritableStream;
}): Promise<void> {
  await assertInitdAvailable();

  const scriptPath = resolveInitdScriptPath(env);
  const etcInitdPath = "/etc/init.d/openclaw-gateway";

  try {
    // 停止服务
    await executeCommand(scriptPath, ["stop"], {
      encoding: "utf8",
    });
  } catch {
    // 忽略停止错误
  }

  try {
    await fs.unlink(scriptPath);
    stdout.write(`${formatLine("Removed init.d service", scriptPath)}\n`);
  } catch {
    stdout.write(`Init.d service not found at ${scriptPath}\n`);
  }

  // 删除 /etc/init.d/ 中的链接
  try {
    await fs.unlink(etcInitdPath);
    stdout.write(`${formatLine("Removed system init.d link", etcInitdPath)}\n`);
  } catch (error) {
    stdout.write(`Warning: Failed to remove symlink in /etc/init.d/: ${String(error)}\n`);
  }
}

export async function stopInitdService({
  stdout,
  env,
}: {
  stdout: NodeJS.WritableStream;
  env?: Record<string, string | undefined>;
}): Promise<void> {
  await assertInitdAvailable();

  const scriptPath = resolveInitdScriptPath(env ?? {});
  const result = await executeCommand(scriptPath, ["stop"], {
    encoding: "utf8",
  });
  stdout.write(`${result}\n`);
  stdout.write(`${formatLine("Stopped init.d service", scriptPath)}\n`);
}

export async function restartInitdService({
  stdout,
  env,
}: {
  stdout: NodeJS.WritableStream;
  env?: Record<string, string | undefined>;
}): Promise<void> {
  await assertInitdAvailable();

  const scriptPath = resolveInitdScriptPath(env ?? {});
  const result = await executeCommand(scriptPath, ["restart"], {
    encoding: "utf8",
  });
  stdout.write(`${result}\n`);
  stdout.write(`${formatLine("Restarted init.d service", scriptPath)}\n`);
}

export async function isInitdServiceEnabled(args: {
  env?: Record<string, string | undefined>;
}): Promise<boolean> {
  const scriptPath = resolveInitdScriptPath(args.env ?? {});
  try {
    await fs.access(scriptPath);
    return true;
  } catch {
    return false;
  }
}

export async function readInitdServiceRuntime(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Promise<GatewayServiceRuntime> {
  const scriptPath = resolveInitdScriptPath(env);

  try {
    await fs.access(scriptPath);
  } catch {
    return {
      status: "stopped",
      detail: "Init.d script not found",
    };
  }

  try {
    const result = await executeCommand(scriptPath, ["status"], {
      encoding: "utf8",
    });

    if (result.includes("running")) {
      const pidMatch = result.match(/PID (\d+)/);
      const pid = pidMatch ? parseInt(pidMatch[1], 10) : undefined;
      return {
        status: "running",
        pid,
      };
    } else {
      return {
        status: "stopped",
      };
    }
  } catch (error) {
    const e = error as {
      code?: number;
      message?: string;
    };

    if (e.code === 3) {
      return {
        status: "stopped",
      };
    }

    return {
      status: "unknown",
      detail: e.message || String(error),
    };
  }
}

export async function readInitdServiceCommand(env: Record<string, string | undefined>): Promise<{
  programArguments: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
  sourcePath?: string;
} | null> {
  const scriptPath = resolveInitdScriptPath(env);
  try {
    const content = await fs.readFile(scriptPath, "utf8");

    let cmdLine = "";
    let workingDirectory = "";
    const environment: Record<string, string> = {};

    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (line.startsWith("CMD=")) {
        cmdLine = line.slice("CMD=".length).trim();
        // 移除引号
        cmdLine = cmdLine.replace(/^"|"$/g, "");
      } else if (line.startsWith("WORKDIR=")) {
        workingDirectory = line.slice("WORKDIR=".length).trim();
        workingDirectory = workingDirectory.replace(/^"|"$/g, "");
      } else if (line.startsWith("export ")) {
        const match = line.match(/export (\w+)="(.*)"/);
        if (match) {
          environment[match[1]] = match[2];
        }
      }
    }

    if (!cmdLine) return null;

    // 解析命令参数
    const programArguments = [];
    let currentArg = "";
    let inQuotes = false;

    for (let i = 0; i < cmdLine.length; i++) {
      const char = cmdLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === " " && !inQuotes) {
        if (currentArg) {
          programArguments.push(currentArg);
          currentArg = "";
        }
      } else {
        currentArg += char;
      }
    }

    if (currentArg) {
      programArguments.push(currentArg);
    }

    return {
      programArguments,
      ...(workingDirectory ? { workingDirectory } : {}),
      ...(Object.keys(environment).length > 0 ? { environment } : {}),
      sourcePath: scriptPath,
    };
  } catch {
    return null;
  }
}

export async function isSystemctlAvailable(): Promise<boolean> {
  try {
    await executeCommand("systemctl", ["--version"], {
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
}
