import * as fs from 'fs-extra';
import path from 'path';
import * as glob from 'glob';
import { NEW_FILES } from '../resources/new-files';
import { CORE_MODIFICATIONS } from '../resources/core-modifications';

export interface InjectOptions {
  projectPath: string;
  targetPath?: string;
  verbose?: boolean;
}

export async function inject(options: InjectOptions): Promise<void> {
  const { projectPath, targetPath = projectPath, verbose = false } = options;

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path ${projectPath} does not exist`);
  }

  if (verbose) {
    console.log(`Injecting changes to ${targetPath}...`);
  }

  const projectFiles = glob.sync('**/*', { cwd: projectPath, nodir: true });

  for (const file of projectFiles) {
    const filePath = path.join(projectPath, file);
    const targetFilePath = path.join(targetPath, file);

    fs.ensureDirSync(path.dirname(targetFilePath));

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    const normalizedFile = file.replace(/\\/g, '/');

    const isCoreModification = normalizedFile === 'src/entry.ts' ||
      normalizedFile === 'src/daemon/service.ts' ||
      normalizedFile === 'src/infra/path-env.ts' ||
      normalizedFile === 'src/wizard/onboarding.finalize.ts';

    if (isCoreModification && !filePath.endsWith('.org')) {
      const backupFilePath = filePath + '.org';
      if (!fs.existsSync(backupFilePath)) {
        fs.writeFileSync(backupFilePath, content, 'utf8');
        if (verbose) {
          console.log(`Backed up: ${normalizedFile} → ${normalizedFile}.org`);
        }
      }
    }

    if (file === 'package.json') {
      content = updateMainPackageJson(content);
      modified = true;
      if (verbose) {
        console.log(`Modified package.json: openclaw-cn → openclaw-cn-termux`);
      }
    }
    
    else if (file.startsWith('extensions/') && file === 'package.json') {
      content = updateExtensionPackageJson(content);
      modified = true;
      if (verbose) {
        console.log(`Modified extension package.json`);
      }
    }
    
    else if (normalizedFile === 'src/entry.ts') {
      content = applyCoreModifications(content, 'src/entry.ts', verbose);
      modified = true;
      if (verbose) {
        console.log(`Modified src/entry.ts`);
      }
    }

    else if (normalizedFile === 'src/daemon/service.ts') {
      content = applyCoreModifications(content, 'src/daemon/service.ts', verbose);
      modified = true;
      if (verbose) {
        console.log(`Modified src/daemon/service.ts`);
      }
    }

    else if (normalizedFile === 'src/infra/path-env.ts') {
      content = applyCoreModifications(content, 'src/infra/path-env.ts', verbose);
      modified = true;
      if (verbose) {
        console.log(`Modified src/infra/path-env.ts`);
      }
    }

    else if (normalizedFile === 'src/wizard/onboarding.finalize.ts') {
      content = applyCoreModifications(content, 'src/wizard/onboarding.finalize.ts', verbose);
      modified = true;
      if (verbose) {
        console.log(`Modified src/wizard/onboarding.finalize.ts`);
      }
    }

    else if (normalizedFile === 'extensions/discord/src/runtime.ts') {
      content = modifyDiscordRuntime(content);
      modified = true;
      if (verbose) {
        console.log(`Modified extensions/discord/src/runtime.ts`);
      }
    }

    else if (normalizedFile === 'src/acp/server.ts') {
      content = modifyAcpServer(content);
      modified = true;
      if (verbose) {
        console.log(`Modified src/acp/server.ts`);
      }
    }

    else if (normalizedFile === 'src/cli/run-main.ts') {
      content = modifyCliRunMain(content);
      modified = true;
      if (verbose) {
        console.log(`Modified src/cli/run-main.ts`);
      }
    }

    else if (normalizedFile === 'src/infra/clawdbot-root.ts') {
      content = modifyClawdbotRoot(content);
      modified = true;
      if (verbose) {
        console.log(`Modified src/infra/clawdbot-root.ts`);
      }
    }
    
    if (modified) {
      fs.writeFileSync(targetFilePath, content, 'utf8');
    } else if (filePath !== targetFilePath) {
      fs.copySync(filePath, targetFilePath);
    }
  }
  
  if (verbose) {
    console.log('\n=== Injecting new files ===');
  }
  
  injectNewFiles(targetPath, verbose);
  
  if (verbose) {
    console.log('\nInjection completed successfully!');
  }
}

function updateMainPackageJson(content: string): string {
  const json = JSON.parse(content);
  
  if (json.name === 'openclaw-cn') {
    json.name = 'openclaw-cn-termux';
  }
  
  if (json.repository) {
    if (json.repository.url && json.repository.url.includes('jiulingyun/openclaw-cn')) {
      json.repository.url = json.repository.url.replace('jiulingyun/openclaw-cn', 'byteuser1977/openclaw-cn-termux');
    }
    if (json.repository.url && json.repository.url.includes('github.com/jiulingyun/openclaw-cn')) {
      json.repository.url = json.repository.url.replace('github.com/jiulingyun/openclaw-cn', 'github.com/byteuser1977/openclaw-cn-termux');
    }
  }
  
  if (json.bin) {
    for (const [key, value] of Object.entries(json.bin)) {
      if (typeof value === 'string' && value.includes('openclaw-cn')) {
        json.bin[key] = value.replace(/openclaw-cn/g, 'openclaw-cn-termux');
      }
    }
  }
  
  if (json.dependencies) {
    for (const [key, value] of Object.entries(json.dependencies)) {
      if (key === 'openclaw-cn' || key.startsWith('@openclaw-cn/')) {
        const newKey = key.replace(/openclaw-cn/g, 'openclaw-cn-termux');
        json.dependencies[newKey] = value;
        if (newKey !== key) {
          delete json.dependencies[key];
        }
      }
    }
  }
  
  if (json.devDependencies) {
    for (const [key, value] of Object.entries(json.devDependencies)) {
      if (key === 'openclaw-cn' || key.startsWith('@openclaw-cn/')) {
        const newKey = key.replace(/openclaw-cn/g, 'openclaw-cn-termux');
        json.devDependencies[newKey] = value;
        if (newKey !== key) {
          delete json.devDependencies[key];
        }
      }
    }
  }
  
  return JSON.stringify(json, null, 2);
}

function updateExtensionPackageJson(content: string): string {
  const json = JSON.parse(content);
  
  if (json.dependencies) {
    for (const [key, value] of Object.entries(json.dependencies)) {
      if (key === 'openclaw-cn' || key.startsWith('@openclaw-cn/')) {
        const newKey = key.replace(/openclaw-cn/g, 'openclaw-cn-termux');
        json.dependencies[newKey] = value;
        if (newKey !== key) {
          delete json.dependencies[key];
        }
      }
    }
  }
  
  if (json.peerDependencies) {
    for (const [key, value] of Object.entries(json.peerDependencies)) {
      if (key === 'openclaw-cn' || key.startsWith('@openclaw-cn/')) {
        const newKey = key.replace(/openclaw-cn/g, 'openclaw-cn-termux');
        json.peerDependencies[newKey] = value;
        if (newKey !== key) {
          delete json.peerDependencies[key];
        }
      }
    }
  }
  
  return JSON.stringify(json, null, 2);
}

function modifyEntryTs(content: string): string {
  let modified = content;
  
  modified = modified.replace(/openclaw-cn/g, 'openclaw-cn-termux');
  
  return modified;
}

function modifyDaemonService(content: string): string {
  const serviceTemplate = `
// Daemon service implementation for Termux environment
export class DaemonService {
  private isRunning: boolean = false;
  
  constructor() {
    this.checkEnvironment();
  }
  
  private checkEnvironment(): void {
    if (process.env.TERMUX_VERSION) {
      console.log('[Daemon] Running in Termux environment');
    }
  }
  
  public start(): void {
    this.isRunning = true;
    console.log('[Daemon] Service started');
  }
  
  public stop(): void {
    this.isRunning = false;
    console.log('[Daemon] Service stopped');
  }
  
  public status(): boolean {
    return this.isRunning;
  }
}

export const daemonService = new DaemonService();
`;
  
  return content + '\n' + serviceTemplate;
}

function modifyPathEnv(content: string): string {
  let modified = content;
  
  const termuxPathHandling = `
// Termux environment path handling
const isTermux = process.env.TERMUX_VERSION !== undefined;
const isAidlux = process.env.AIDLUX_VERSION !== undefined;

if (isTermux || isAidlux) {
  process.env.PATH = process.env.PATH?.replace(/\\\\/g, '/') || '';
}
`;
  
  if (!modified.includes('Termux environment path handling')) {
    modified = termuxPathHandling + '\n' + modified;
  }
  
  return modified;
}

function modifyOnboardingFinalize(content: string): string {
  let modified = content;
  
  const termuxOnboarding = `
// Termux onboarding finalization
const isTermux = process.env.TERMUX_VERSION !== undefined;
const isAidlux = process.env.AIDLUX_VERSION !== undefined;

export function finalizeTermuxOnboarding(): void {
  if (isTermux) {
    console.log('[Onboarding] Finalizing Termux environment setup...');
  }
  if (isAidlux) {
    console.log('[Onboarding] Finalizing Aidlux environment setup...');
  }
}
`;
  
  if (!modified.includes('Termux onboarding finalization')) {
    modified = modified + '\n' + termuxOnboarding;
  }
  
  return modified;
}

function modifyDiscordRuntime(content: string): string {
  return content;
}

function modifyAcpServer(content: string): string {
  return content;
}

function modifyCliRunMain(content: string): string {
  return content;
}

function modifyClawdbotRoot(content: string): string {
  return content;
}

function injectNewFiles(targetPath: string, verbose: boolean): void {
  for (const [filePath, fileData] of Object.entries(NEW_FILES)) {
    const fullPath = path.join(targetPath, filePath);
    const fullDir = path.dirname(fullPath);

    fs.ensureDirSync(fullDir);

    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, fileData.content, 'utf8');
      if (verbose) {
        console.log(`Created new file: ${filePath}`);
      }
    }
  }
}

function applyCoreModifications(content: string, fileKey: string, verbose: boolean): string {
  let modified = content;
  const modifications = CORE_MODIFICATIONS[fileKey];

  if (!modifications) {
    const fileBase = fileKey.split('.')[0];
    const relatedMods = Object.entries(CORE_MODIFICATIONS)
      .filter(([key]) => key.startsWith(fileBase));

    for (const [, mod] of relatedMods) {
      if (modified.includes(mod.oldSegment)) {
        modified = modified.replace(mod.oldSegment, mod.newSegment);
      }
    }
  } else {
    if (modified.includes(modifications.oldSegment)) {
      modified = modified.replace(modifications.oldSegment, modifications.newSegment);
    }
  }

  return modified;
}
