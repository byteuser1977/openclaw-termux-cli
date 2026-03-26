import fs from 'fs-extra';
import path from 'path';

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export function writeFile(filePath: string, content: string): void {
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

export function copyFile(source: string, target: string): void {
  fs.ensureDirSync(path.dirname(target));
  fs.copySync(source, target);
}

export function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function getFiles(dir: string, pattern: string = '**/*'): string[] {
  const glob = require('glob');
  return glob.sync(pattern, { cwd: dir, nodir: true });
}
