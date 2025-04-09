import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';

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
    console.log(`Created symlink: ${linkPath} -> ${relativeTarget}`);
  } catch (err) {
    console.error(`Error: Failed to create symlink: ${err.message}`);
    process.exit(1);
  }
}

// Create symlinks to shared directory for all projects
function createSharedSymlinks(rootDir) {
  const projectsDir = path.join(rootDir, 'projects');
  const sharedDir = path.join(rootDir, 'shared');

  // Check if projects directory exists
  if (!fs.existsSync(projectsDir) || !fs.statSync(projectsDir).isDirectory()) {
    console.error(`Error: projects directory not found: ${projectsDir}`);
    process.exit(1);
  }

  // Check if shared directory exists
  if (!fs.existsSync(sharedDir)) {
    console.error(`Error: Missing shared directory at ${sharedDir}`);
    process.exit(1);
  }

  // Get all package directories (excluding shared)
  fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .forEach(dirent => {
      const packagePath = path.join(projectsDir, dirent.name);
      const srcDir = path.join(packagePath, 'src');
      const sharedLink = path.join(srcDir, '@shared');

      // Skip if no package.json exists
      if (!fs.existsSync(path.join(packagePath, 'package.json'))) {
        return;
      }

      // Create ./src if it does not exist
      if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
      }

      // Create a relative symlink to the shared directory
      createRelativeSymlink(sharedDir, sharedLink);
    });
}

// Install dependencies for the entire monorepo
function installDependencies(rootDir) {
  try {
    console.log('Installing dependencies for the entire monorepo...');
    execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
    console.log('Successfully installed dependencies');
    return true;
  } catch (err) {
    console.error(`Error: Failed to install dependencies: ${err.message}`);
    return false;
  }
}

// Main script logic
function main() {
  // Ensure the script is run as administrator on Windows
  if (os.platform() === 'win32' && !isAdminWindows()) {
    console.error('Error: This script must be run as Administrator on Windows.');
    process.exit(1);
  }

  // Determine the rootDir as "../../" relative to the current script
  // In ES modules we need to use fileURLToPath instead of require.main.filename
  const __filename = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(__filename);
  const rootDir = path.resolve(scriptDir, '..');

  // Check if rootDir exists and is a directory
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(`Error: Root directory not found: ${rootDir}`);
    process.exit(1);
  }

  // Check if package.json exists in rootDir
  const rootPackageJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(rootPackageJsonPath)) {
    console.error(`Error: Missing package.json in root directory: ${rootDir}`);
    process.exit(1);
  }

  // Check if projects directory exists
  const projectsDir = path.join(rootDir, 'projects');
  if (!fs.existsSync(projectsDir) || !fs.statSync(projectsDir).isDirectory()) {
    console.error(`Error: projects directory not found: ${projectsDir}`);
    process.exit(1);
  }

  // Create symlinks to shared directory for all projects
  createSharedSymlinks(rootDir);

  // Install dependencies for the entire monorepo
  if (!installDependencies(rootDir)) {
    process.exit(1);
  }
}

try {
  main();
} catch (err) {
  console.error('Unhandled error:', err);
  process.exit(1);
}