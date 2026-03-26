# openclaw-termux-cli

版本：0.0.1

一个用于将 OPENCLAW、OPENCLAW-CN 及其他 OPENCLAW 类项目迁移到 openclaw-cn-termux 项目的工具包。

## 功能特点

- **代码注入修改**：支持在 openclaw-cn fock 后基于代码直接注入修改成新版的 openclaw-cn-termux 项目
- **打包发布**：支持打包发布成 openclaw-cn-termux 新版本
- **安装后处理**：支持在安装 openclaw、openclaw-cn 版本后，npm 安装之后对安装后的代码进行注入修改，用于支持在 Termux+ubuntu 及 Aidlux 等环境的运行

## 安装

```bash
npm install -g @openclaw-cn-termux/cli
```

## 命令使用

### 1. inject 命令

用于向 OPENCLAW 项目注入 Termux 兼容性代码。支持两种模式：

#### 代码注入模式 (--code)

```bash
termux-cli inject --code <项目路径> [--target <目标路径>] [--verbose]
```

- `--code <项目路径>`：必需，指定 OPENCLAW 项目源码目录路径
- `--target <目标路径>`：可选，指定修改后的项目保存路径，默认为项目路径
- `--verbose`：可选，启用详细输出

#### 安装包注入模式 (--package)

```bash
termux-cli inject --package <包名> [--verbose]
```

- `--package <包名>`：必需，指定已安装的包名 (openclaw 或 openclaw-cn)
- `--verbose`：可选，启用详细输出

### 2. build 命令

用于构建 OPENCLAW 项目，生成可发布的版本。

```bash
termux-cli build --project <项目路径> [--output <输出路径>] [--version <版本号>] [--verbose]
```

- `--project <项目路径>`：必需，指定 OPENCLAW 项目的路径
- `--output <输出路径>`：可选，指定构建结果的输出路径，默认为项目的 dist 目录
- `--version <版本号>`：可选，指定构建版本号
- `--verbose`：可选，启用详细输出

### 3. publish 命令

用于发布 OPENCLAW 项目到 npm。

```bash
termux-cli publish --project <项目路径> [--registry <npm 仓库 URL>] [--tag <标签>] [--verbose]
```

- `--project <项目路径>`：必需，指定 OPENCLAW 项目的路径
- `--registry <npm 仓库 URL>`：可选，指定 npm 仓库地址
- `--tag <标签>`：可选，指定发布标签，默认为 latest
- `--verbose`：可选，启用详细输出

### 4. install 命令

用于处理已安装的 OPENCLAW 包，使其兼容 Termux 环境。

```bash
termux-cli install --package <包路径> [--verbose]
```

- `--package <包路径>`：必需，指定已安装的 OPENCLAW 包的路径
- `--verbose`：可选，启用详细输出

## 环境支持

- **Termux**：Android 终端模拟器
- **Aidlux**：AI 边缘计算平台
- **Ubuntu**：Linux 发行版
- **其他**：支持所有 Node.js 运行环境

## 示例

### 示例 1：注入代码到 OPENCLAW 项目

```bash
termux-cli inject --code /path/to/openclaw-cn --target /path/to/openclaw-cn-termux --verbose
```

### 示例 2：对已安装的包进行注入

```bash
termux-cli inject --package openclaw-cn --verbose
```

### 示例 3：构建并发布项目

```bash
termux-cli build --project /path/to/openclaw-cn-termux --version 0.0.1 --verbose
termux-cli publish --project /path/to/openclaw-cn-termux --tag latest --verbose
```

### 示例 4：处理已安装的包

```bash
termux-cli install --package /path/to/node_modules/openclaw-cn --verbose
```

## 技术实现

- **Node.js**：运行环境
- **TypeScript**：开发语言
- **Commander.js**：命令行工具
