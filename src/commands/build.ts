import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

export interface BuildOptions {
  projectPath: string;
  outputPath?: string;
  version?: string;
  verbose?: boolean;
}

export async function build(options: BuildOptions): Promise<void> {
  const { projectPath, outputPath = path.join(projectPath, 'dist'), version, verbose = false } = options;
  
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path ${projectPath} does not exist`);
  }
  
  if (verbose) {
    console.log(`Building project at ${projectPath}...`);
  }
  
  // 1. 清理输出目录
  fs.emptyDirSync(outputPath);
  
  // 2. 更新版本号（如果提供）
  if (version) {
    updatePackageVersion(projectPath, version);
  }
  
  // 3. 执行打包命令
  try {
    execSync('npm run build', { cwd: projectPath, stdio: verbose ? 'inherit' : 'ignore' });
  } catch (error) {
    throw new Error('Build failed. Please check the project configuration.');
  }
  
  // 4. 复制打包结果到输出目录
  const buildOutput = path.join(projectPath, 'dist');
  if (fs.existsSync(buildOutput)) {
    fs.copySync(buildOutput, outputPath);
  } else {
    // 如果没有 dist 目录，复制整个项目
    fs.copySync(projectPath, outputPath, {
      filter: (src: string) => {
        const relativePath = path.relative(projectPath, src);
        return !relativePath.startsWith('node_modules') && !relativePath.startsWith('.git');
      }
    });
  }
  
  // 5. 创建发布包
  createReleasePackage(outputPath, verbose);
  
  if (verbose) {
    console.log(`Build completed successfully! Output at ${outputPath}`);
  }
}

function updatePackageVersion(projectPath: string, version: string): void {
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = fs.readJSONSync(packageJsonPath);
    packageJson.version = version;
    fs.writeJSONSync(packageJsonPath, packageJson, { spaces: 2 });
  }
}

function createReleasePackage(outputPath: string, verbose: boolean): void {
  // 示例：创建发布包
  const packageName = `openclaw-cn-termux-${new Date().toISOString().split('T')[0]}`;
  const zipPath = path.join(path.dirname(outputPath), `${packageName}.zip`);
  
  if (verbose) {
    console.log(`Creating release package: ${zipPath}`);
  }
  
  // 这里可以使用 zip 库或系统命令来创建压缩包
  // 示例：使用系统命令
  try {
    execSync(`powershell Compress-Archive -Path "${outputPath}\*" -DestinationPath "${zipPath}"`, { stdio: verbose ? 'inherit' : 'ignore' });
  } catch (error) {
    console.warn('Failed to create zip package. Continuing without it.');
  }
}
