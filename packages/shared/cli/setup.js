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

// Set up a package directory by installing dependencies and linking shared modules
function setupPackage(packageDir) {
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

  // Run npm install to install dependencies
  try {
    execSync('npm install --include=dev', { cwd: packageDir, stdio: 'inherit' });
  } catch (err) {
    console.error(`Error: Failed running npm install in ${packageDir}: ${err.message}`);
    process.exit(1);
  }

  // Create ./src if it does not exist
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  // Create a relative symlink to the shared directory
  createRelativeSymlink(sharedDir, sharedLink);
}

// Main script logic
function main() {
  // Ensure the script is run as administrator on Windows
  if (os.platform() === 'win32' && !isAdminWindows()) {
    console.error('Error: This script must be run as Administrator on Windows.');
    process.exit(1);
  }

  const args = process.argv.slice(2);

  // Allow only 0 or 1 argument (directory path)
  if (args.length > 1) {
    console.error('Error: Too many arguments. Usage: node setup.js [directory]');
    process.exit(1);
  }

  // Determine the root directory (default: current working directory)
  const rootDir = args[0] ? path.resolve(args[0]) : process.cwd();

  // Validate the directory path
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(`Error: Invalid directory path: ${rootDir}`);
    process.exit(1);
  }

  const sharedPath = path.join(rootDir, 'packages/shared');

  if (!fs.existsSync(sharedPath)) {
    // If there is no ./packages/shared, setup the root directory
    setupPackage(rootDir);
  } else {
    // Otherwise, iterate over packages (excluding ./packages/shared)
    const packagesDir = path.join(rootDir, 'packages');
    fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && dirent.name !== 'shared')
      .forEach(dirent => {
        const packagePath = path.join(packagesDir, dirent.name);
        if (fs.existsSync(path.join(packagePath, 'package.json'))) {
          setupPackage(packagePath);
        }
      });
  }
}

// Execute the main function
main();
