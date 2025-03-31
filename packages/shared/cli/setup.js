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
  let baseDir = process.cwd();
  let packageManager = 'npm';
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Check if this is a package manager argument
    if (arg === '--npm' || arg === '--yarn' || arg === '--pnpm') {
      packageManager = arg.substring(2); // Remove the '--' prefix
    } 
    // Otherwise, assume it's a directory path
    else if (!arg.startsWith('--')) {
      baseDir = path.resolve(arg);
      
      // Validate the directory path
      if (!fs.existsSync(baseDir) || !fs.statSync(baseDir).isDirectory()) {
        console.error(`Error: Invalid directory path: ${baseDir}`);
        process.exit(1);
      }
    } 
    // Unknown argument
    else {
      console.error(`Error: Unknown argument: ${arg}`);
      if (os.platform() === 'win32') {
        console.error('Usage: setup.cmd [directory] [--npm|--yarn|--pnpm]');
      } else {
        console.error('Usage: sh ./setup.cmd [directory] [--npm|--yarn|--pnpm]');
      }
      process.exit(1);
    }
  }
  
  // Check if the specified package manager is installed
  if (!isPackageManagerInstalled(packageManager)) {
    console.error(`Error: ${packageManager} is not installed or not available in the system path`);
    process.exit(1);
  }
  
  return { baseDir, packageManager };
}

// Main script logic
function main() {
  // Ensure the script is run as administrator on Windows
  if (os.platform() === 'win32' && !isAdminWindows()) {
    console.error('Error: This script must be run as Administrator on Windows.');
    process.exit(1);
  }

  // Parse command line arguments
  const { baseDir, packageManager } = parseArguments();
  const sharedPath = path.join(baseDir, 'packages/shared');
  const isRoot = fs.existsSync(sharedPath);

  if (!isRoot) {
    // If there is no ./packages/shared, setup the root directory
    setupPackage(baseDir, packageManager);
  } else {
    // Otherwise, iterate over packages (excluding ./packages/shared)
    const packagesDir = path.join(baseDir, 'packages');
    fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && dirent.name !== 'shared')
      .forEach(dirent => {
        const packagePath = path.join(packagesDir, dirent.name);
        if (fs.existsSync(path.join(packagePath, 'package.json'))) {
          setupPackage(packagePath, packageManager);
        }
      });
  
    // Install root dependencies, including development ones, for the entire monorepo
    if (!installPackageDependencies(baseDir, true, packageManager)) {
      process.exit(1);
    }
  }
}

// Execute the main function
main();