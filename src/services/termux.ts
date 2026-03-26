export function isTermux(): boolean {
  return process.env.TERMUX_VERSION !== undefined;
}

export function isAidlux(): boolean {
  return process.env.AIDLUX_VERSION !== undefined;
}

export function isUbuntu(): boolean {
  return process.platform === 'linux' && !isTermux() && !isAidlux();
}

export function getEnvironment(): string {
  if (isTermux()) {
    return 'termux';
  } else if (isAidlux()) {
    return 'aidlux';
  } else if (isUbuntu()) {
    return 'ubuntu';
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
