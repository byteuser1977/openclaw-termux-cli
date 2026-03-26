import { isRunningInProotDistro, isRunningInAidlux as checkAidlux, isRunningInTermux as checkRunningInTermux } from '../utils/proot';

export function isTermux(): boolean {
  return process.env.TERMUX_VERSION !== undefined;
}

export function isAidlux(): boolean {
  return process.env.AIDLUX_VERSION !== undefined;
}

export function isRunningInProot(): boolean {
  return isRunningInProotDistro();
}

export function isRunningInTermux(): boolean {
  return checkRunningInTermux();
}

export function isRunningInAidlux(): boolean {
  return checkAidlux();
}

export function getEnvironment(): string {
  if (isTermux()) {
    return 'termux';
  } else if (isAidlux()) {
    return 'aidlux';
  } else {
    return 'other';
  }
}

export function getEnvironmentSpecificConfig(): Record<string, any> {
  const env = getEnvironment();

  switch (env) {
    case 'termux':
      return {
        pathSeparator: '/',
        homeDir: process.env.HOME || '/data/data/com.termux/files/home',
        nodePath: '/data/data/com.termux/files/usr/bin/node'
      };
    case 'aidlux':
      return {
        pathSeparator: '/',
        homeDir: process.env.HOME || '/root',
        nodePath: '/usr/bin/node'
      };
    case 'ubuntu':
      return {
        pathSeparator: '/',
        homeDir: process.env.HOME || '/home',
        nodePath: '/usr/bin/node'
      };
    default:
      return {
        pathSeparator: process.platform === 'win32' ? '\\' : '/',
        homeDir: process.env.HOME || process.env.USERPROFILE || '/',
        nodePath: process.execPath
      };
  }
}