import { execFile } from "node:child_process";
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
      `#!/bin/sh
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
`
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
          callback(null, "Starting service...\nService started with PID 1234\n", "");
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
          callback(null, "Stopping service...\nService stopped\n", "");
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
          callback(null, "Stopping service...\nService stopped\n", "");
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
          callback(null, "Stopping service...\nStarting service...\nService started with PID 5678\n", "");
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
      mockFs.readFile.mockResolvedValue("#!/bin/sh\nPIDFILE=\"/tmp/test.pid\"\n");

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
