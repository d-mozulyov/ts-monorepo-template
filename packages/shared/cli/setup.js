const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Check if script is running as administrator (Windows only)
function isAdminWindows() {
  if (os.platform() !== 'win32') return true; // Not Windows, assume it has the necessary permissions
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if a package manager is installed
function isPackageManagerInstalled(manager) {
  try {
    execSync(`${manager} --version`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// Create a symbolic link using only relative paths
function createRelativeSymlink(targetPath, linkPath) {
  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Target path does not exist: ${targetPath}`);
    process.exit(1);
  }

  if (fs.existsSync(linkPath)) return; // If symlink already exists, do nothing

  // Convert target path to relative, ensuring the symlink is always relative
  const relativeTarget = path.relative(path.dirname(linkPath), targetPath);

  try {
    fs.symlinkSync(relativeTarget, linkPath, 'dir');
  } catch (err) {
    console.error(`Error: Failed to create symlink: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Install package dependencies
 * @param {string} packageDir - Directory containing package.json
 * @param {boolean} [isRoot=false] - True if installing in root directory (without --prefix)
 * @param {string} [packageManager='npm'] - Package manager to use ('npm', 'yarn', or 'pnpm')
 * @returns {boolean} - True if installation was successful
 */
function installPackageDependencies(packageDir, isRoot = false, packageManager = 'npm') {
  try {
    // Determine the command based on package manager and installation type
    let command;
    
    switch (packageManager) {
      case 'npm':
        command = isRoot ? 'npm install' : 'npm install --omit=dev --prefix .';
        break;
      case 'yarn':
        command = isRoot ? 'yarn install' : 'yarn install --production --cwd .';
        break;
      case 'pnpm':
        command = isRoot ? 'pnpm install --force' : 'pnpm install --prod --dir . --force';
        break;
      default:
        throw new Error(`Unsupported package manager: ${packageManager}`);
    }
    
    // Log the directory and the command that will be executed
    console.log(`${packageDir}: ${command}`);
    
    // Execute the command
    execSync(command, { cwd: packageDir, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Error: Failed running package installation in ${packageDir}: ${err.message}`);
    return false;
  }
}

// Check if directory is in a Git repository
function isGitRepository(dirPath) {
  try {
    // Check if git is installed
    execSync('git --version', { stdio: 'ignore' });
    
    // Check if the directory is in a git repository
    execSync('git rev-parse --is-inside-work-tree', { cwd: dirPath, stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

// Remove a package and all related configurations
function removePackage(rootDir, projectSlug) {
  const packageDir = path.join(rootDir, 'packages', projectSlug);
  
  // Check if package directory exists
  if (!fs.existsSync(packageDir)) {
    console.error(`Error: Package directory does not exist: ${packageDir}`);
    process.exit(1);
  }
  
  // Check if directory is part of a Git repository
  const isGitRepo = isGitRepository(packageDir);
  
  // 1. If it's a Git repository, remove it from Git first
  if (isGitRepo) {
    try {
      console.log(`Removing directory from Git repository: ${packageDir}`);
      
      // Check if there are any uncommitted changes
      try {
        execSync('git diff --quiet HEAD -- .', { cwd: packageDir });
      } catch (err) {
        console.warn(`Warning: There are uncommitted changes in ${packageDir}`);
        console.warn('Proceeding anyway, but you may want to check Git status afterward');
      }
      
      // Remove directory from Git
      execSync(`git rm -rf ${packageDir}`, { cwd: rootDir });
      console.log(`Successfully removed directory from Git repository: ${packageDir}`);
    } catch (err) {
      console.error(`Error removing directory from Git: ${err.message}`);
      console.error('You may need to remove it manually from Git');
    }
  }
  
  // 2. Remove the entire package directory
  try {
    // If directory was successfully removed from Git, it may already be gone
    if (fs.existsSync(packageDir)) {
      fs.rmSync(packageDir, { recursive: true, force: true });
      console.log(`Removed package directory: ${packageDir}`);
    }
  } catch (err) {
    console.error(`Error: Failed to remove package directory: ${err.message}`);
    process.exit(1);
  }
  
  // 2. Remove workspace scripts from root package.json
  const rootPackageJsonPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(rootPackageJsonPath)) {
    try {
      // Read and parse package.json
      const packageJsonData = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
      
      // If scripts section exists
      if (packageJsonData.scripts) {
        // Filter out scripts containing the project reference
        const workspaceRef = `--workspace=@monorepo/${projectSlug}`;
        const filteredScripts = {};
        
        // Keep only scripts that don't reference the removed project
        for (const [scriptName, scriptCommand] of Object.entries(packageJsonData.scripts)) {
          if (!scriptCommand.includes(workspaceRef)) {
            filteredScripts[scriptName] = scriptCommand;
          }
        }
        
        // Update scripts section
        packageJsonData.scripts = filteredScripts;
        
        // Write updated package.json
        fs.writeFileSync(
          rootPackageJsonPath, 
          JSON.stringify(packageJsonData, null, 2), 
          'utf8'
        );
        console.log(`Updated scripts in package.json to remove references to ${projectSlug}`);
      }
    } catch (err) {
      console.error(`Error updating package.json: ${err.message}`);
      process.exit(1);
    }
  }
  
  // 3. Remove tasks for the project from .vscode/tasks.json
  const tasksJsonPath = path.join(rootDir, '.vscode', 'tasks.json');
  if (fs.existsSync(tasksJsonPath)) {
    try {
      // Read and parse tasks.json
      const tasksJsonData = JSON.parse(fs.readFileSync(tasksJsonPath, 'utf8'));
      
      // If tasks section exists
      if (tasksJsonData.tasks) {
        // Filter out tasks that run commands for the removed project
        tasksJsonData.tasks = tasksJsonData.tasks.filter(task => {
          return !(task.command && 
                  typeof task.command === 'string' && 
                  task.command.match(new RegExp(`npm run .*:${projectSlug}`)));
        });
        
        // Write updated tasks.json
        fs.writeFileSync(
          tasksJsonPath,
          JSON.stringify(tasksJsonData, null, 2),
          'utf8'
        );
        console.log(`Updated tasks.json to remove tasks for ${projectSlug}`);
      }
    } catch (err) {
      console.error(`Error updating tasks.json: ${err.message}`);
      process.exit(1);
    }
  }
  
  // 4. Remove launch configurations for the project from .vscode/launch.json
  const launchJsonPath = path.join(rootDir, '.vscode', 'launch.json');
  if (fs.existsSync(launchJsonPath)) {
    try {
      // Read and parse launch.json
      const launchJsonData = JSON.parse(fs.readFileSync(launchJsonPath, 'utf8'));
      
      // If configurations section exists
      if (launchJsonData.configurations) {
        // Filter out configurations that target the removed project
        const projectDirPattern = `\${workspaceFolder}/packages/${projectSlug}`;
        launchJsonData.configurations = launchJsonData.configurations.filter(config => {
          return !(config.cwd && config.cwd === projectDirPattern);
        });
        
        // Write updated launch.json
        fs.writeFileSync(
          launchJsonPath,
          JSON.stringify(launchJsonData, null, 2),
          'utf8'
        );
        console.log(`Updated launch.json to remove configurations for ${projectSlug}`);
      }
    } catch (err) {
      console.error(`Error updating launch.json: ${err.message}`);
      process.exit(1);
    }
  }
  
  console.log(`Successfully removed package ${projectSlug} and all related configurations`);
}

// Set up a package directory by installing dependencies and linking shared modules
function setupPackage(packageDir, packageManager) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  const sharedDir = path.join(packageDir, '../shared');
  const srcDir = path.join(packageDir, 'src');
  const sharedLink = path.join(srcDir, '@shared');

  // Check if package.json exists in the directory
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`Error: Missing package.json in ${packageDir}`);
    process.exit(1);
  }

  // Check if ../shared exists
  if (!fs.existsSync(sharedDir)) {
    console.error(`Error: Missing shared directory at ${sharedDir}`);
    process.exit(1);
  }

  // Install package dependencies
  if (!installPackageDependencies(packageDir, false, packageManager)) {
    process.exit(1);
  }

  // Create ./src if it does not exist
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  // Create a relative symlink to the shared directory
  createRelativeSymlink(sharedDir, sharedLink);
}

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  let projectSlug = null;
  let packageManager = 'npm';
  let remove = false;
  
  // Determine the rootDir as "../../../" relative to the current script
  const scriptDir = path.dirname(require.main.filename);
  const rootDir = path.resolve(scriptDir, '../../..');
  
  // Validate arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Check if this is a package manager argument
    if (arg === '--npm' || arg === '--yarn' || arg === '--pnpm') {
      packageManager = arg.substring(2); // Remove the '--' prefix
    } 
    // Check if this is the remove command
    else if (arg === '--remove') {
      remove = true;
    }
    // First non-flag argument is considered the projectSlug
    else if (!arg.startsWith('--') && projectSlug === null) {
      projectSlug = arg;
    } 
    // Unknown argument
    else {
      console.error(`Error: Unknown argument: ${arg}`);
      showUsage();
      process.exit(1);
    }
  }
  
  // Check if rootDir exists
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(`Error: Root directory not found: ${rootDir}`);
    process.exit(1);
  }
  
  // If projectSlug is provided, validate it
  if (projectSlug !== null) {
    // Ensure projectSlug is not 'shared'
    if (projectSlug === 'shared') {
      console.error('Error: projectSlug cannot be "shared"');
      process.exit(1);
    }
    
    // Check if project directory exists
    const projectDir = path.join(rootDir, 'packages', projectSlug);
    if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
      console.error(`Error: Project directory not found: ${projectDir}`);
      process.exit(1);
    }
  }
  
  // If remove is true, ensure projectSlug is provided
  if (remove && projectSlug === null) {
    console.error('Error: project must be specified when using --remove');
    showUsage();
    process.exit(1);
  }
  
  // Check if the specified package manager is installed (if not removing)
  if (!remove && !isPackageManagerInstalled(packageManager)) {
    console.error(`Error: ${packageManager} is not installed or not available in the system path`);
    process.exit(1);
  }
  
  return { rootDir, projectSlug, packageManager, remove };
}

// Show usage information
function showUsage() {
  if (os.platform() === 'win32') {
    console.error('Usage: setup.cmd [project] [--npm|--yarn|--pnpm|--remove]');
  } else {
    console.error('Usage: sh ./setup.sh [project] [--npm|--yarn|--pnpm|--remove]');
  }
}

// Main script logic
function main() {
  // Ensure the script is run as administrator on Windows
  if (os.platform() === 'win32' && !isAdminWindows()) {
    console.error('Error: This script must be run as Administrator on Windows.');
    process.exit(1);
  }

  // Parse command line arguments
  const { rootDir, projectSlug, packageManager, remove } = parseArguments();
  
  // If --remove option is specified, remove the package and exit
  if (remove) {
    removePackage(rootDir, projectSlug);
    return;
  }
  
  // If projectSlug is specified, set up only that package
  if (projectSlug !== null) {
    const packagePath = path.join(rootDir, 'packages', projectSlug);
    setupPackage(packagePath, packageManager);
  } else {
    // Otherwise, set up all packages in the packages directory (excluding shared)
    const packagesDir = path.join(rootDir, 'packages');
    
    // Check if packages directory exists
    if (!fs.existsSync(packagesDir) || !fs.statSync(packagesDir).isDirectory()) {
      console.error(`Error: Packages directory not found: ${packagesDir}`);
      process.exit(1);
    }
    
    // Get all package directories (excluding shared)
    fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && dirent.name !== 'shared')
      .forEach(dirent => {
        const packagePath = path.join(packagesDir, dirent.name);
        if (fs.existsSync(path.join(packagePath, 'package.json'))) {
          setupPackage(packagePath, packageManager);
        }
      });
  
    // Install root dependencies, including development ones, for the entire monorepo
    if (!installPackageDependencies(rootDir, true, packageManager)) {
      process.exit(1);
    }
  }
}

// Execute the main function
main();