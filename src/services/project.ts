import fs from 'fs-extra';
import path from 'path';

export interface ProjectConfig {
  name: string;
  version: string;
  description: string;
  main: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export function loadProjectConfig(projectPath: string): ProjectConfig {
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found');
  }
  
  return fs.readJSONSync(packageJsonPath);
}

export function saveProjectConfig(projectPath: string, config: ProjectConfig): void {
  const packageJsonPath = path.join(projectPath, 'package.json');
  fs.writeJSONSync(packageJsonPath, config, { spaces: 2 });
}

export function isOpenClawProject(projectPath: string): boolean {
  try {
    const config = loadProjectConfig(projectPath);
    return config.name.includes('openclaw') || config.name.includes('OPENCLAW');
  } catch (error) {
    return false;
  }
}

export function updateProjectVersion(projectPath: string, version: string): void {
  const config = loadProjectConfig(projectPath);
  config.version = version;
  saveProjectConfig(projectPath, config);
}

export function addTermuxScripts(projectPath: string): void {
  const config = loadProjectConfig(projectPath);
  
  if (!config.scripts) {
    config.scripts = {};
  }
  
  if (!config.scripts['termux-start']) {
    config.scripts['termux-start'] = 'node index.js';
  }
  
  saveProjectConfig(projectPath, config);
}
