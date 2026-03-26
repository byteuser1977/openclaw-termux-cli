import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';

export interface InstallOptions {
  packagePath: string;
  verbose?: boolean;
}

export async function install(options: InstallOptions): Promise<void> {
  const { packagePath, verbose = false } = options;
  
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Package path ${packagePath} does not exist`);
  }
  
  if (verbose) {
    console.log(`Processing package at ${packagePath}...`);
  }
  
  // 1. 分析包结构
  const packageFiles = glob.sync('**/*', { cwd: packagePath, nodir: true });
  
  // 2. 执行代码注入
  for (const file of packageFiles) {
    const filePath = path.join(packagePath, file);
    
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 执行注入逻辑
    let modifiedContent = content;
    
    // 示例注入逻辑：修改路径处理，适配 Termux 环境
    if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
      modifiedContent = injectPathHandling(modifiedContent);
      modifiedContent = injectTermuxEnvironment(modifiedContent);
    }
    
    // 写入修改后的内容
    fs.writeFileSync(filePath, modifiedContent, 'utf8');
    
    if (verbose) {
      console.log(`Modified: ${file}`);
    }
  }
  
  // 3. 更新 package.json，添加 Termux 相关配置
  updatePackageJson(packagePath);
  
  if (verbose) {
    console.log('Installation processing completed successfully!');
  }
}

function injectPathHandling(content: string): string {
  // 注入路径处理逻辑，适配 Termux 环境
  return content
    .replace(/path\.join\(([^)]+)\)/g, (match, args) => {
      return `path.join(...[${args}].map(p => p.replace(/\\/g, '/')))`;
    })
    .replace(/__dirname/g, 'path.resolve(__dirname)');
}

function injectTermuxEnvironment(content: string): string {
  // 注入 Termux 环境检测和适配逻辑
  const termuxCheck = `
// Termux environment detection
const isTermux = process.env.TERMUX_VERSION !== undefined;
const isAidlux = process.env.AIDLUX_VERSION !== undefined;
const isUbuntu = process.platform === 'linux' && !isTermux && !isAidlux;
`;
  
  // 在文件顶部注入环境检测
  if (!content.includes('Termux environment detection')) {
    return termuxCheck + content;
  }
  
  return content;
}

function updatePackageJson(packagePath: string): void {
  const packageJsonPath = path.join(packagePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = fs.readJSONSync(packageJsonPath);
    
    // 添加 Termux 相关配置
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    if (!packageJson.scripts['termux-start']) {
      packageJson.scripts['termux-start'] = 'node index.js';
    }
    
    // 添加依赖项
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    
    fs.writeJSONSync(packageJsonPath, packageJson, { spaces: 2 });
  }
}
