import * as fs from 'fs-extra';
import path from 'path';
import * as glob from 'glob';
import { NEW_FILES } from '../resources/new-files';
import { CORE_MODIFICATIONS } from '../resources/core-modifications';

const CORE_FILES = [
  'src/entry.ts',
  'src/daemon/service.ts',
  'src/wizard/onboarding.finalize.ts',
];

export interface InjectOptions {
  mode: 'code' | 'package';
  projectPath?: string;
  packageName?: string;
  targetPath?: string;
  verbose?: boolean;
}

export async function inject(options: InjectOptions): Promise<void> {
  const { mode, projectPath, packageName, targetPath, verbose = false } = options;

  if (mode === 'code') {
    if (!projectPath) {
      throw new Error('--code requires --project parameter');
    }

    const targetDir = targetPath || projectPath;
    const entryFilePath = path.join(targetDir, 'src/entry.ts');
    const entryJsFilePath = path.join(targetDir, 'src/entry.js');

    let entryExists = false;
    if (fs.existsSync(entryFilePath)) {
      const entryContent = fs.readFileSync(entryFilePath, 'utf8');
      if (entryContent.includes('openclaw-cn-termux')) {
        entryExists = true;
      }
    } else if (fs.existsSync(entryJsFilePath)) {
      const entryContent = fs.readFileSync(entryJsFilePath, 'utf8');
      if (entryContent.includes('openclaw-cn-termux')) {
        entryExists = true;
      }
    }

    if (entryExists) {
      console.log('Project appears to already be processed (src/entry contains openclaw-cn-termux). Skipping injection.');
      return;
    }

    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path ${projectPath} does not exist`);
    }

    console.log(`Injecting changes to ${targetDir}...`);

    const projectFiles = glob.sync('**/*', { cwd: projectPath, nodir: true });

  for (const file of projectFiles) {
    const filePath = path.join(projectPath, file);
    const targetFilePath = path.join(targetDir, file);
    const normalizedFile = file.replace(/\\/g, '/');

    if (fs.statSync(filePath).isDirectory()) continue;

    fs.ensureDirSync(path.dirname(targetFilePath));

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let needsBackup = false;

    if (normalizedFile === 'package.json' || normalizedFile.match(/^extensions\/[^/]+\/package\.json$/)) {
      const result = handlePackageModification(content, normalizedFile, verbose);
      content = result.content;
      modified = result.modified;
      needsBackup = modified && !filePath.endsWith('.org');
    } else if (normalizedFile.match(/^extensions\/[^/]+\/src\/.+\.ts$/)) {
      const result = handleExtensionSrcModification(content, normalizedFile, verbose);
      content = result.content;
      modified = result.modified;
      needsBackup = modified && !filePath.endsWith('.org');
    } else if (normalizedFile.match(/^extensions\/[^/]+\/index\.ts$/)) {
      const result = handleExtensionSrcModification(content, normalizedFile, verbose);
      content = result.content;
      modified = result.modified;
      needsBackup = modified && !filePath.endsWith('.org');
    } else if (CORE_FILES.includes(normalizedFile)) {
      const result = handleCoreModification(content, normalizedFile, verbose);
      content = result.content;
      modified = result.modified;
      needsBackup = modified && !filePath.endsWith('.org');
    } else if (CORE_MODIFICATIONS[normalizedFile]) {
      content = content.replace(CORE_MODIFICATIONS[normalizedFile].oldSegment, CORE_MODIFICATIONS[normalizedFile].newSegment);
      modified = true;
      needsBackup = !filePath.endsWith('.org');
      if (verbose) console.log(`Modified ${normalizedFile}`);
    }

    if (needsBackup) {
      backupFile(filePath, content, normalizedFile, verbose);
    }

    if (modified) {
      fs.writeFileSync(targetFilePath, content, 'utf8');
    } else if (filePath !== targetFilePath) {
      fs.copySync(filePath, targetFilePath);
    }
  }

  if (verbose) console.log('\n=== Injecting new files ===');
  injectNewFiles(targetDir, verbose);
  if (verbose) console.log('\nInjection completed successfully!');
  } else if (mode === 'package') {
    if (!packageName) {
      throw new Error('--package requires a package name parameter (openclaw or openclaw-cn)');
    }
    console.log(`Package injection mode for: ${packageName}`);
    console.log('Package injection not yet implemented.');
  }
}

function backupFile(filePath: string, content: string, normalizedFile: string, verbose: boolean): void {
  const backupFilePath = filePath + '.org';
  if (!fs.existsSync(backupFilePath)) {
    fs.writeFileSync(backupFilePath, content, 'utf8');
    if (verbose) console.log(`Backed up: ${normalizedFile} → ${normalizedFile}.org`);
  }
}

function handlePackageModification(content: string, fileKey: string, verbose: boolean): { content: string; modified: boolean } {
  let modified = content;
  let hasModification = false;

  const replaceName = (json: any) => {
    if (json.name === 'openclaw-cn') {
      json.name = 'openclaw-cn-termux';
      hasModification = true;
    }
  };

  const replaceRepo = (json: any) => {
    if (json.repository?.url) {
      const newUrl = json.repository.url
        .replace(/jiulingyun\/openclaw-cn/g, 'byteuser1977/openclaw-cn-termux')
        .replace(/github\.com\/jiulingyun\/openclaw-cn/g, 'github.com/byteuser1977/openclaw-cn-termux');
      if (newUrl !== json.repository.url) {
        json.repository.url = newUrl;
        hasModification = true;
      }
    }
  };

  const replaceBin = (json: any) => {
    if (json.bin) {
      for (const [key, value] of Object.entries(json.bin)) {
        if (typeof value === 'string' && value.includes('openclaw-cn')) {
          json.bin[key] = value.replace(/openclaw-cn/g, 'openclaw-cn-termux');
          hasModification = true;
        }
      }
    }
  };

  const replaceDeps = (deps: Record<string, string> | undefined) => {
    if (!deps) return;
    for (const key of Object.keys(deps)) {
      if (key === 'openclaw-cn' || key.startsWith('@openclaw-cn/')) {
        const newKey = key.replace(/openclaw-cn/g, 'openclaw-cn-termux');
        deps[newKey] = deps[key];
        if (newKey !== key) {
          delete deps[key];
          hasModification = true;
        }
      }
      if (deps[key] === 'workspace:openclaw-cn@*') {
        deps[key] = 'workspace:openclaw-cn-termux@*';
        hasModification = true;
      }
      
    }
  };

  try {
    const json = JSON.parse(content);
    replaceName(json);
    replaceRepo(json);
    replaceBin(json);
    replaceDeps(json.dependencies);
    replaceDeps(json.devDependencies);
    replaceDeps(json.peerDependencies);

    if (hasModification) {
      modified = JSON.stringify(json, null, 2);
      if (verbose) console.log(`Modified ${fileKey}`);
    }
  } catch (e) {
    if (verbose) console.log(`Failed to parse ${fileKey}: ${e}`);
  }

  return { content: modified, modified: hasModification };
}

function handleCoreModification(content: string, fileKey: string, verbose: boolean): { content: string; modified: boolean } {
  const existingMod = findExistingModification(content, fileKey);
  if (existingMod) {
    if (verbose) console.log(`${fileKey} is already modified, skipping`);
    return { content, modified: false };
  }

  const modifications = CORE_MODIFICATIONS[fileKey];
  let modified = content;

  if (modifications && content.includes(modifications.oldSegment)) {
    modified = modified.replace(modifications.oldSegment, modifications.newSegment);
  } else {
    const fileBase = fileKey.split('.')[0];
    const relatedMods = Object.entries(CORE_MODIFICATIONS).filter(([key]) => key.startsWith(fileBase));

    for (const [, mod] of relatedMods) {
      if (modified.includes(mod.oldSegment)) {
        modified = modified.replace(mod.oldSegment, mod.newSegment);
      }
    }
  }

  if (verbose) console.log(`Modified ${fileKey}`);
  return { content: modified, modified: true };
}

function findExistingModification(content: string, fileKey: string): boolean {
  if (CORE_MODIFICATIONS[fileKey] && content.includes(CORE_MODIFICATIONS[fileKey].newSegment)) {
    return true;
  }

  const fileBase = fileKey.split('.')[0];
  const relatedMods = Object.entries(CORE_MODIFICATIONS).filter(([key]) => key.startsWith(fileBase));

  return relatedMods.some(([, mod]) => content.includes(mod.newSegment));
}

function handleExtensionSrcModification(content: string, fileKey: string, verbose: boolean): { content: string; modified: boolean } {
  const sdkMod = CORE_MODIFICATIONS['EXTENSION_SDK_IMPORT'];
  if (!sdkMod) {
    return { content, modified: false };
  }

  let modified = content;
  let hasModification = false;

  while (modified.includes(sdkMod.oldSegment)) {
    modified = modified.replace(sdkMod.oldSegment, sdkMod.newSegment);
    hasModification = true;
  }

  if (hasModification && verbose) {
    console.log(`Modified ${fileKey}`);
  }

  return { content: modified, modified: hasModification };
}

function injectNewFiles(targetPath: string, verbose: boolean): void {
  for (const [filePath, fileData] of Object.entries(NEW_FILES)) {
    const fullPath = path.join(targetPath, filePath);
    fs.ensureDirSync(path.dirname(fullPath));

    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, fileData.content, 'utf8');
      if (verbose) console.log(`Created new file: ${filePath}`);
    }
  }
}