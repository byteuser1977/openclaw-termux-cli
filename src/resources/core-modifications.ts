export interface FileModification {
  description: string;
  oldSegment: string;
  newSegment: string;
}

export const CORE_MODIFICATIONS: Record<string, FileModification> = {
  'src/entry.ts': {
    description: '入口文件调整 - 添加 os-overload 支持',
    oldSegment: `#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

import { applyCliProfileEnv, parseCliProfileArgs } from "./cli/profile.js";`,
    newSegment: `#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

// Override os.networkInterfaces() method to resolve permission issues
import { overloadOsNetworkInterfaces } from "./utils/os-overload.js";
overloadOsNetworkInterfaces();


import { applyCliProfileEnv, parseCliProfileArgs } from "./cli/profile.js";`
  },

  'src/entry.ts.title': {
    description: '入口文件标题调整',
    oldSegment: `process.title = "openclaw-cn";`,
    newSegment: `process.title = "openclaw-termux";`
  },

  'src/entry.ts.errorPrefix': {
    description: '入口文件错误信息前缀调整',
    oldSegment: `[openclaw-cn]`,
    newSegment: `[openclaw-termux]`
  },

  'src/daemon/service.ts.imports': {
    description: '守护进程服务 - 添加 initd 导入',
    oldSegment: `import {
  installSystemdService,
  isSystemdServiceEnabled,
  readSystemdServiceExecStart,
  readSystemdServiceRuntime,
  restartSystemdService,
  stopSystemdService,
  uninstallSystemdService,
} from "./systemd.js";`,
    newSegment: `import {
  installSystemdService,
  isSystemdServiceEnabled,
  readSystemdServiceExecStart,
  readSystemdServiceRuntime,
  restartSystemdService,
  stopSystemdService,
  uninstallSystemdService,
} from "./systemd.js";

import {
  installInitdService,
  uninstallInitdService,
  stopInitdService,
  restartInitdService,
  isInitdServiceEnabled,
  readInitdServiceCommand,
  readInitdServiceRuntime,
} from "./initd.js";
import { isRunningInTermux } from "./proot.js";`
  },

  'src/daemon/service.ts.linuxBranch': {
    description: '守护进程服务 - Linux 分支添加 Termux 判断',
    oldSegment: `  if (process.platform === "linux") {
    return {
      label: "systemd",
      loadedText: "enabled",
      notLoadedText: "disabled",
      install: async (args) => {
        await installSystemdService(args);
      },
      uninstall: async (args) => {
        await uninstallSystemdService(args);
      },
      stop: async (args) => {
        await stopSystemdService({
          stdout: args.stdout,
          env: args.env,
        });
      },
      restart: async (args) => {
        await restartSystemdService({
          stdout: args.stdout,
          env: args.env,
        });
      },
      isLoaded: async (args) => isSystemdServiceEnabled(args),
      readCommand: readSystemdServiceExecStart,
      readRuntime: async (env) => await readSystemdServiceRuntime(env),
    };
  }`,
    newSegment: `  if (process.platform === "linux") {
    if (isRunningInTermux()) {
      return {
        label: "initd",
        loadedText: "installed",
        notLoadedText: "not installed",
        install: async (args) => {
          await installInitdService(args);
        },
        uninstall: async (args) => {
          await uninstallInitdService(args);
        },
        stop: async (args) => {
          await stopInitdService({
            stdout: args.stdout,
            env: args.env,
          });
        },
        restart: async (args) => {
          await restartInitdService({
            stdout: args.stdout,
            env: args.env,
          });
        },
        isLoaded: async (args) => isInitdServiceEnabled(args),
        readCommand: readInitdServiceCommand,
        readRuntime: async (env) => await readInitdServiceRuntime(env),
      };
    }
    return {
      label: "systemd",
      loadedText: "enabled",
      notLoadedText: "disabled",
      install: async (args) => {
        await installSystemdService(args);
      },
      uninstall: async (args) => {
        await uninstallSystemdService(args);
      },
      stop: async (args) => {
        await stopSystemdService({
          stdout: args.stdout,
          env: args.env,
        });
      },
      restart: async (args) => {
        await restartSystemdService({
          stdout: args.stdout,
          env: args.env,
        });
      },
      isLoaded: async (args) => isSystemdServiceEnabled(args),
      readCommand: readSystemdServiceExecStart,
      readRuntime: async (env) => await readSystemdServiceRuntime(env),
    };
  }`
  },

  'src/wizard/onboarding.finalize.ts.imports': {
    description: '向导完成 - 添加 Termux 检测导入',
    oldSegment: `import { isSystemdUserServiceAvailable } from "../daemon/systemd.js";
import { ensureControlUiAssetsBuilt } from "../infra/control-ui-assets.js";
import type { RuntimeEnv } from "../runtime.js";`,
    newSegment: `import { isSystemdUserServiceAvailable } from "../daemon/systemd.js";
import { ensureControlUiAssetsBuilt } from "../infra/control-ui-assets.js";

import { isRunningInTermux } from "../daemon/proot.js";

import type { RuntimeEnv } from "../runtime.js";`
  },

  'src/wizard/onboarding.finalize.ts.systemdAvailable': {
    description: '向导完成 - systemdAvailable 检测增加 Termux 判断',
    oldSegment: `  const systemdAvailable =
    process.platform === "linux" ? await isSystemdUserServiceAvailable() : true;
  if (process.platform === "linux" && !systemdAvailable) {`,
    newSegment: `  const systemdAvailable =
    //  process.platform === "linux" ? await isSystemdUserServiceAvailable() : true;
    //if (process.platform === "linux" && !systemdAvailable) {
    process.platform === "linux" && !isRunningInTermux()
      ? await isSystemdUserServiceAvailable()
      : true;
  if (process.platform === "linux" && !isRunningInTermux() && !systemdAvailable) {`
  },

  'src/wizard/onboarding.finalize.ts.lingerCheck': {
    description: '向导完成 - linger 检查增加 Termux 判断',
    oldSegment: `  if (process.platform === "linux" && systemdAvailable) {`,
    newSegment: `  // if (process.platform === "linux" && systemdAvailable) {
  if (process.platform === "linux" && !isRunningInTermux() && systemdAvailable) {`
  },

  'src/wizard/onboarding.finalize.ts.installDaemon': {
    description: '向导完成 - installDaemon 判断增加 Termux 判断',
    oldSegment: `  } else if (process.platform === "linux" && !systemdAvailable) {
    installDaemon = false;`,
    newSegment: `  //  } else if (process.platform === "linux" && !systemdAvailable) {
  } else if (process.platform === "linux" && !isRunningInTermux() && !systemdAvailable) {
    installDaemon = false;`
  },

  'src/wizard/onboarding.finalize.ts.skipSystemd': {
    description: '向导完成 - 跳过 systemd 安装增加 Termux 判断',
    oldSegment: `  if (process.platform === "linux" && !systemdAvailable && installDaemon) {`,
    newSegment: `  //  if (process.platform === "linux" && !systemdAvailable && installDaemon) {
  if (process.platform === "linux" && !isRunningInTermux() && !systemdAvailable && installDaemon) {`
  },

  'src/infra/clawdbot-root.ts': {
    description: 'Clawdbot 根路径调整',
    oldSegment: `const CORE_PACKAGE_NAMES = new Set(["openclaw-cn"]);`,
    newSegment: `const CORE_PACKAGE_NAMES = new Set(["openclaw-cn-termuxcn-termux"]);`
  },

  'src/infra/path-env.ts': {
    description: '路径环境调整',
    oldSegment: `* Best-effort PATH bootstrap so skills that require the \`clawdbot-cn\` CLI can run`,
    newSegment: `* Best-effort PATH bootstrap so skills that require the \`clawdbot-termux\` CLI can run`,
  },

  'src/acp/server.ts': {
    description: 'ACP 服务器调整',
    oldSegment: ` console.log(\`Usage: openclaw-cn acp [options]`,
    newSegment: ` console.log(\`Usage: openclaw-termux acp [options]`
  },

  'src/cli/run-main.ts': {
    description: 'CLI 主运行调整',
    oldSegment: `console.error("[openclaw-cn] Uncaught exception:", formatUncaughtError(error));`,
    newSegment: `console.error("[openclaw-termux] Uncaught exception:", formatUncaughtError(error));`
  },

  'extensions/discord/src/runtime.ts': {
    description: 'Discord 运行时调整',
    oldSegment: `import type { PluginRuntime } from "openclaw-cn/plugin-sdk";`,
    newSegment: `import type { PluginRuntime } from "openclaw-cn-cn-termux/plugin-sdk";`
  }
};
