#!/usr/bin/env node

/**
 * This script allows creating new projects/modules in the monorepo.
 * It provides an interactive CLI for selecting project types and templates.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const { execSync } = require('child_process');
const { exit } = require('process');
const { createNewProject } = require('./create-new-project');

/**
 * Checks if script is running with administrator privileges on Windows
 * @returns {boolean} True if admin rights are available or not on Windows
 */
function isAdminWindows() {
  if (os.platform() !== 'win32') return true; // Not Windows, assume it has the necessary permissions
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Determines the root directory of the monorepo
 * @returns {string} The absolute path to the root directory
 */
function findRootDir() {
  // Expected path of the current script
  const expectedScriptPath = path.join('packages', 'shared', 'cli');
  
  // Get the current script's directory
  const currentDir = __dirname;
  
  // Check if the current script is in the expected location
  if (!currentDir.endsWith(expectedScriptPath)) {
    console.error(chalk.red('Error: This script must be located in <rootDir>/packages/shared/cli'));
    exit(1);
  }
  
  // Calculate the root directory by removing the expected path from the current directory
  return currentDir.slice(0, currentDir.length - expectedScriptPath.length);
}

/**
 * Checks if the directory is under Git version control
 * @param {string} dir - Directory to check
 * @returns {boolean} True if the directory is under Git version control
 */
function isGitRepository(dir) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { 
      cwd: dir,
      stdio: 'ignore' 
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Adds files to Git
 * @param {string} rootDir - Root directory of the repository
 * @param {string[]} files - Array of file paths relative to rootDir
 */
function addFilesToGit(rootDir, files) {
  try {
    for (const file of files) {
      execSync(`git add "${file}"`, { 
        cwd: rootDir,
        stdio: 'ignore' 
      });
    }
    console.log(chalk.green('✅ Files successfully added to Git'));
  } catch (error) {
    console.error(chalk.red(`Error adding files to Git: ${error.message}`));
  }
}

/**
 * Creates an interactive menu with keyboard navigation
 * @param {string} title - Menu title/prompt
 * @param {string[]} options - Array of menu options
 * @returns {Promise<number>} Index of selected option
 */
function createInteractiveMenu(title, options) {
  let selectedIndex = 0;
  let cursorPosition = 0;

  function renderMenu() {
    // Clear previous menu if any
    if (cursorPosition > 0) {
      process.stdout.write(`\x1B[${cursorPosition}A`); // Move cursor up
      process.stdout.write(`\x1B[J`); // Clear from cursor to end of screen
    }

    // Render the title and navigation hint
    console.log(chalk.bold(title));
    console.log(chalk.italic('Use ↑/↓ arrow keys to navigate and Enter to select'));
    console.log('');

    // Render menu options
    options.forEach((option, index) => {
      if (index === selectedIndex) {
        console.log(chalk.blue(`> ${option}`));
      } else {
        console.log(`  ${option}`);
      }
    });

    // Update cursor position for next render
    cursorPosition = options.length + 3; // title + hint + blank line + options
  }

  return new Promise((resolve) => {
    // Set up terminal to handle input without requiring Enter
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume(); // Ensure stdin is active

    renderMenu();

    // Handle keypress events
    const onKeyPress = (str, key) => {
      if (key.name === 'c' && key.ctrl) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        exit(0);
      } else if (key.name === 'up' && selectedIndex > 0) {
        selectedIndex--;
        renderMenu();
      } else if (key.name === 'down' && selectedIndex < options.length - 1) {
        selectedIndex++;
        renderMenu();
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
 */
async function askYesNo(question) {
  const prompt = createPrompt();
  
  const answer = await new Promise((resolve) => {
    prompt.question(
      chalk.yellow(`${question} (y/n): `),
      (answer) => resolve(answer.trim().toLowerCase())
    );
  });
  
  prompt.close();
  return answer === 'y' || answer === 'yes';
}

/**
 * Creates a new shared module
 * @param {string} rootDir - Path to the root directory
 * @returns {Promise<string[]>} Array of created file paths relative to rootDir
 */
async function createNewSharedModule(rootDir) {
  console.log(chalk.bold.blue('📦 Creating a new shared module'));
  console.log('');
  
  // Calculate shared directory path
  const sharedDir = path.join(rootDir, 'packages', 'shared');
  
  const prompt = createPrompt();
  const createdFiles = [];
  
  let moduleName = '';
  let isValidModule = false;
  
  while (!isValidModule) {
    // Ask for module name
    moduleName = await new Promise((resolve) => {
      prompt.question(
        chalk.yellow(`Enter module name (examples: "my-module.ts" or "my-path/my-module.ts"): `),
        (answer) => resolve(answer.trim())
      );
    });
    
    // Validate module name
    if (!moduleName) {
      console.error(chalk.red('Error: Module name cannot be empty'));
      continue;
    }
    
    if (moduleName.startsWith('/')) {
      console.error(chalk.red('Error: Module name cannot start with "/"'));
      continue;
    }
    
    if (moduleName.includes('\\')) {
      console.error(chalk.red('Error: Use "/" instead of "\\" for directory separators'));
      continue;
    }
    
    if (!moduleName.endsWith('.ts')) {
      console.error(chalk.red('Error: Module file must end with ".ts" extension'));
      continue;
    }
    
    // Check intermediate directories
    const parts = moduleName.split('/');
    let invalidPart = false;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part.startsWith('.') || part.endsWith('.ts')) {
        console.error(chalk.red(`Error: Directory "${part}" cannot start with "." or end with ".ts"`));
        invalidPart = true;
        break;
      }
    }
    
    if (invalidPart) continue;
    
    // Check if module already exists
    const modulePath = path.join(sharedDir, moduleName);
    if (fs.existsSync(modulePath)) {
      console.error(chalk.red(`Error: Module "${moduleName}" already exists at "${modulePath}"`));
      continue;
    }
    
    isValidModule = true;
  }
  
  prompt.close();
  
  // Create module file and directories
  const modulePath = path.join(sharedDir, moduleName);
  const moduleDir = path.dirname(modulePath);
  
  // Create directories if they don't exist
  fs.mkdirSync(moduleDir, { recursive: true });
  
  // Create the module file with a basic template
  moduleCodeName = moduleName.replace(/\.ts$/, '').replace(/[^a-zA-Z0-9]/g, '_');
  fs.writeFileSync(modulePath, `/**
 * ${path.basename(moduleName)}
 */

export const ${moduleCodeName}_example = () => {
  console.log('Hello from ${moduleName}');
};
`);

  // Add to created files (relative path from rootDir)
  const relModulePath = path.relative(rootDir, modulePath);
  createdFiles.push(relModulePath);
  
  console.log(chalk.green(`✅ Created module: ${modulePath}`));

  // Update or create index.ts files in each parent directory
  let childPath = modulePath;
  
  while (true) {
    const baseDir = path.dirname(childPath);
    const indexPath = path.join(baseDir, 'index.ts');
       
    // Don't add self-reference
    if (indexPath !== childPath) {
      // Create index file if it doesn't exist
      let fileCreated = false;
      if (!fs.existsSync(indexPath)) {
        fs.writeFileSync(indexPath, '');
        fileCreated = true;
        console.log(chalk.blue(`Created index: ${indexPath}`));
      }
      
      // Calculate the relative path for the import
      let importPath = './' + path.relative(baseDir, childPath).replace(/\\/g, '/');
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
        
        // Add to created files only if we created a new file
        if (fileCreated) {
          const relIndexPath = path.relative(rootDir, indexPath);
          createdFiles.push(relIndexPath);
        }
        
        console.log(chalk.blue(`Updated index: ${indexPath} with export for ${importPath}`));
      }
    }
    
    // Stop if we've reached the shared directory
    if (path.relative(sharedDir, baseDir) === '') {
      break;
    }

    // Next iteration
    childPath = baseDir;
  }
 
  return createdFiles;
}

/**
 * Main function that orchestrates the project creation workflow
 */
async function main() {
  console.log(chalk.bold.green('🚀 Create New Project in Monorepo'));
  console.log('');
  
  // Check admin rights for Windows
  if (os.platform() === 'win32' && !isAdminWindows()) {
    console.error(chalk.red('Error: This script requires administrator privileges on Windows.'));
    console.error(chalk.yellow('Please run it again as administrator.'));
    exit(1);
  }

  // Find the root directory
  const rootDir = findRootDir();
  
  // Calculate shared directory path
  const sharedDir = path.join(rootDir, 'packages', 'shared');

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
    console.log('');
    const createdFiles = await createNewSharedModule(rootDir);
    
    // Check if we need to add files to Git
    if (createdFiles.length > 0 && isGitRepository(rootDir)) {
      console.log('');
      
      let promptMessage = '';
      if (createdFiles.length === 1) {
        promptMessage = `Would you like to add the file \"${createdFiles[0]}\" to Git?`;
      } else {
        promptMessage = `Would you like to add ${createdFiles.length} files to Git?`;
      }
      
      const shouldAddToGit = await askYesNo(promptMessage);
      
      if (shouldAddToGit) {
        addFilesToGit(rootDir, createdFiles);
      }
    }
    
    return;
  }

  let selectedProject = null;

  // Secondary menu for selecting specific project
  if (categoryIndex >= 2) { // Not Shared module or Empty Node.js
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
    console.log('');
    const projectIndex = await createInteractiveMenu(`Select ${selectedCategory.split(':')[0]} project:`, projectOptions);
    selectedProject = projectOptions[projectIndex];
  } else {
    selectedProject = selectedCategory;
  }

  // Output the final selection
  console.log('');
  console.log(chalk.green('✅ Selected project type:'), chalk.bold(`${selectedProject}`));

  // Create the new project, passing rootDir and selectedProject
  const projectDir = await createNewProject(rootDir, selectedProject);
  
  // Run npm install in the project directory
  if (projectDir) {
    console.log('');
    console.log(chalk.blue(`Installing dependencies with npm...`));
    try {
      execSync('npm install', { 
        cwd: projectDir,
        stdio: 'inherit' // Show output in the console
      });
      console.log(chalk.green('✅ Dependencies installed successfully'));
    } catch (error) {
      console.error(chalk.red(`Error installing dependencies: ${error.message}`));
    }
  
    // Check if the project directory is under Git control
    if (isGitRepository(rootDir)) {
      console.log('');
      const shouldAddToGit = await askYesNo(`Would you like to add the directory "${projectDir}" to Git?`);
      
      if (shouldAddToGit) {
        addFilesToGit(rootDir, [projectDir]);
      }
    }
  }
}

// Execute the main function
main().catch(err => {
  console.error(chalk.red('Error:'), err.message);
  exit(1);
});