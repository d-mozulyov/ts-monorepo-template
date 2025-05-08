/**
 * Utility module for project-related operations in the monorepo.
 * Contains constants, color formatting, and functions for handling project paths, symlinks, Git checks, and project settings.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

// Initialize __debug based on process.debugPort
const __debug = typeof process.debugPort === 'number';

// Global constants for directory paths
const __filename = fileURLToPath(import.meta.url);
const __clidir = path.dirname(__filename);
const __rootdir = path.dirname(__clidir);
const __shareddir = path.join(__rootdir, 'shared');

// Colors object for console output formatting
const colors = {
  // Text colors
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  // Styles
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
  italic: (text) => `\x1b[3m${text}\x1b[0m`
};

/**
 * Checks if the script has permissions to create symlinks on Windows, caching the result
 * @returns {boolean} True if symlink permissions are available or not on Windows
 */
function hasSymlinkPermissions() {
  if (typeof hasSymlinkPermissions.cachedResult === 'undefined') {
    if (os.platform() !== 'win32') {
      hasSymlinkPermissions.cachedResult = true;
    } else {
      try {
        execSync('net session', { stdio: 'ignore' });
        hasSymlinkPermissions.cachedResult = true;
      } catch (error) {
        hasSymlinkPermissions.cachedResult = false;
      }
    }
  }
  return hasSymlinkPermissions.cachedResult;
}

/**
 * Checks if the root directory is under Git version control, caching the result
 * @returns {boolean} True if the directory is under Git version control
 */
function hasGit() {
  if (typeof hasGit.cachedResult === 'undefined') {
    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: __rootdir, stdio: 'ignore' });
      hasGit.cachedResult = true;
    } catch (error) {
      hasGit.cachedResult = false;
    }
  }
  return hasGit.cachedResult;
}

/**
 * Generates the project directory path based on project name and locality
 * @param {string} projectName - Project name in slug format
 * @param {boolean} [isLocal=false] - If true, returns path relative to 'projects' directory
 * @returns {string} - Full or local path to the project directory
 */
function getProjectDir(projectName, isLocal = false) {
  // Normalize projectName separators to the current OS
  const normalizedProjectName = projectName.replace(/[\\/]/g, path.sep);

  if (isLocal) {
    return path.join('projects', normalizedProjectName);
  }
  return path.join(__rootdir, 'projects', normalizedProjectName);
}

/**
 * Generates a package name for the project in the monorepo
 * @param {string} projectName - Project name in slug format
 * @returns {string} - Formatted package name with '@monorepo/' prefix and normalized separators
 */
function getProjectPackageName(projectName) {
  // Replace any separators with hyphen and ensure consistent format
  const normalizedProjectName = projectName.replace(/[\\/]/g, '-');
  return `@monorepo/${normalizedProjectName}`;
}

/**
 * Resolves a project-related path to a full path, handling shared directory logic
 * @param {string} projectName - Project name in slug format
 * @param {string} value - Path to resolve
 * @param {boolean} [allowShared=false] - Whether to allow shared directory logic
 * @returns {string} - Full resolved path
 */
function getProjectFullPath(projectName, value, allowShared = false) {
  // Normalize path separators to the current OS
  const normalizedPath = value.replace(/\//g, path.sep);

  // Check if shared logic should be applied
  if (
    allowShared &&
    normalizedPath.startsWith('SHARED') &&
    (normalizedPath.length === 'SHARED'.length || normalizedPath['SHARED'.length] === path.sep)
  ) {
    // Extract the part after 'SHARED/' (or empty string if only 'SHARED')
    const sharedRelativePath = normalizedPath.slice('SHARED'.length + 1);
    // Return path by concatenating shared directory and relative path
    return path.join(__shareddir, sharedRelativePath);
  }

  // Default: join with project directory
  return path.join(getProjectDir(projectName), normalizedPath);
}

/**
 * Converts a JavaScript value to a JSON string.
 * @param {any} value - The value to convert.
 * @param {boolean} [compact=false] - Whether to compact arrays without nested objects to a single line.
 * @returns {string} The JSON string.
 */
function jsonStringify(value, compact = false) {
  let jsonString = JSON.stringify(value, null, 2).replace(/\n/g, os.EOL);
  if (compact) {
    // Convert arrays without nested objects to a single-line format
    jsonString = jsonString.replace(
      /\[\s+([^\[\]\{\}]+?)\s+\]/g,
      (match, inner) => {
        const compactedArray = inner
          .split(os.EOL)
          .map(line => line.trim())
          .filter(Boolean)
          .join(' ');
        return `[${compactedArray}]`;
      }
    );
  }
  return jsonString;
}

/**
 * Sets up a relative symlink, ensuring proper configuration and handling
 * @param {string} fullSymlinkPath - Full path where the symlink will be created
 * @param {string} fullSourcePath - Full path to the source file or directory
 * @throws {Error} If the source path does not exist or symlink creation fails
 */
function setupSymlink(fullSymlinkPath, fullSourcePath) {
  // Check if fullSourcePath exists
  if (!fs.existsSync(fullSourcePath)) {
    throw new Error(`Source path does not exist: ${fullSourcePath}`);
  }

  // Create directory structure for symlink
  const linkDir = path.dirname(fullSymlinkPath);
  if (!fs.existsSync(linkDir)) {
    fs.mkdirSync(linkDir, { recursive: true });
  }

  // Remove existing symlink if it exists
  if (fs.existsSync(fullSymlinkPath)) {
    fs.unlinkSync(fullSymlinkPath);
  }

  // Determine relative path to source
  const relativeSource = path.relative(path.dirname(fullSymlinkPath), fullSourcePath);

  // Create symlink
  const stats = fs.statSync(fullSourcePath);
  const symlinkType = stats.isDirectory() ? 'dir' : 'file';
  fs.symlinkSync(relativeSource, fullSymlinkPath, symlinkType);
  console.log(`Created symlink: ${fullSymlinkPath} -> ${relativeSource.replace(/\//g, '/')}`);
}

/**
 * Sets up symlinks for a project based on its setup.json configuration
 * @param {string} projectName - Project name in slug format
 * @throws {Error} If setup.json does not exist or symlink creation fails
 */
function setupProjectSymlinks(projectName) {
  const setupPath = getProjectFullPath(projectName, 'setup.json');

  // Check if setup.json exists
  if (!fs.existsSync(setupPath)) {
    throw new Error(`Setup file does not exist: ${setupPath}`);
  }

  // Load setup configuration
  const setup = JSON.parse(fs.readFileSync(setupPath, 'utf8'));

  // Iterate through all symlinks defined in setup.symlinks
  for (const [symlinkPath, sourcePath] of Object.entries(setup.symlinks || {})) {
    const fullSymlinkPath = getProjectFullPath(projectName, symlinkPath);
    const fullSourcePath = getProjectFullPath(projectName, sourcePath, true);
    setupSymlink(fullSymlinkPath, fullSourcePath);
  }
}

/**
 * Creates a settings object for project creation
 * @param {string} projectName - Project name in slug format
 * @param {string} projectType - Type of project to create
 * @returns {Object} - Project settings object
 */
function createProjectSettings(projectName, projectType) {
  const projectDir = getProjectDir(projectName);
  const projectParentDir = path.dirname(projectDir);
  const packageName = getProjectPackageName(projectName);
  const vscodeDir = path.join(projectDir, '.vscode');

  const settings = {
    basic: {
      projectDir,
      projectParentDir,
      projectName,
      projectType,
      packageName,
      vscodeDir,
      files: {},
      dependencies: new Set(),
      devDependencies: new Set(),
      defaultScripts: {}
    },
    func: {
      /**
       * Resolves a path to a full path, optionally handling shared directory logic
       * @param {string} value - Path to resolve
       * @param {boolean} [allowShared=false] - Whether to allow shared directory logic
       * @returns {string} - Full resolved path
       */
      getFullPath: function(value, allowShared = false) {
        return getProjectFullPath(this.basic.projectName, value, allowShared);
      },

      /**
       * Adds a file to the project settings, handling nested keys and file reading
       * @param {string} key - Dot-separated key for nested access (e.g., 'part1.part2.part3')
       * @param {string|string[]} paths - Single path or array of paths to search for the file
       * @param {any} defValue - Default value if file is not found; type determines read format
       * @returns {any} The value stored at the nested key
       */
      addFile: function(key, paths, defValue) {
        // Handle nested key access by creating intermediate objects if needed
        const keyParts = key.split('.');
        let current = this;
        for (let i = 0; i < keyParts.length - 1; i++) {
          if (!current[keyParts[i]]) {
            current[keyParts[i]] = {};
          }
          current = current[keyParts[i]];
        }
        const lastKey = keyParts[keyParts.length - 1];

        // Return existing value if key already exists
        if (current[lastKey] !== undefined) {
          return current[lastKey];
        }

        // Determine full path based on input type
        let fullpath;
        if (Array.isArray(paths)) {
          // Try each path in the array until a file is found
          for (const p of paths) {
            const testPath = this.func.getFullPath(p);
            if (fs.existsSync(testPath)) {
              fullpath = testPath;
              break;
            }
          }
          // If no file found, use the first path
          if (!fullpath) {
            fullpath = this.func.getFullPath(paths[0]);
          }
        } else {
          // Use the single path provided
          fullpath = this.func.getFullPath(paths);
        }

        // Store the full path in files mapping
        this.basic.files[key] = fullpath;

        // Read file or use default value
        let value;
        if (!fs.existsSync(fullpath)) {
          value = defValue;
        } else {
          if (Array.isArray(defValue)) {
            // Read file as array of strings for text files
            const content = fs.readFileSync(fullpath, 'utf8');
            value = content.split(/\r?\n/);
          } else {
            // Read file as JSON object
            const content = fs.readFileSync(fullpath, 'utf8');
            value = JSON.parse(content);
          }
        }

        // Set the value at the nested key
        current[lastKey] = value;
        return value;
      },

      /**
       * Adds dependencies and devDependencies to the project settings
       * @param {string|string[]} dependencies - Single dependency or array of dependencies
       * @param {string|string[]} [devDependencies=[]] - Single devDependency or array of devDependencies
       */
      addDependencies: function(dependencies, devDependencies = []) {
        // Prepare pairs of section names and their respective values
        const depPairs = [
          { name: 'dependencies', values: Array.isArray(dependencies) ? dependencies : [dependencies] },
          { name: 'devDependencies', values: Array.isArray(devDependencies) ? devDependencies : [devDependencies] }
        ];

        // Process each section (dependencies and devDependencies)
        for (const { name, values } of depPairs) {
          const deps = this.basic[name]; // Set to store dependencies (Set)
          const packageDeps = this.package[name]; // Object in package.json

          // Iterate through each value in the values array
          for (const value of values) {
            const trimmedValue = value.trim();
            // Skip empty values
            if (!trimmedValue) continue;

            // Add to the Set if not already in package.json
            if (!packageDeps[trimmedValue]) {
              deps.add(trimmedValue);
            }
          }
        }
      },

      /**
       * Adds devDependencies to the project settings by calling addDependencies
       * @param {string|string[]} devDependencies - Single devDependency or array of devDependencies
       */
      addDevDependencies: function(devDependencies) {
        this.func.addDependencies([], devDependencies);
      },

      /**
       * Adds ESLint-related devDependencies to the project settings
       */
      addEslintDependencies: function() {
        this.func.addDevDependencies([
          'eslint',
          '@typescript-eslint/parser',
          '@typescript-eslint/eslint-plugin'
        ]);
      },

      /**
       * Adds Jest-related devDependencies to the project settings
       * @param {string|string[]} [libraries=[]] - Library or array of libraries to include with Jest
       */
      addJestDependencies: function(libraries = []) {
        const jestDependencies = [
          'jest',
          'ts-jest',
          '@types/jest',
          '@jest/globals'
        ];

        const addLibrary = (name) => {
          if (!name) return;
          switch (name) {
            case 'react':
              jestDependencies.push('jest-environment-jsdom', '@testing-library/jest-dom', '@testing-library/react');
              break;
            default:
              jestDependencies.push(name);
              break;
          }
        };

        if (typeof libraries === 'string') {
          addLibrary(libraries);
        } else if (Array.isArray(libraries)) {
          libraries.forEach(addLibrary);
        }

        this.func.addDevDependencies(jestDependencies);
      },

      /**
       * Adds a path to .gitignore under a specific section
       * @param {string} sectionComment - Comment for the section in .gitignore
       * @param {string} ignorePath - Path to ignore
       */
      gitignore: function(sectionComment, ignorePath) {
        if (!this.gitignore) return;

        const trimmedIgnorePath = ignorePath.trim();
        if (!trimmedIgnorePath) return;

        const simplifiedIgnorePath = trimmedIgnorePath.endsWith('/')
          ? trimmedIgnorePath.slice(0, -1)
          : trimmedIgnorePath;

        // Check if path is already ignored
        if (this.gitignore.some(line => {
          return line === trimmedIgnorePath || line === simplifiedIgnorePath;
        })) {
          return;
        }

        // Find insertion position
        let insertPosition = this.gitignore.length;
        const sectionHeader = `# ${sectionComment.trim()}`;
        const sectionIndex = this.gitignore.findIndex(line => line === sectionHeader);

        if (sectionIndex !== -1) {
          // Section found, look for empty line after it
          for (let i = sectionIndex + 1; i < this.gitignore.length; i++) {
            if (this.gitignore[i].trim() === '') {
              insertPosition = i;
              break;
            }
          }
        } else {
          // Section not found, prepare to add it
          if (this.gitignore.length > 0) {
            this.gitignore.push('');
          }
          this.gitignore.push(sectionHeader);
          insertPosition = this.gitignore.length;
        }

        // Insert the ignore path at the determined position
        this.gitignore.splice(insertPosition, 0, trimmedIgnorePath);
      },

      /**
       * Adds directories to .gitignore and VS Code exclude settings
       * @param {string|string[]} dir - Single directory or array of directories to ignore
       */
      ignoreDir: function(dir) {
        // Convert single string to array for uniform processing
        const dirs = Array.isArray(dir) ? dir : [dir];

        for (const d of dirs) {
          // Update .gitignore
          this.func.gitignore('Ignore directories', d);

          // Handle VS Code settings updates
          if (this.vscode && this.vscode.settings) {
            const vscodeSettings = this.vscode.settings;
            // Initialize files.exclude if it doesn't exist
            if (!vscodeSettings['files.exclude']) {
              vscodeSettings['files.exclude'] = {};
            }
            // Initialize search.exclude if it doesn't exist
            if (!vscodeSettings['search.exclude']) {
              vscodeSettings['search.exclude'] = {};
            }
            // Mark directory as excluded in both settings
            vscodeSettings['files.exclude'][d] = true;
            vscodeSettings['search.exclude'][d] = true;
          }
        }
      },

      /**
       * Adds a symlink configuration to the project settings
       * @param {string} symlinkPath - Relative path for the symlink
       * @param {string} sourcePath - Relative path to the target file or directory
       * @throws {Error} If the symlink source path does not exist
       */
      addSymlink: function(symlinkPath, sourcePath) {
        // Verify source path exists
        const fullSourcePath = this.func.getFullPath(sourcePath, true);
        if (!fs.existsSync(fullSourcePath)) {
          throw new Error(`Symlink source path does not exist: ${fullSourcePath}`);
        }

        // Normalize separators to forward slashes
        const normalizedSymlinkPath = symlinkPath.replace(/[\\/]/g, '/');
        const normalizedSourcePath = sourcePath.replace(/[\\/]/g, '/');

        // Store symlink configuration
        this.setup.symlinks[normalizedSymlinkPath] = normalizedSourcePath;

        // Add symlink path to .gitignore
        this.func.gitignore('Ignore internal symlinks', normalizedSymlinkPath);
      },

      /**
       * Sets the source directory for the project and updates related configurations
       * @param {string} value - The source directory path
       */
      setSourceDir: function(value) {
        // Normalize separators to forward slashes
        const normalizedValue = value.replace(/[\\/]/g, '/');

        // Store the source directory
        this.sourceDir = normalizedValue;

        // Add symlink to shared directory
        this.func.addSymlink(`${normalizedValue}/@shared`, 'SHARED');

        // Update tsconfig if value is not 'src'
        if (normalizedValue !== 'src') {
          if (this.tsconfig.compilerOptions.rootDir === './src') {
            this.tsconfig.compilerOptions.rootDir = `./${normalizedValue}`;
          }
          this.tsconfig.include = this.tsconfig.include.map(inc =>
            inc.startsWith('src/') ? `${normalizedValue}/${inc.slice(4)}` : inc
          );
        }
      },

      /**
       * Sets the build output directory and updates related configurations
       * @param {string} value - The build output directory path
       */
      setBuildDir: function(value) {
        // Normalize separators to forward slashes
        const normalizedValue = value.replace(/[\\/]/g, '/');

        // Store build directory in setup
        this.setup.builddir = normalizedValue;
        this.setup.production.paths.push(normalizedValue);

        // Store the build directory
        this.buildDir = normalizedValue;

        // Ignore the build directory
        this.func.ignoreDir(normalizedValue);

        // Update clean script if it's the default ToDo and add rimraf
        if (this.package && this.package.scripts && this.package.scripts.clean === this.basic.defaultScripts.clean) {
          this.package.scripts.clean = `rimraf ./${normalizedValue}`;
          this.func.addDevDependencies('rimraf');
        }

        // Update tsconfig if value is not 'dist'
        if (normalizedValue !== 'dist') {
          if (this.tsconfig.compilerOptions.outDir && this.tsconfig.compilerOptions.outDir === './dist') {
            this.tsconfig.compilerOptions.outDir = `./${normalizedValue}`;
          }
          if (this.tsconfig.compilerOptions.tsBuildInfoFile && this.tsconfig.compilerOptions.tsBuildInfoFile.startsWith('./dist/')) {
            this.tsconfig.compilerOptions.tsBuildInfoFile = `./${normalizedValue}/tsconfig.tsbuildinfo`;
          }
        }
      },

      /**
       * Saves a file to the specified path.
       * @param {string} fileName - The full path to the file.
       * @param {any} value - The content to save.
       */
      saveFile: function(fileName, value) {
        // Ensure the target directory exists
        const dir = path.dirname(fileName);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Save based on value type
        if (Array.isArray(value)) {
          // Save as text file with UTF-8 BOM
          const bom = '\uFEFF';
          const content = bom + value.join(os.EOL);
          fs.writeFileSync(fileName, content, 'utf8');
        } else {
          // Save as JSON file
          const content = jsonStringify(value, true);
          fs.writeFileSync(fileName, content, 'utf8');
        }
      },

      /**
       * Saves all files registered in basic.files to their respective paths
       * @throws {Error} If a nested key's value cannot be found
       */
      save: function() {
        // Iterate through all registered files
        for (const [key, fullpath] of Object.entries(this.basic.files)) {
          // Navigate to the nested value using dot-separated key
          const keyParts = key.split('.');
          let current = this;
          for (const part of keyParts) {
            if (current[part] === undefined) {
              throw new Error(`Cannot find value for key ${key}`);
            }
            current = current[part];
          }
          const value = current;

          // Save based on value type
          this.func.saveFile(fullpath, value);
        }

        // Save VS Code configurations
        this.vscode.save();
      },

      /**
       * Installs dependencies and devDependencies in the project directory using npm
       * and sorts dependencies in package.json
       */
      install: function() {
        // Log the start of dependency installation
        console.log('Installing dependencies...');

        // Build the npm install command
        let command = 'npm install';

        // Add dependencies if any
        if (this.basic.dependencies.size > 0) {
          command += ` ${Array.from(this.basic.dependencies).join(' ')}`;
        }

        // Add devDependencies with -D flag if any
        if (this.basic.devDependencies.size > 0) {
          command += ` -D ${Array.from(this.basic.devDependencies).join(' ')}`;
        }

        // Ensure npm install is run before the command if it includes dependencies
        if (command !== 'npm install') {
          command = `npm install --loglevel=error && ${command}`;
        }

        // Execute the command in the project directory
        try {
          execSync(command, { cwd: this.basic.projectDir, stdio: 'inherit' });
        } catch (error) {
          throw new Error(`Failed to install dependencies: ${error.message}`);
        }

        // Update package.json to sort dependencies
        const packagePath = path.join(this.basic.projectDir, 'package.json');
        try {
          const packageObj = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

          // Sort dependencies and devDependencies
          for (const section of ['dependencies', 'devDependencies']) {
            if (packageObj[section]) {
              const sortedDeps = {};
              Object.keys(packageObj[section])
                .sort()
                .forEach(key => {
                  sortedDeps[key] = packageObj[section][key];
                });
              packageObj[section] = sortedDeps;
            }
          }

          // Save the updated package.json
          fs.writeFileSync(packagePath, jsonStringify(packageObj), 'utf8');
        } catch (error) {
          throw new Error(`Failed to update package.json: ${error.message}`);
        }
      }
    },
    vscode: {
      /**
       * Adds a VSCode configuration object
       * @param {string} name - Configuration name (e.g., 'tasks', 'launch', 'settings')
       * @param {Object} obj - Configuration object
       */
      add: function(name, obj) {
        this.vscode[name] = obj;
      },

      /**
       * Saves all VSCode configuration objects to their respective files
       * Transforms objects based on their type (tasks, launch) before saving
       */
      save: function() {
        // .vscode directory
        if (!fs.existsSync(this.basic.vscodeDir)) {
          fs.mkdirSync(this.basic.vscodeDir, { recursive: true });
        }

        for (const [name, obj] of Object.entries(this.vscode)) {
          if (typeof obj !== 'object') continue;

          // Transform configuration based on type using switch
          let result;
          switch (name) {
            case 'tasks':
              result = {
                "version": "2.0.0",
                "tasks": Object.values(obj)
              };
              break;
            case 'launch':
              result = {
                "version": "0.2.0",
                "configurations": Object.values(obj)
              };
              break;
            default:
              result = obj;
              break;
          }

          // Save the configuration as JSON
          const filePath = path.join(this.basic.vscodeDir, `${name}.json`);
          this.func.saveFile(filePath, result);
        }
      }
    }
  };

  // Populate defaultScripts with default script commands
  const defaultScriptNames = ['clean', 'lint', 'test', 'build', 'start', 'dev'];
  for (const scriptName of defaultScriptNames) {
    settings.basic.defaultScripts[scriptName] = `echo ToDo: ${scriptName}`;
  }

  // Automatically bind all functions in all nested objects to the settings context
  Object.keys(settings).forEach(section => {
    if (typeof settings[section] === 'object' && settings[section] !== null) {
      Object.keys(settings[section]).forEach(key => {
        if (typeof settings[section][key] === 'function') {
          settings[section][key] = settings[section][key].bind(settings);
        }
      });
    }
  });

  return settings;
}

export {
  __debug,
  __clidir,
  __rootdir,
  __shareddir,
  colors,
  hasSymlinkPermissions,
  hasGit,
  getProjectDir,
  getProjectPackageName,
  getProjectFullPath,
  jsonStringify,
  setupSymlink,
  setupProjectSymlinks,
  createProjectSettings
};
