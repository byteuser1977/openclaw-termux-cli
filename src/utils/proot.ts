import path from 'node:path';
import fs from 'node:fs';

export function isRunningInProotDistro(): boolean {
  try {
    const comm = fs.readFileSync('/proc/1/comm', 'utf8').trim();
    if (comm === 'proot' || comm.includes('proot')) {
      return true;
    }
  } catch {}
  try {
    const cmdline = fs.readFileSync('/proc/1/cmdline', 'utf8');
    if (cmdline.includes('proot')) {
      return true;
    }
  } catch {}
  try {
    const exePath = fs.readlinkSync('/proc/1/exe');
    if (exePath.includes('proot')) {
      return true;
    }
  } catch {}
  try {
    const mountInfo = fs.readFileSync('/proc/self/mountinfo', 'utf8');
    if (mountInfo.includes('proot')) {
      return true;
    }
  } catch {}
  const termuxRoot = '/data/data/com.termux/files/usr';
  if (
    fs.existsSync(path.join(termuxRoot, 'bin', 'proot')) ||
    fs.existsSync(path.join(termuxRoot, 'bin', 'proot-distro')) ||
    fs.existsSync(termuxRoot)
  ) {
    return true;
  }
  if (process.env.PROOT_DISTRO || process.env.PROOT_NO_SECCOMP) {
    return true;
  }
  return false;
}

export function isRunningInAidlux(): boolean {
  if (process.env.AIDLUX_TYPE) {
    return true;
  }
  try {
    const comm = fs.readFileSync('/proc/1/comm', 'utf8').trim();
    if (comm.includes('aidboot')) {
      return true;
    }
  } catch {}
  try {
    const cmdline = fs
      .readFileSync('/proc/1/cmdline', 'utf8')
      .replace(new RegExp(String.fromCharCode(0), 'g'), '');
    if (cmdline.includes('aidboot')) {
      return true;
    }
  } catch {}
  try {
    const exePath = fs.readlinkSync('/proc/1/exe');
    if (exePath.includes('aidboot')) {
      return true;
    }
  } catch {}
  if (fs.existsSync('/data/data/com.aidlux')) {
    return true;
  }
  const aidbootPaths = [
    '/system/bin/aidboot',
    '/system/xbin/aidboot',
    '/data/data/com.aidlux/files/usr/bin/aidboot',
    '/data/local/tmp/aidboot',
  ];
  for (const p of aidbootPaths) {
    if (fs.existsSync(p)) {
      return true;
    }
  }
  return false;
}

export function isRunningInTermux(): boolean {
  if (isRunningInProotDistro() || isRunningInAidlux()) {
    return true;
  }
  return Boolean(
    process.env.TERMUX_VERSION ||
    process.env.TERMUX_MAIN_PACKAGE_FORMAT ||
    process.env.TERMUX_PREFIX ||
    process.env.PREFIX?.startsWith('/data/data/com.termux') ||
    process.env.ANDROID_ROOT?.includes('com.termux'),
  );
}