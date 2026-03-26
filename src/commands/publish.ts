import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

export interface PublishOptions {
  projectPath: string;
  registry?: string;
  tag?: string;
  verbose?: boolean;
}

export async function publish(options: PublishOptions): Promise<void> {
  const { projectPath, registry, tag = 'latest', verbose = false } = options;
  
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path ${projectPath} does not exist`);
  }
  
  if (verbose) {
    console.log(`Publishing project at ${projectPath}...`);
  }
  
  // 1. 检查 package.json 是否存在
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found');
  }
  
  // 2. 执行发布命令
  try {
    let publishCommand = 'npm publish';
    
    if (registry) {
      publishCommand += ` --registry ${registry}`;
    }
    
    if (tag) {
      publishCommand += ` --tag ${tag}`;
    }
    
    execSync(publishCommand, { cwd: projectPath, stdio: verbose ? 'inherit' : 'ignore' });
  } catch (error) {
    throw new Error('Publish failed. Please check your npm credentials and project configuration.');
  }
  
  if (verbose) {
    console.log('Publish completed successfully!');
  }
}
