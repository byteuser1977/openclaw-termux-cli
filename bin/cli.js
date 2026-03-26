#!/usr/bin/env node

const { program } = require('commander');
const { inject, build, publish, install } = require('../dist/commands');

program
  .name('termux-cli')
  .description('A CLI tool for migrating OPENCLAW projects to openclaw-cn-termux')
  .version('1.0.0');

// Inject command
program
  .command('inject')
  .description('Inject changes to OPENCLAW project for Termux compatibility')
  .option('-c, --code <path>', 'Inject code to project directory')
  .option('-p, --package <name>', 'Inject to installed package (openclaw or openclaw-cn)')
  .option('-t, --target <path>', 'Target path (default: project path)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (!options.code && !options.package) {
        console.error('Error: Either --code or --package option is required');
        process.exit(1);
      }

      if (options.code && options.package) {
        console.error('Error: Cannot use both --code and --package at the same time');
        process.exit(1);
      }

      await inject({
        mode: options.code ? 'code' : 'package',
        projectPath: options.code,
        packageName: options.package,
        targetPath: options.target,
        verbose: options.verbose
      });
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Build command
program
  .command('build')
  .description('Build OPENCLAW project for Termux')
  .option('-p, --project <path>', 'Project path')
  .option('-o, --output <path>', 'Output path (default: project/dist)')
  .option('-v, --version <version>', 'Version number')
  .option('-V, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (!options.project) {
        console.error('Error: --project option is required');
        process.exit(1);
      }
      
      await build({
        projectPath: options.project,
        outputPath: options.output,
        version: options.version,
        verbose: options.verbose
      });
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Publish command
program
  .command('publish')
  .description('Publish OPENCLAW project to npm')
  .option('-p, --project <path>', 'Project path')
  .option('-r, --registry <url>', 'npm registry URL')
  .option('-t, --tag <tag>', 'npm tag (default: latest)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (!options.project) {
        console.error('Error: --project option is required');
        process.exit(1);
      }
      
      await publish({
        projectPath: options.project,
        registry: options.registry,
        tag: options.tag,
        verbose: options.verbose
      });
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Install command
program
  .command('install')
  .description('Process installed OPENCLAW package for Termux compatibility')
  .option('-p, --package <path>', 'Package path')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (!options.package) {
        console.error('Error: --package option is required');
        process.exit(1);
      }
      
      await install({
        packagePath: options.package,
        verbose: options.verbose
      });
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
