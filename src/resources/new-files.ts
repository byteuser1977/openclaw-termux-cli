export const NEW_FILES: Record<string, { content: string }> = {
  'src/daemon/initd.ts': {
    content: `import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { colorize, isRich, theme } from "../terminal/theme.js";
import { formatGatewayServiceDescription } from "./constants.js";
import type { GatewayServiceRuntime } from "./service-runtime.js";
import { resolveHomeDir } from "./paths.js";

const toPosixPath = (value: string) => value.replace(/\\\\/g, "/");

const formatLine = (label: string, value: string) => {
  const rich = isRich();
  return \`\${colorize(rich, theme.muted, \`\${label}:\`)} \${colorize(rich, theme.command, value)}\`;
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
    .map(([key, value]) => \`export \${key}="\${value || ""}"\`)
    .join("\\n");

  const cmd = programArguments.map((arg) => \`"\${arg}"\`).join(" ");
  const workDir = workingDirectory || '$(dirname "$0")';

  return \`#!/bin/sh
### BEGIN INIT INFO
# Provides:          openclaw-gateway
# Required-Start:    $remote_fs $syslog
# Required-Stop:     $remote_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: OpenClaw Gateway Service
# Description:       \${description}
### END INIT INFO

PIDFILE="\${pidFile}"
LOGFILE="\${logFile}"
WORKDIR="\${workDir}"
CMD="\${cmd}"

\${envVars}

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
\`;
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

  const etcInitdPath = "/etc/init.d/openclaw-gateway";
  try {
    await fs.unlink(etcInitdPath).catch(() => {});
    await fs.symlink(scriptPath, etcInitdPath);
    stdout.write(\`\${formatLine("Linked to system init.d", etcInitdPath)}\\n\`);
  } catch (error) {
    stdout.write(\`Warning: Failed to create symlink in /etc/init.d/: \${String(error)}\\n\`);
    stdout.write("You may need to run this command with sudo privileges\\n");
  }

  const startResult = await executeCommand(scriptPath, ["start"], {
    encoding: "utf8",
  });

  stdout.write("\\n");
  stdout.write(\`\${formatLine("Installed init.d service", scriptPath)}\\n\`);
  stdout.write(\`\${startResult}\\n\`);

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
    await executeCommand(scriptPath, ["stop"], {
      encoding: "utf8",
    });
  } catch {
  }

  try {
    await fs.unlink(scriptPath);
    stdout.write(\`\${formatLine("Removed init.d service", scriptPath)}\\n\`);
  } catch {
    stdout.write(\`Init.d service not found at \${scriptPath}\\n\`);
  }

  try {
    await fs.unlink(etcInitdPath);
    stdout.write(\`\${formatLine("Removed system init.d link", etcInitdPath)}\\n\`);
  } catch (error) {
    stdout.write(\`Warning: Failed to remove symlink in /etc/init.d/: \${String(error)}\\n\`);
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
  stdout.write(\`\${result}\\n\`);
  stdout.write(\`\${formatLine("Stopped init.d service", scriptPath)}\\n\`);
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
  stdout.write(\`\${result}\\n\`);
  stdout.write(\`\${formatLine("Restarted init.d service", scriptPath)}\\n\`);
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
      const pidMatch = result.match(/PID (\\d+)/);
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

    for (const rawLine of content.split("\\n")) {
      const line = rawLine.trim();
      if (line.startsWith("CMD=")) {
        cmdLine = line.slice("CMD=".length).trim();
        cmdLine = cmdLine.replace(/^"|"$/g, "");
      } else if (line.startsWith("WORKDIR=")) {
        workingDirectory = line.slice("WORKDIR=".length).trim();
        workingDirectory = workingDirectory.replace(/^"|"$/g, "");
      } else if (line.startsWith("export ")) {
        const match = line.match(/export (\\w+)="(.*)"/);
        if (match) {
          environment[match[1]] = match[2];
        }
      }
    }

    if (!cmdLine) return null;

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
`
  },

  'src/daemon/initd.test.ts': {
    content: `import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { vi, beforeEach, afterEach, describe, it, expect } from "vitest";
import {
  installInitdService,
  uninstallInitdService,
  stopInitdService,
  restartInitdService,
  isInitdServiceEnabled,
  readInitdServiceRuntime,
  readInitdServiceCommand,
  isSystemctlAvailable,
} from "./initd.js";
import { resolveHomeDir } from "./paths.js";

vi.mock("node:child_process");
vi.mock("node:fs/promises");
vi.mock("./paths.js");

const mockExecFile = vi.mocked(execFile);
const mockFs = vi.mocked(fs);
const mockResolveHomeDir = vi.mocked(resolveHomeDir);

describe("initd service", () => {
  const mockHomeDir = "/home/testuser";
  const mockEnv = {
    OPENCLAW_PROFILE: "default",
    OPENCLAW_SERVICE_VERSION: "1.0.0",
  };
  const mockStdout = {
    write: vi.fn(),
  } as unknown as NodeJS.WritableStream;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveHomeDir.mockReturnValue(mockHomeDir);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.chmod.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(
      \`#!/bin/sh
### BEGIN INIT INFO
# Provides:          openclaw-gateway
# Required-Start:    $remote_fs $syslog
# Required-Stop:     $remote_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: OpenClaw Gateway Service
# Description:       OpenClaw Gateway Service (default)
### END INIT INFO

PIDFILE="/home/testuser/.openclaw/gateway.pid"
LOGFILE="/home/testuser/.openclaw/gateway.log"
WORKDIR="/home/testuser"
CMD="node /home/testuser/openclaw-cn/src/index.js"

export OPENCLAW_PROFILE="default"
export OPENCLAW_SERVICE_VERSION="1.0.0"

case "$1" in
  start) echo "Starting service..."; ;;
  stop) echo "Stopping service..."; ;;
  restart) echo "Restarting service..."; ;;
  status) echo "Service running with PID 1234"; exit 0; ;;
esac
\`
    );
    mockExecFile.mockImplementation((command, args, options, callback) => {
      if (command === "systemctl" && args?.includes("--version")) {
        if (callback) {
          callback(new Error("Command not found"), undefined, undefined);
        }
        return {} as any;
      }
      if (callback) {
        callback(null, "Success", "");
      }
      return {} as any;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("isSystemctlAvailable", () => {
    it("should return false when systemctl is not available", async () => {
      mockExecFile.mockImplementationOnce((command, args, options, callback) => {
        if (callback) {
          callback(new Error("Command not found"), undefined, undefined);
        }
        return {} as any;
      });
      const result = await isSystemctlAvailable();
      expect(result).toBe(false);
    });

    it("should return true when systemctl is available", async () => {
      mockExecFile.mockImplementationOnce((command, args, options, callback) => {
        if (callback) {
          callback(null, "systemctl 252", "");
        }
        return {} as any;
      });
      const result = await isSystemctlAvailable();
      expect(result).toBe(true);
    });
  });

  describe("installInitdService", () => {
    it("should create init.d script and start service", async () => {
      const mockProgramArgs = ["node", "/home/testuser/openclaw-cn/src/index.js"];
      const mockWorkingDir = "/home/testuser/openclaw-cn";

      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, "Starting service...\\nService started with PID 1234\\n", "");
        }
        return {} as any;
      });

      const result = await installInitdService({
        env: mockEnv,
        stdout: mockStdout,
        programArguments: mockProgramArgs,
        workingDirectory: mockWorkingDir,
        environment: mockEnv,
      });

      expect(result.scriptPath).toBe("/home/testuser/.init.d/openclaw-gateway");
      expect(mockFs.mkdir).toHaveBeenCalledTimes(2);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/home/testuser/.init.d/openclaw-gateway",
        expect.stringContaining("#!/bin/sh"),
        "utf8"
      );
      expect(mockFs.chmod).toHaveBeenCalledWith(
        "/home/testuser/.init.d/openclaw-gateway",
        0o755
      );
      expect(mockExecFile).toHaveBeenCalledWith(
        "/home/testuser/.init.d/openclaw-gateway",
        ["start"],
        { encoding: "utf8" },
        expect.any(Function)
      );
      expect(mockStdout.write).toHaveBeenCalled();
    });
  });

  describe("uninstallInitdService", () => {
    it("should stop and remove init.d script", async () => {
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, "Stopping service...\\nService stopped\\n", "");
        }
        return {} as any;
      });

      await uninstallInitdService({
        env: mockEnv,
        stdout: mockStdout,
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        "/home/testuser/.init.d/openclaw-gateway",
        ["stop"],
        { encoding: "utf8" },
        expect.any(Function)
      );
      expect(mockFs.unlink).toHaveBeenCalledWith("/home/testuser/.init.d/openclaw-gateway");
      expect(mockStdout.write).toHaveBeenCalled();
    });

    it("should handle script not found error", async () => {
      mockFs.unlink.mockRejectedValue(new Error("ENOENT"));

      await uninstallInitdService({
        env: mockEnv,
        stdout: mockStdout,
      });

      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("Init.d service not found")
      );
    });
  });

  describe("stopInitdService", () => {
    it("should stop init.d service", async () => {
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, "Stopping service...\\nService stopped\\n", "");
        }
        return {} as any;
      });

      await stopInitdService({
        stdout: mockStdout,
        env: mockEnv,
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        "/home/testuser/.init.d/openclaw-gateway",
        ["stop"],
        { encoding: "utf8" },
        expect.any(Function)
      );
      expect(mockStdout.write).toHaveBeenCalled();
    });
  });

  describe("restartInitdService", () => {
    it("should restart init.d service", async () => {
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, "Stopping service...\\nStarting service...\\nService started with PID 5678\\n", "");
        }
        return {} as any;
      });

      await restartInitdService({
        stdout: mockStdout,
        env: mockEnv,
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        "/home/testuser/.init.d/openclaw-gateway",
        ["restart"],
        { encoding: "utf8" },
        expect.any(Function)
      );
      expect(mockStdout.write).toHaveBeenCalled();
    });
  });

  describe("isInitdServiceEnabled", () => {
    it("should return true when init.d script exists", async () => {
      const result = await isInitdServiceEnabled({ env: mockEnv });
      expect(result).toBe(true);
    });

    it("should return false when init.d script does not exist", async () => {
      mockFs.access.mockRejectedValue(new Error("ENOENT"));
      const result = await isInitdServiceEnabled({ env: mockEnv });
      expect(result).toBe(false);
    });
  });

  describe("readInitdServiceRuntime", () => {
    it("should return running status when service is running", async () => {
      mockExecFile.mockImplementationOnce((command, args, options, callback) => {
        if (callback) {
          callback(null, "Service running with PID 1234", "");
        }
        return {} as any;
      });

      const result = await readInitdServiceRuntime(mockEnv);

      expect(result.status).toBe("running");
      expect(result.pid).toBe(1234);
    });

    it("should return stopped status when service is not running", async () => {
      mockExecFile.mockImplementationOnce((command, args, options, callback) => {
        const error = new Error("Service not running") as any;
        error.code = 3;
        if (callback) {
          callback(error, "Service not running", "");
        }
        return {} as any;
      });

      const result = await readInitdServiceRuntime(mockEnv);

      expect(result.status).toBe("stopped");
    });

    it("should return stopped status when script not found", async () => {
      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      const result = await readInitdServiceRuntime(mockEnv);

      expect(result.status).toBe("stopped");
      expect(result.detail).toBe("Init.d script not found");
    });

    it("should return unknown status when error occurs", async () => {
      mockExecFile.mockImplementationOnce((command, args, options, callback) => {
        const error = new Error("Unknown error") as any;
        error.code = 1;
        if (callback) {
          callback(error, "", "Unknown error");
        }
        return {} as any;
      });

      const result = await readInitdServiceRuntime(mockEnv);

      expect(result.status).toBe("unknown");
      expect(result.detail).toBe("Unknown error");
    });
  });

  describe("readInitdServiceCommand", () => {
    it("should return command information from init.d script", async () => {
      const result = await readInitdServiceCommand(mockEnv);

      expect(result).toEqual({
        programArguments: ["node", "/home/testuser/openclaw-cn/src/index.js"],
        workingDirectory: "/home/testuser",
        environment: {
          OPENCLAW_PROFILE: "default",
          OPENCLAW_SERVICE_VERSION: "1.0.0",
        },
        sourcePath: "/home/testuser/.init.d/openclaw-gateway",
      });
    });

    it("should return null when no command found", async () => {
      mockFs.readFile.mockResolvedValue("#!/bin/sh\\nPIDFILE=\\"/tmp/test.pid\\"");

      const result = await readInitdServiceCommand(mockEnv);

      expect(result).toBeNull();
    });

    it("should return null when script not found", async () => {
      mockFs.readFile.mockRejectedValue(new Error("ENOENT"));

      const result = await readInitdServiceCommand(mockEnv);

      expect(result).toBeNull();
    });
  });
});
`
  },

  'src/daemon/proot.ts': {
    content: `import path from "node:path";
import fs from "node:fs";
export function isRunningInProotDistro() {
  try {
    const comm = fs.readFileSync("/proc/1/comm", "utf8").trim();
    if (comm === "proot" || comm.includes("proot")) {
      return true;
    }
  } catch {
  }
  try {
    const cmdline = fs.readFileSync("/proc/1/cmdline", "utf8");
    if (cmdline.includes("proot")) {
      return true;
    }
  } catch {
  }
  try {
    const exePath = fs.readlinkSync("/proc/1/exe");
    if (exePath.includes("proot")) {
      return true;
    }
  } catch {
  }
  try {
    const mountInfo = fs.readFileSync("/proc/self/mountinfo", "utf8");
    if (mountInfo.includes("proot")) {
      return true;
    }
  } catch {
  }
  const termuxRoot = "/data/data/com.termux/files/usr";
  if (
    fs.existsSync(path.join(termuxRoot, "bin", "proot")) ||
    fs.existsSync(path.join(termuxRoot, "bin", "proot-distro")) ||
    fs.existsSync(termuxRoot)
  ) {
    return true;
  }
  if (process.env.PROOT_DISTRO || process.env.PROOT_NO_SECCOMP) {
    return true;
  }
  return false;
}

export function isRunningInAidlux() {
  if (process.env.AIDLUX_TYPE) {
    return true;
  }
  try {
    const comm = fs.readFileSync("/proc/1/comm", "utf8").trim();
    if (comm.includes("aidboot")) {
      return true;
    }
  } catch {}
  try {
    const cmdline = fs
      .readFileSync("/proc/1/cmdline", "utf8")
      .replace(new RegExp(String.fromCharCode(0), "g"), "");
    if (cmdline.includes("aidboot")) {
      return true;
    }
  } catch {}
  try {
    const exePath = fs.readlinkSync("/proc/1/exe");
    if (exePath.includes("aidboot")) {
      return true;
    }
  } catch {}
  if (fs.existsSync("/data/data/com.aidlux")) {
    return true;
  }
  const aidbootPaths = [
    "/system/bin/aidboot",
    "/system/xbin/aidboot",
    "/data/data/com.aidlux/files/usr/bin/aidboot",
    "/data/local/tmp/aidboot",
  ];
  for (const p of aidbootPaths) {
    if (fs.existsSync(p)) {
      return true;
    }
  }
  return false;
}

export function isRunningInTermux() {
  if (isRunningInProotDistro() || isRunningInAidlux()) {
    return true;
  }
  const isTermux = Boolean(
    process.env.TERMUX_VERSION ||
    process.env.TERMUX_MAIN_PACKAGE_FORMAT ||
    process.env.TERMUX_PREFIX ||
    process.env.PREFIX?.startsWith("/data/data/com.termux") ||
    process.env.ANDROID_ROOT?.includes("com.termux"),
  );
  return isTermux;
}
`
  },

  'src/utils/network-interfaces.ts': {
    content: `import { spawnSync } from "node:child_process";
import os from "node:os";

export function getPrimaryIPv4Interfaces(): ReturnType<typeof os.networkInterfaces> {
  const tryNetworkInterfaces = (): ReturnType<typeof os.networkInterfaces> | null => {
    try {
      return os.networkInterfaces();
    } catch (error) {
      return null;
    }
  };

  const tryCommandLookup = (): Record<string, os.NetworkInterfaceInfo[]> => {
    const result: Record<string, os.NetworkInterfaceInfo[]> = {};
    const platform = os.platform();
    let command: string;
    let args: string[];

    if (platform === "win32") {
      command = "ipconfig";
      args = [];
    } else {
      command = "ifconfig";
      args = [];
    }

    try {
      const res = spawnSync(command, args, {
        encoding: "utf-8",
        timeout: 5000,
      });

      if (res.stdout && typeof res.stdout === "string") {
        const output = res.stdout;
        const ipv4Pattern = /inet\\s+([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3})/g;
        const matches = [...output.matchAll(ipv4Pattern)];
        const uniqueIPs = [...new Set(matches.map((m) => m[1]))].filter(
          (ip) => {
            const parts = ip.split(".");
            return (
              parts.length === 4 &&
              parts.every((p) => parseInt(p) >= 0 && parseInt(p) <= 255) &&
              !ip.startsWith("127.") &&
              !ip.startsWith("0.") &&
              !ip.startsWith("255.") &&
              !ip.endsWith(".255")
            );
          },
        );

        for (const ip of uniqueIPs) {
          const interfaceName = "eth0";
          result[interfaceName] = [
            {
              address: ip,
              netmask: "255.255.255.0",
              family: "IPv4" as const,
              mac: "00:00:00:00:00:00",
              internal: false,
              cidr: \`\${ip}/24\`,
            },
          ];
        }
      }
    } catch (error) {}

    return result;
  };

  const nets = tryNetworkInterfaces();
  if (nets) {
    return nets;
  }

  return tryCommandLookup();
}
`
  },

  'src/utils/os-overload.ts': {
    content: `import os from "node:os";
import { getPrimaryIPv4Interfaces } from "./network-interfaces.js";

const originalNetworkInterfaces = os.networkInterfaces;

export function overloadOsNetworkInterfaces(): void {
  os.networkInterfaces = function (this: typeof os): ReturnType<typeof os.networkInterfaces> {
    try {
      return originalNetworkInterfaces.call(this);
    } catch {
      return getPrimaryIPv4Interfaces();
    }
  } as typeof originalNetworkInterfaces;

  console.log("[openclaw-termux] os.networkInterfaces() method has been overloaded");
}

export function restoreOsNetworkInterfaces(): void {
  os.networkInterfaces = originalNetworkInterfaces;
  console.log("[openclaw-termux] os.networkInterfaces() method has been restored to its original implementation");
}
`
  }
};
