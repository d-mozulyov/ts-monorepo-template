/**
 * Module for creating project-specific package-lock.json files.
 * Processes dependencies and generates a lock file for a specified project.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { __rootdir, colors, getProjectDir, jsonStringify } from './project-utils.js';

// Global variables
let IsProduction = false;
let StartPackagePath = '';
let LockData = null;
let Packages = null;

/**
 * Save lock data to file
 * @param {string} fileName - Name of the file to save lock data to
 * @throws {Error} If file writing fails
 */
function saveLockData(fileName) {
  const filePath = path.join(__rootdir, fileName);
  fs.writeFileSync(filePath, jsonStringify(LockData), 'utf8');
  console.log(`Successfully created ${fileName}`);
}

/**
 * Check if package exists
 * @param {string} packagePath - Path to the package
 * @returns {boolean} - True if package exists, false otherwise
 */
function existsPackage(packagePath) {
  return packagePath && Packages[packagePath] ? true : false;
}

/**
 * Get package object
 * @param {string} packagePath - Path to the package
 * @returns {object|null} - Package object or null if not found
 */
function getPackage(packagePath) {
  return packagePath && Packages[packagePath] || null;
}

/**
 * Get package version
 * @param {string} packagePath - Path to the package
 * @returns {string|null} - Package version or null if not found
 */
function getPackageVersion(packagePath) {
  const pkg = getPackage(packagePath);
  return pkg ? pkg.version : null;
}

/**
 * Get package name from path
 * @param {string} packagePath - Path to the package
 * @returns {string} - Package name
 */
function getPackageName(packagePath) {
  // Check if '/node_modules/' exists in the string
  const index = packagePath.lastIndexOf('/node_modules/');
  if (index !== -1) {
    return packagePath.substring(index + '/node_modules/'.length);
  }

  // Check if the string starts with 'node_modules/'
  if (packagePath.startsWith('node_modules/')) {
    return packagePath.substring('node_modules/'.length);
  }

  // Otherwise, return packagePath unchanged
  return packagePath;
}

/**
 * Get parent package path
 * @param {string} packagePath - Path to the package
 * @returns {string} - Parent package path or empty string
 */
function getParentPackagePath(packagePath) {
  const index = packagePath.lastIndexOf('/node_modules/');
  if (index !== -1) {
    return packagePath.substring(0, index);
  }
  return '';
}

/**
 * Get child package path
 * @param {string} parentPackagePath - Parent package path
 * @param {string} childPackageName - Name of the child package
 * @returns {string} - Child package path
 */
function getChildPackagePath(parentPackagePath, childPackageName) {
  if (parentPackagePath === '') {
    return `node_modules/${childPackageName}`;
  }
  return `${parentPackagePath}/node_modules/${childPackageName}`;
}

/**
 * Process dependencies of a package
 * @param {string|object} packagePathOrObj - Path to the package or package object
 * @param {function} callback - Callback function that receives dependencies object
 */
function processDeps(packagePathOrObj, callback) {
  // Determine if the first argument is a path string or a package object
  const pkg = typeof packagePathOrObj === 'string'
    ? getPackage(packagePathOrObj)
    : packagePathOrObj;

  if (!pkg) return;

  // Process regular dependencies
  if (pkg.dependencies) {
    callback(pkg.dependencies);
  }

  // Process dev dependencies if not in production mode
  if (!IsProduction && pkg.devDependencies) {
    callback(pkg.devDependencies);
  }
}

/**
 * Get dependency entry for a specific dependency name
 * @param {string|object} packagePathOrObj - Path to the package or package object
 * @param {string} depName - Name of the dependency to find
 * @returns {object|null} - The dependency entry or null if not found
 */
function getDepEntry(packagePathOrObj, depName) {
  let result = null;

  processDeps(packagePathOrObj, (deps) => {
    if (!result) {
      const entry = deps[depName];
      if (entry) {
        result = entry;
      }
    }
  });

  return result;
}

/**
 * Change dependency path for a package
 * @param {string} packagePath - Path to the package
 * @param {string} newDepPath - New dependency path
 * @throws {Error} If package or dependency is not found
 */
function changeDepPath(packagePath, newDepPath) {
  const pkg = getPackage(packagePath);
  if (!pkg) {
    throw new Error(`Package at ${packagePath} not found`);
  }

  const depName = getPackageName(newDepPath);
  const depEntry = getDepEntry(packagePath, depName);

  if (!depEntry) {
    throw new Error(`Dependency ${depName} not found in package ${packagePath}`);
  }

  const lastDepPath = depEntry.path;

  // If path is already set to newDepPath, do nothing
  if (lastDepPath === newDepPath) {
    return;
  }

  // Attach new path to owners array
  attachOwner(newDepPath, packagePath);

  // Update dependency path
  depEntry.path = newDepPath;

  // Detach old path if it was valid
  if (lastDepPath) {
    detachOwner(lastDepPath, packagePath);
  }
}

/**
 * Find dependency package path
 * @param {string} packagePath - Path to the package
 * @param {string} depName - Name of the dependency
 * @param {boolean} [lookChild=true] - Whether to look in child node_modules
 * @returns {string} - Path to the dependency package or empty string if not found
 */
function findDepPackage(packagePath, depName, lookChild = true) {
  let currentPath = lookChild ? packagePath : getParentPackagePath(packagePath);

  while (true) {
    const candidatePath = getChildPackagePath(currentPath, depName);
    if (existsPackage(candidatePath)) {
      return candidatePath;
    }

    if (currentPath === '') {
      return '';
    }

    currentPath = getParentPackagePath(currentPath);
  }
}

/**
 * Find best dependency path
 * @param {string} packagePath - Path to the package
 * @param {string} depName - Name of the dependency
 * @param {string} depVersion - Version of the dependency
 * @param {boolean} [lookChild=true] - Whether to look in child node_modules
 * @returns {string} - Best path for the dependency
 */
function findBestDepPath(packagePath, depName, depVersion, lookChild = true) {
  const foundDepPath = findDepPackage(packagePath, depName, lookChild);
  const foundDepVersion = getPackageVersion(foundDepPath);

  if (foundDepVersion === depVersion) {
    return foundDepPath;
  }

  if (!foundDepPath) {
    return getChildPackagePath('', depName);
  }

  return getChildPackagePath(packagePath, depName);
}

/**
 * Attach a package path to a package's owners array
 * @param {string|object} packagePathOrObj - Path to the package or package object
 * @param {string} ownerPackagePath - Path to be added to the owners array
 * @throws {Error} If package is not found
 */
function attachOwner(packagePathOrObj, ownerPackagePath) {
  const pkg = typeof packagePathOrObj === 'string'
    ? getPackage(packagePathOrObj)
    : packagePathOrObj;

  if (!pkg) {
    throw new Error(`Package not found for ${typeof packagePathOrObj === 'string' ? packagePathOrObj : 'provided object'}`);
  }

  if (!pkg.owners) {
    pkg.owners = [ownerPackagePath];
  } else {
    pkg.owners.push(ownerPackagePath);
  }
}

/**
 * Detach a package path from a package's owners array
 * @param {string} packagePath - Path to the package
 * @param {string} ownerPackagePath - Path to be removed from the owners array
 * @throws {Error} If package or owners array is invalid
 */
function detachOwner(packagePath, ownerPackagePath) {
  const pkg = Packages[packagePath];
  if (!pkg || !pkg.owners || !pkg.owners.length) {
    throw new Error(`Invalid package or owners array at ${packagePath}`);
  }

  if (pkg.owners.length === 1) {
    if (pkg.owners[0] !== ownerPackagePath) {
      throw new Error(`Owner package path ${ownerPackagePath} does not match ${pkg.owners[0]} at ${packagePath}`);
    }

    // Delete the package
    delete Packages[packagePath];

    // Process dependencies
    processDeps(pkg, (deps) => {
      for (const [, dep] of Object.entries(deps)) {
        if (typeof dep === 'object' && dep.path) {
          detachOwner(dep.path, packagePath);
        }
      }
    });
  } else {
    // Remove the ownerPackagePath from the owners array
    const index = pkg.owners.indexOf(ownerPackagePath);
    if (index === -1) {
      throw new Error(`Owner package path ${ownerPackagePath} not found in owners array at ${packagePath}`);
    }
    pkg.owners.splice(index, 1);
  }
}

/**
 * Create a copy of a package at a new path as part of resolving a dependency
 * @param {string} newPackagePath - New path for the package copy
 * @param {string} sourcePackagePath - Source package path to copy from
 * @param {string} ownerPackagePath - Path to the package that owns the dependency
 * @throws {Error} If ownerPackagePath is missing or source package is not found
 *
 * This function copies a package to a new location to satisfy a dependency required
 * by the package at ownerPackagePath. It not only creates the package copy but also
 * resolves all dependencies by updating paths in deps and maintaining the owners list.
 */
function createPackageCopy(newPackagePath, sourcePackagePath, ownerPackagePath) {
  // Throw error if ownerPackagePath is not provided
  if (!ownerPackagePath) {
    throw new Error('ownerPackagePath must be provided');
  }

  // If package already exists, update dependency path and exit
  if (existsPackage(newPackagePath)) {
    changeDepPath(ownerPackagePath, newPackagePath);
    return;
  }

  // Create a new package
  const sourcePkg = getPackage(sourcePackagePath);
  if (!sourcePkg) {
    throw new Error(`Source package at ${sourcePackagePath} not found`);
  }

  // Create a deep copy of the source package
  const newPkg = structuredClone(sourcePkg);
  // Initialize owners with '<dummy>' to prevent accidental deletion
  newPkg.owners = ['<dummy>'];

  // Add to packages
  Packages[newPackagePath] = newPkg;

  // Process dependencies
  processDeps(newPkg, (deps) => {
    for (const [name, entry] of Object.entries(deps)) {
      const sourceDepPath = entry.path;
      entry.path = ''; // Clear path temporarily

      // Find best path for dependency
      const newDepPath = findBestDepPath(newPackagePath, name, entry.versionFact);

      if (existsPackage(newDepPath)) {
        changeDepPath(newPackagePath, newDepPath);
      } else {
        createPackageCopy(newDepPath, sourceDepPath, newPackagePath);
      }
    }
  });

  // Update dependency path for the owner package
  changeDepPath(ownerPackagePath, newPackagePath);

  // Validate owners array
  if (newPkg.owners.length <= 1 || newPkg.owners[0] !== '<dummy>') {
    throw new Error(`Invalid owners array for ${newPackagePath}: must have more than one element and start with '<dummy>'`);
  }

  // Remove the dummy entry
  newPkg.owners.shift();
}

/**
 * Decompose a package and copy it to owners up
 * @param {string} packagePath - Path to the package to decompose
 * @throws {Error} If package is not found or not properly removed
 */
function decomposePackage(packagePath) {
  const pkg = getPackage(packagePath);
  if (!pkg) {
    throw new Error(`Package at ${packagePath} not found`);
  }

  // Save a copy of owners array
  const owners = [...(pkg.owners || [])];

  // Copy package to owners up
  const packageName = getPackageName(packagePath);
  for (const owner of owners) {
    const newPackagePath = getChildPackagePath(owner, packageName);
    createPackageCopy(newPackagePath, packagePath, owner);
  }

  // Ensure the package is removed
  if (existsPackage(packagePath)) {
    throw new Error(`Package at ${packagePath} should have been removed`);
  }
}

/**
 * Process package recursively to prepare lock data paths
 * @param {string} packagePath - Path to the package
 * @param {Set<string>} [processedPackages=new Set()] - Set of processed package paths
 * @throws {Error} If package or dependency is not found
 */
function prepareLockDataPaths(packagePath, processedPackages = new Set()) {
  if (processedPackages.has(packagePath)) {
    return;
  }

  processedPackages.add(packagePath);

  const pkg = getPackage(packagePath);
  if (!pkg) {
    throw new Error(`Package at ${packagePath} not found`);
  }

  // Process dependencies
  processDeps(packagePath, (deps) => {
    for (const [depName, depVersion] of Object.entries(deps)) {
      // Find path to package
      const depPath = findDepPackage(packagePath, depName);
      if (!depPath) {
        throw new Error(`Package ${depName} not found for ${packagePath}`);
      }

      const depPackage = getPackage(depPath);

      // Replace version with object
      deps[depName] = {
        version: depVersion,
        versionFact: depPackage.version,
        path: depPath,
      };

      // Add to owners array and process recursively
      attachOwner(depPath, packagePath);

      // Recursively process the dependency package
      prepareLockDataPaths(depPath, processedPackages);
    }
  });
}

/**
 * Prepare lock data by processing the starting package and cleaning unused packages
 */
function prepareLockData() {
  // Process starting package and its dependencies
  prepareLockDataPaths(StartPackagePath);

  // Clean unused packages except for the starting one
  const newPackages = {};
  for (const [pkgPath, pkg] of Object.entries(Packages)) {
    if (pkgPath === StartPackagePath || (pkg.owners && pkg.owners.length > 0)) {
      newPackages[pkgPath] = pkg;
    }
  }
  Packages = newPackages;
  LockData.packages = newPackages;

  // Save result
  // saveLockData('package-lock-1.json');
}

/**
 * Normalize the start package by moving all dependencies to the root level
 */
function normalizeStartPackage() {
  processDeps(StartPackagePath, (deps) => {
    for (const [name, entry] of Object.entries(deps)) {
      const depPath = entry.path;
      const newDepPath = getChildPackagePath('', name);

      // If the dependency package is already in root, skip
      if (newDepPath === depPath) {
        continue;
      }

      // Check if a dependency package with the correct version already exists in root
      const foundVersion = getPackageVersion(newDepPath);
      if (foundVersion === entry.versionFact) {
        changeDepPath(StartPackagePath, newDepPath);
        continue;
      }

      // If a dependency package exists in root but with a different version, decompose it
      if (foundVersion) {
        decomposePackage(newDepPath);
      }

      // Create dependency package copy in root level
      createPackageCopy(newDepPath, depPath, StartPackagePath);
    }
  });

  // Save the normalized lock data
  // saveLockData('package-lock-2.json');
}

/**
 * Prepare normalized lock data by removing the start package and sorting packages
 */
function prepareNormalizedLockData() {
  // Remove the start package
  delete Packages[StartPackagePath];

  // Sort packages by name
  const sortedPackages = {};
  const packageNames = Object.keys(Packages).sort();

  for (const packagePath of packageNames) {
    sortedPackages[packagePath] = Packages[packagePath];
  }

  Packages = sortedPackages;
  LockData.packages = sortedPackages;

  // Save the normalized lock data
  // saveLockData('package-lock-3.json');
}

/**
 * Optimize lock data
 */
function optimizeLockData() {
  // ToDo: Optimize dependencies paths (minimize packages count)
  // saveLockData('package-lock-4.json');
}

/**
 * Clean up lock data by replacing dependency objects with version strings
 */
function cleanUpLockData() {
  for (const packagePath in Packages) {
    const pkg = Packages[packagePath];

    // Remove owners array if it exists
    if (pkg.owners) {
      delete pkg.owners;
    }

    processDeps(pkg, (deps) => {
      for (const depName in deps) {
        const dep = deps[depName];
        if (typeof dep === 'object' && dep.version) {
          deps[depName] = dep.version;
        }
      }
    });
  }

  // Save clean lock data
  // saveLockData('package-lock-5.json');
}

/**
 * Create project-specific package-lock.json file
 * @param {string} projectInfoPath - Path to the project's package.json
 * @param {string} projectLockPath - Path to the project's package-lock.json
 * @throws {Error} If file operations fail
 */
function createProjectLockFile(projectInfoPath, projectLockPath) {
  const projectPackage = JSON.parse(fs.readFileSync(projectInfoPath, 'utf-8'));
  const projectLockData = {
    name: projectPackage.name,
    version: projectPackage.version,
    lockfileVersion: LockData.lockfileVersion || 2,
    requires: true,
    packages: {
      '': {
        name: projectPackage.name,
        version: projectPackage.version,
        dependencies: projectPackage.dependencies || {},
        devDependencies: projectPackage.devDependencies || {}
      },
      ...(LockData?.packages || {})
    }
  };

  fs.writeFileSync(projectLockPath, jsonStringify(projectLockData), 'utf8');
  console.log(`Successfully created ${projectLockPath}`);
}

/**
 * Creates a project-specific package-lock.json file
 * @param {string} projectName - The name/path of the project directory
 * @param {boolean} productionMode - Whether to exclude devDependencies
 * @throws {Error} If projectName is invalid or required files are missing
 */
export function createProjectLock(projectName, productionMode) {
  // Validate projectName
  if (!projectName || typeof projectName !== 'string' || projectName.trim() === '') {
    throw new Error('Invalid project name: projectName must be a non-empty string');
  }

  // Initialize global variables
  StartPackagePath = getProjectDir(projectName, true).replace(path.sep, '/');
  IsProduction = !!productionMode;

  try {
    // Define root lock file path
    const rootLockPath = path.join(__rootdir, 'package-lock.json');

    // Check if package-lock.json exists
    if (!fs.existsSync(rootLockPath)) {
      throw new Error(`package-lock.json not found at ${rootLockPath}`);
    }

    // Read package-lock.json
    LockData = JSON.parse(fs.readFileSync(rootLockPath, 'utf-8'));
    Packages = LockData.packages;

    // Define project directory
    const projectDir = getProjectDir(projectName);

    // Check if project directory exists
    if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
      throw new Error(`Project directory not found at ${projectDir}`);
    }

    // Define project info path and check if package.json exists
    const projectInfoPath = path.join(projectDir, 'package.json');
    if (!fs.existsSync(projectInfoPath)) {
      throw new Error(`package.json not found at ${projectInfoPath}`);
    }

    // Process lock data: package-lock-1.json
    prepareLockData();

    // Normalize start package: package-lock-2.json
    normalizeStartPackage();

    // Prepare normalized lock data: package-lock-3.json
    prepareNormalizedLockData();

    // Optimize lock data: package-lock-4.json
    optimizeLockData();

    // Clean up lock data: package-lock-5.json
    cleanUpLockData();

    // Create project-specific package-lock.json
    const projectLockPath = path.join(projectDir, 'package-lock.json');
    createProjectLockFile(projectInfoPath, projectLockPath);
  } finally {
    // Clean up global variables
    IsProduction = false;
    StartPackagePath = '';
    LockData = null;
    Packages = null;
  }
}

/**
 * Main entry point for standalone execution
 * @returns {Promise<void>}
 */
async function main() {
  const projectName = process.argv[2];
  const productionMode = process.argv[3] === '--production';

  // Display help if no arguments or --help is provided
  if (!projectName || projectName === '--help') {
    console.log(`
Usage: node create-project-lock.js <projectName> [--production]

Creates a package-lock.json file for the specified project.

Arguments:
  projectName       The name or path of the project directory.
  --production      Optional flag to exclude devDependencies.

Example:
  node create-project-lock.js my-app
  node create-project-lock.js my-app --production
    `);
    return;
  }

  console.log(`Creating package-lock.json for project: ${projectName}`);
  await createProjectLock(projectName, productionMode);
  console.log(colors.green('Done.'));
}

// Run as standalone script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(colors.red(err.message));
    console.error(colors.gray(err.stack));
    process.exit(1);
  });
}