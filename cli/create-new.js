#!/usr/bin/env node

/**
 * Script to create new projects/modules in the monorepo.
 * Provides an interactive CLI for selecting project types and templates.
 * Supports arguments: [--remove | --symlink | projectType] [projectName] [--git | --nogit]
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import { __rootdir, __shareddir, colors, hasSymlinkPermissions, hasGit, getProjectDir } from './project-utils.js';
import { createNewProject, createNewSymlink } from './create-new-project.js';

/**
 * Parses command-line arguments and validates them
 * @returns {Object} Object with properties: operation, projectName, symlinkPath, symlinkSourcePath, gitOption
 * @throws {Error} If arguments are invalid
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const result = {
    operation: null,
    projectName: null,
    symlinkPath: null,
    symlinkSourcePath: null,
    gitOption: 'ask'
  };

  // If no arguments provided, return default result
  if (args.length === 0) {
    return result;
  }

  // Handle --remove operation
  if (args[0] === '--remove') {
    if (args.length < 2) {
      throw new Error('Project or module name is required for --remove');
    }
    if (args.includes('--git') || args.includes('--nogit')) {
      throw new Error('--git or --nogit cannot be used with --remove');
    }
    result.operation = '--remove';
    result.projectName = args[1];
    return result;
  }

  // Handle --symlink operation
  if (args[0] === '--symlink') {
    if (args.length < 4) {
      throw new Error('--symlink requires project name, symlink path, and symlink source');
    }
    if (args.includes('--git') || args.includes('--nogit')) {
      throw new Error('--git or --nogit cannot be used with --symlink');
    }
    result.operation = '--symlink';
    result.projectName = args[1];
    result.symlinkPath = args[2];
    result.symlinkSourcePath = args[3];
    return result;
  }

  // Handle project creation with project type and optional project name
  result.operation = args[0];
  result.projectName = args[1] || null;

  // Handle git options
  if (args.includes('--git')) {
    if (args.includes('--nogit')) {
      throw new Error('Cannot use both --git and --nogit');
    }
    result.gitOption = 'use';
  } else if (args.includes('--nogit')) {
    result.gitOption = 'skip';
  }

  return result;
}

/**
 * Attempts to add files to Git based on gitOption
 * @param {string[]} files - Array of file paths relative to rootDir
 * @param {string} gitOption - Git handling option ('use', 'skip', 'ask')
 * @throws {Error} If Git operations fail
 */
async function tryAddFilesToGit(files, gitOption) {
  if (!files.length || gitOption === 'skip' || !hasGit()) {
    return;
  }

  let shouldAddToGit = false;
  if (gitOption === 'use') {
    shouldAddToGit = true;
  } else if (gitOption === 'ask') {
    let promptMessage = '';
    if (files.length > 1) {
      promptMessage = `Would you like to add ${files.length} files to Git?`;
    } else {
      const isDirectory = fs.lstatSync(path.join(__rootdir, files[0])).isDirectory();
      promptMessage = `Would you like to add the ${isDirectory ? 'directory' : 'file'} "${files[0]}" to Git?`;
    }
    console.log('');
    shouldAddToGit = await askYesNo(promptMessage);
  }

  if (shouldAddToGit) {
    for (const file of files) {
      execSync(`git add "${file}"`, { cwd: __rootdir, stdio: 'ignore' });
    }
    console.log(colors.green('✅ Files successfully added to Git'));
  }
}

/**
 * Creates an interactive menu with keyboard navigation
 * @param {string} title - Menu title/prompt
 * @param {string[]} options - Array of menu options
 * @returns {Promise<number>} Index of selected option
 */
async function createInteractiveMenu(title, options) {
  // Render the title and navigation hint
  console.log('');
  console.log(colors.bold(title));
  console.log(colors.italic('Use ↑/↓ arrow keys to navigate and Enter to select'));
  console.log('');

  // Render menu options, with the first option highlighted
  options.forEach((option, index) => {
    if (index === 0) {
      console.log(colors.blue(`> ${option}`));
    } else {
      console.log(`  ${option}`);
    }
  });

  // Renders a single menu option at the specified index
  function renderMenuOption(option, index, isSelected) {
    const upIndex = options.length - index;
    process.stdout.write(`\x1B[${upIndex}A`); // Move to option's line
    process.stdout.write(`\x1B[K`); // Clear the line
    console.log(isSelected ? colors.blue(`> ${option}`) : `  ${option}`); // Text
    process.stdout.write(`\x1B[${upIndex - 1}B`); // Move back
  }

  // Changes the selected menu index and updates the display
  let selectedIndex = 0;
  function changeSelectedIndex(currentIndex, newIndex) {
    if (newIndex < 0 || newIndex >= options.length) {
      return currentIndex;
    }
    renderMenuOption(options[currentIndex], currentIndex, false);
    renderMenuOption(options[newIndex], newIndex, true);
    return newIndex;
  }

  return new Promise((resolve) => {
    // Set up terminal to handle input without requiring Enter
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume(); // Ensure stdin is active

    // Handle keypress events
    const onKeyPress = (str, key) => {
      if (key.name === 'c' && key.ctrl) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.exit(0);
      } else if (key.name === 'up') {
        selectedIndex = changeSelectedIndex(selectedIndex, selectedIndex - 1);
      } else if (key.name === 'down') {
        selectedIndex = changeSelectedIndex(selectedIndex, selectedIndex + 1);
      } else if (key.name === 'return') {
        process.stdin.removeListener('keypress', onKeyPress); // Clean up listener
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(selectedIndex);
      }
    };

    process.stdin.on('keypress', onKeyPress);
  });
}

/**
 * Creates a standard readline interface for text input
 * @returns {readline.Interface} Readline interface
 */
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Asks user a yes/no question and returns their answer
 * @param {string} question - The question to ask
 * @returns {Promise<boolean>} User's answer (true for yes, false for no)
 * @throws {Error} If prompt fails
 */
async function askYesNo(question) {
  const prompt = createPrompt();
  try {
    const answer = await new Promise((resolve) => {
      prompt.question(colors.yellow(`${question} (y/n): `), (answer) => resolve(answer.trim().toLowerCase()));
    });
    return answer === 'y' || answer === 'yes';
  } finally {
    prompt.close();
  }
}

/**
 * Iterates through index.ts files in parent directories
 * @param {string} modulePath - Path to the module file
 * @param {Function} callback - Callback function with indexPath and childPath arguments, returns boolean
 * @throws {Error} If modulePath doesn't start with __shareddir
 */
function foreachIndexFile(modulePath, callback) {
  // Validate modulePath
  const sharedDirPrefix = `${__shareddir}${path.sep}`;
  if (!modulePath.startsWith(sharedDirPrefix)) {
    throw new Error(`Module path "${modulePath}" must start with "${sharedDirPrefix}"`);
  }

  let childPath = modulePath;
  while (true) {
    const baseDir = path.dirname(childPath);
    const indexPath = path.join(baseDir, 'index.ts');

    // Don't add self-reference
    if (indexPath !== childPath) {
      const continueIteration = callback(indexPath, childPath);
      if (!continueIteration) {
        break;
      }
    }

    // Stop if we've reached the shared directory
    if (baseDir === __shareddir) {
      break;
    }

    // Next iteration
    childPath = baseDir;
  }
}

/**
 * Creates a new shared module
 * @param {string} moduleName - Optional name for the module
 * @returns {Promise<string[]>} Array of created file paths relative to __rootdir
 * @throws {Error} If module creation fails
 */
async function createNewSharedModule(moduleName = '') {
  console.log(colors.bold(colors.blue('📦 Creating a new shared module')));
  console.log('');

  const prompt = createPrompt();
  const createdFiles = [];

  try {
    while (true) {
      // Ask for module name if not provided
      if (!moduleName) {
        moduleName = await new Promise((resolve) => {
          prompt.question(
            colors.yellow(`Enter module name (examples: "my-module.ts" or "my-path/my-module.ts"): `),
            (answer) => resolve(answer.trim())
          );
        });
      }

      // Validate module name
      if (!moduleName) {
        console.error(colors.red('Error: Module name cannot be empty'));
        moduleName = '';
        continue;
      }

      if (moduleName.startsWith('/')) {
        console.error(colors.red('Error: Module name cannot start with "/"'));
        moduleName = '';
        continue;
      }

      if (moduleName.includes('\\')) {
        console.error(colors.red('Error: Use "/" instead of "\\" for directory separators'));
        moduleName = '';
        continue;
      }

      if (!moduleName.endsWith('.ts')) {
        console.error(colors.red('Error: Module file must end with ".ts" extension'));
        moduleName = '';
        continue;
      }

      // Check intermediate directories
      const parts = moduleName.split('/');
      let invalidPart = false;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (part.startsWith('.') || part.endsWith('.ts')) {
          console.error(colors.red(`Error: Directory "${part}" cannot start with "." or end with ".ts"`));
          invalidPart = true;
          break;
        }
      }

      if (invalidPart) {
        moduleName = '';
        continue;
      }

      // Check if module already exists
      const modulePath = path.join(__shareddir, moduleName);
      if (fs.existsSync(modulePath)) {
        console.error(colors.red(`Error: Module "${moduleName}" already exists at "${modulePath}"`));
        moduleName = '';
        continue;
      }

      // All validations passed
      break;
    }
  } finally {
    prompt.close();
  }

  // Create module file and directories
  const modulePath = path.join(__shareddir, moduleName);
  const moduleDir = path.dirname(modulePath);
  // Create directories if they don't exist
  fs.mkdirSync(moduleDir, { recursive: true });

  // Create the module file with a basic template
  const moduleCodeName = moduleName.replace(/\.ts$/, '').replace(/[^a-zA-Z0-9]/g, '_');
  fs.writeFileSync(modulePath, `/**
 * ${path.basename(moduleName)}
 */

export const ${moduleCodeName}_example = () => {
  console.log('Hello from ${moduleName}');
};
`);

  // Add to created files (relative path from rootDir)
  const relModulePath = path.relative(__rootdir, modulePath);
  createdFiles.push(relModulePath);

  console.log(colors.green(`✅ Module ${modulePath} successfully created`));

  // Iterate through index.ts files in parent directories
  foreachIndexFile(modulePath, (indexPath, childPath) => {
    // Create index file if it doesn't exist
    let fileCreated = false;
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, '');
      fileCreated = true;
      console.log(`Created index: ${indexPath}`);
    }

    // Calculate the relative path for the import
    let importPath = './' + path.relative(path.dirname(indexPath), childPath).replace(/\\/g, '/');
    // Remove .ts extension for the import
    importPath = importPath.replace(/\.ts$/, '');

    // Read existing content
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    // Prepare the export statement
    const exportStatement = `export * from '${importPath}';`;

    // Add the export if it doesn't already exist
    if (!indexContent.includes(exportStatement)) {
      const newContent = indexContent
        ? indexContent.trim() + '\n' + exportStatement + '\n'
        : exportStatement + '\n';

      fs.writeFileSync(indexPath, newContent);
      console.log(`Updated index: ${indexPath} with export for ${importPath}`);
    }

    // Add to created files only if we created a new file
    if (fileCreated) {
      const relIndexPath = path.relative(__rootdir, indexPath);
      createdFiles.push(relIndexPath);
    }

    return fileCreated; // Continue iteration only if index file is created
  });

  return createdFiles;
}

/**
 * Safely removes a file or directory, handling Git if applicable
 * @param {string} targetPath - Path to the file or directory to remove
 * @throws {Error} If target does not exist or removal fails
 */
async function safeRemove(targetPath) {
  const relPath = path.relative(__rootdir, targetPath);

  // Check if target exists
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target "${relPath}" does not exist`);
  }

  // Determine if target is a file or directory
  const isDirectory = fs.lstatSync(targetPath).isDirectory();

  // Attempt Git-based removal if Git is available
  let removedFromGit = false;
  if (hasGit()) {
    try {
      execSync(`git rm -r --cached "${relPath}"`, { cwd: __rootdir, stdio: 'ignore' });
      removedFromGit = true;
    } catch (err) {
      console.log(colors.yellow(`Git removing "${relPath}" failed`));
    }
  }

  // Perform physical removal
  let removed = false;
  try {
    if (isDirectory) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    removed = true;
  } catch (err) {
    // Intentionally ignore removal errors
  }

  // Log removal status
  const type = isDirectory ? 'directory' : 'file';
  if (removed) {
    const gitMessage = removedFromGit ? ' (via Git)' : '';
    console.log(`Removed ${type}: "${relPath}"${gitMessage}`);
  } else {
    console.log(colors.yellow(`Warning: Target ${type} "${relPath}" was not removed`));
  }
}

/**
 * Removes a project or module
 * @param {string} name - Name of the project or module to remove
 * @throws {Error} If removal fails
 */
async function removeProjectOrModule(name) {
  // Normalize path separators for the current OS
  const normalizedName = name.replace(/[/\\]/g, path.sep);

  // Determine if it's a module (ends with .ts) or a project
  const isModule = normalizedName.endsWith('.ts');

  if (!isModule) {
    // Handle project removal
    console.log(colors.blue(`🗑️ Removing project: ${name}`));

    // Find project directory
    const projectDir = getProjectDir(normalizedName);
    if (!fs.existsSync(projectDir)) {
      throw new Error(`Project directory "${projectDir}" does not exist`);
    }

    // Read package.json from project
    const packagePath = path.join(projectDir, 'package.json');
    if (!fs.existsSync(packagePath)) {
      throw new Error(`package.json not found in "${projectDir}"`);
    }
    const projectPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const packageName = projectPackage.name;

    // Read and modify root package.json
    const rootPackagePath = path.join(__rootdir, 'package.json');
    if (!fs.existsSync(rootPackagePath)) {
      throw new Error(`Root package.json not found in "${__rootdir}"`);
    }
    const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));

    // Remove scripts ending with --workspace=${packageName}
    if (rootPackage.scripts) {
      for (const scriptName of Object.keys(rootPackage.scripts)) {
        if (rootPackage.scripts[scriptName].endsWith(`--workspace=${packageName}`)) {
          delete rootPackage.scripts[scriptName];
        }
      }
    }

    // Remove workspace entry
    const workspaceEntry = path.relative(__rootdir, projectDir).replace(/\\/g, '/');
    if (rootPackage.workspaces) {
      rootPackage.workspaces = rootPackage.workspaces.filter(
        (workspace) => workspace !== workspaceEntry
      );
    }

    // Save modified root package.json
    fs.writeFileSync(rootPackagePath, JSON.stringify(rootPackage, null, 2));
    console.log(`Updated root package.json: removed scripts and workspace for ${packageName}`);

    // Remove project directory
    await safeRemove(projectDir);

    // Run npm uninstall to remove project dependencies
    try {
      execSync(`npm uninstall ${packageName}`, { cwd: __rootdir, stdio: 'inherit' });
    } catch (err) {
      console.log(colors.yellow(`npm uninstall ${packageName} failed, please run it manually`));
    }
  } else {
    // Handle module removal
    console.log(colors.blue(`🗑️ Removing module: ${name}`));

    // Construct module path
    const modulePath = path.join(__shareddir, normalizedName);
    if (!fs.existsSync(modulePath)) {
      throw new Error(`Module "${modulePath}" does not exist`);
    }

    // Remove module file
    await safeRemove(modulePath);

    // Iterate through parent index.ts files to remove exports
    foreachIndexFile(modulePath, (indexPath, childPath) => {
      if (fs.existsSync(indexPath)) {
        // Calculate relative import path
        let importPath = './' + path.relative(path.dirname(indexPath), childPath).replace(/\\/g, '/');
        importPath = importPath.replace(/\.ts$/, '');
        const exportStatement = `export * from '${importPath}';`;

        // Read and modify index file
        let indexContent = fs.readFileSync(indexPath, 'utf8');
        const lines = indexContent.split('\n');
        const newLines = lines.filter((line) => line.trim() !== exportStatement.trim());

        if (newLines.length === 0 || newLines.every((line) => line.trim() === '')) {
          // Remove index file or its parent directory if index is the only file
          const indexDir = path.dirname(indexPath);
          const dirContents = fs.readdirSync(indexDir);
          if (dirContents.length === 1 && dirContents[0] === 'index.ts') {
            // If index.ts is the only file in the directory, remove the entire directory
            safeRemove(indexDir);
          } else {
            // Otherwise, remove only the index file
            safeRemove(indexPath);
          }
          return true; // Index file or directory was removed, continue iteration
        } else {
          // Save modified index file
          indexContent = newLines.join('\n');
          fs.writeFileSync(indexPath, indexContent);
          console.log(`Updated index: ${indexPath} with removed export for ${importPath}`);
        }
      }
      return false;
    });
  }
}

/**
 * Selects project type through interactive menu
 * @returns {Promise<string>} Selected project type
 * @throws {Error} If selection fails
 */
async function selectOperation() {
  // Primary project category menu
  const projectCategories = [
    'Shared module',
    'Empty Node.js',
    'Frontend: React, Next.js, Angular, Vue.js, Svelte',
    'Backend: Express.js, NestJS, Fastify, AdonisJS, FeathersJS',
    'Mobile: React Native, Expo, NativeScript, Ionic, Capacitor.js',
    'Desktop: Electron, Tauri, Neutralino.js, Proton Native, Sciter',
  ];

  const categoryIndex = await createInteractiveMenu('What would you like to create?', projectCategories);
  const selectedCategory = projectCategories[categoryIndex];

  // Handle shared module separately
  if (categoryIndex === 0) {
    return 'Shared module';
  }

  // Handle Empty Node.js
  if (categoryIndex === 1) {
    return 'Empty Node.js';
  }

  // Secondary menu for selecting specific project
  let projectOptions = [];
  switch (categoryIndex) {
    case 2: // Frontend
      projectOptions = ['React', 'Next.js', 'Angular', 'Vue.js', 'Svelte'];
      break;
    case 3: // Backend
      projectOptions = ['Express.js', 'NestJS', 'Fastify', 'AdonisJS', 'FeathersJS'];
      break;
    case 4: // Mobile
      projectOptions = ['React Native', 'Expo', 'NativeScript', 'Ionic', 'Capacitor.js'];
      break;
    case 5: // Desktop
      projectOptions = ['Electron', 'Tauri', 'Neutralino.js', 'Proton Native', 'Sciter'];
      break;
  }

  // Add a blank line for visual separation before the second menu
  const projectIndex = await createInteractiveMenu(`Select ${selectedCategory.split(':')[0]} project:`, projectOptions);
  return projectOptions[projectIndex];
}

/**
 * Main function that orchestrates the project creation workflow
 * @returns {Promise<void>}
 */
async function main() {
  // Parse command-line arguments
  const { operation, projectName, symlinkPath, symlinkSourcePath, gitOption } = parseArguments();

  // Handle remove operation
  if (operation === '--remove') {
    await removeProjectOrModule(projectName);
    return;
  }

  // Check permissions to create symlinks (on Windows)
  if (operation === '--symlink' || (operation !== 'Shared module')) {
    if (!hasSymlinkPermissions()) {
      throw new Error('Administrative privileges required on Windows for symlinks.');
    }
  }

  // Handle symlink operation
  if (operation === '--symlink') {
    console.log(colors.green(`🔗 Creating symlink for project: ${projectName}`));
    await createNewSymlink(projectName, symlinkPath, symlinkSourcePath);
    return;
  }

  // Initialize project creation process for non-shared module operations
  if (!operation || operation !== 'Shared module') {
    console.log(colors.green('🚀 Creating new project in monorepo'));
  }

  // If operation is specified, validate it
  let selectedProject = null;
  if (operation) {
    const validProjects = [
      'Shared module',
      'Empty Node.js',
      'React', 'Next.js', 'Angular', 'Vue.js', 'Svelte',
      'Express.js', 'NestJS', 'Fastify', 'AdonisJS', 'FeathersJS',
      'React Native', 'Expo', 'NativeScript', 'Ionic', 'Capacitor.js',
      'Electron', 'Tauri', 'Neutralino.js', 'Proton Native', 'Sciter'
    ];

    if (!validProjects.includes(operation)) {
      throw new Error(`Invalid project type "${operation}"`);
    }
    selectedProject = operation;
  } else {
    // Select project type interactively
    selectedProject = await selectOperation();
  }

  // Handle shared module separately
  if (selectedProject === 'Shared module') {
    const createdFiles = await createNewSharedModule(projectName);
    await tryAddFilesToGit(createdFiles, gitOption);
    return;
  }

  // Output the final selection
  console.log('');
  console.log(colors.green(`✔️ Selected project type: ${selectedProject}`));

  // Create the new project
  const projectDir = await createNewProject(selectedProject, projectName);
  if (projectDir) {
    console.log('');
    console.log(colors.green(`✅ Project ${projectName} successfully created`));
    await tryAddFilesToGit([projectDir], gitOption);
  }
}

// Execute the main function and handle errors
main().catch(err => {
  console.error(colors.red(err.message));
  console.error(colors.gray(err.stack));
  process.exit(1);
});