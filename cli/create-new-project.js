import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

/**
 * Creates a settings object for project creation
 * @param {string} rootDir - Root directory of the monorepo
 * @param {string} projectDir - Project directory
 * @param {string} projectName - Project name in slug format
 * @param {string} projectType - Type of project to create
 * @returns {Object} - Project settings object
 */
function createProjectSettings(rootDir, projectDir, projectName, projectType) {
  const packageName = `@monorepo/${projectName}`;

  const settings = {
    basic: {
      rootDir,
      projectDir,
      projectName,
      projectType,
      packageName,
      files: {}
    },
    dependencies: new Set(),
    devDependencies: new Set(),
    func: {
      /**
       * Adds a file to the project settings, handling nested keys and file reading
       * @param {string} key - Dot-separated key for nested access (e.g., 'part1.part2.part3')
       * @param {string|string[]} paths - Single path or array of paths to search for the file
       * @param {any} defValue - Default value if file is not found; type determines read format
       * @returns {any} The value stored at the nested key
       */
      addFile: function(key, paths, defValue) {
        // Local function to get full path with normalized separators
        const getFullPath = (p) => {
          const normalizedPath = p.replace(/\//g, path.sep);
          return path.join(this.basic.projectDir, normalizedPath);
        };

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
            const testPath = getFullPath(p);
            if (fs.existsSync(testPath)) {
              fullpath = testPath;
              break;
            }
          }
          // If no file found, use the first path
          if (!fullpath) {
            fullpath = getFullPath(paths[0]);
          }
        } else {
          // Use the single path provided
          fullpath = getFullPath(paths);
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
            value = content.split('\n').filter(line => line.trim() !== '');
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
       * Adds directories to .gitignore and VS Code exclude settings
       * @param {string|string[]} dir - Single directory or array of directories to ignore
       */
      ignoreDir: function(dir) {
        // Convert single string to array for uniform processing
        const dirs = Array.isArray(dir) ? dir : [dir];

        for (const d of dirs) {
          // Handle .gitignore updates
          if (this.gitignore) {
            const gitignore = this.gitignore;
            // Check if directory is already ignored
            const isIgnored = gitignore.some(line => {
              const trimmed = line.trim();
              return trimmed === d || trimmed === `${d}/`;
            });

            if (!isIgnored) {
              // Find or add the "# Ignore directories" section
              const ignoreSectionIndex = gitignore.findIndex(line => line.trim() === '# Ignore directories');
              if (ignoreSectionIndex === -1) {
                gitignore.push('', '# Ignore directories');
              }
              // Add the directory to ignore
              gitignore.push(`${d}/`);
            }
          }

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

          // Ensure the target directory exists
          const dir = path.dirname(fullpath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Save based on value type
          if (Array.isArray(value)) {
            // Save as text file with UTF-8 BOM
            const bom = '\uFEFF';
            const content = bom + value.join('\n');
            fs.writeFileSync(fullpath, content, 'utf8');
          } else {
            // Save as JSON file
            const content = JSON.stringify(value, null, 2);
            fs.writeFileSync(fullpath, content, 'utf8');
          }
        }
      },

      /**
       * Installs dependencies and devDependencies in the project directory using npm
       */
      install: function() {
        // Log the start of dependency installation
        console.log('Installing dependencies...');

        // Build the npm install command
        let command = 'npm install';

        // Add dependencies if any
        if (this.dependencies.size > 0) {
          command += ` ${Array.from(this.dependencies).join(' ')}`;
        }

        // Add devDependencies with -D flag if any
        if (this.devDependencies.size > 0) {
          command += ` -D ${Array.from(this.devDependencies).join(' ')}`;
        }

        // Always add --force flag
        command += ' --force';

        // Log the command being executed
        console.log(`Executing command: ${command}`);

        // Execute the command in the project directory
        execSync(command, { cwd: this.basic.projectDir, stdio: 'inherit' });
      }
    }
  };

  // Automatically bind all functions in settings.func to the settings context
  Object.keys(settings.func).forEach(key => {
    if (typeof settings.func[key] === 'function') {
      settings.func[key] = settings.func[key].bind(settings);
    }
  });

  return settings;
}

/**
 * Creates a new project in the monorepo
 * @param {string} rootDir - Root directory of the monorepo
 * @param {string} projectType - Type of project to create
 * @param {string} [projectName] - Optional project name (will prompt if not provided or invalid)
 * @returns {string} - Path to the created project directory or empty string if creation failed
 */
async function createNewProject(rootDir, projectType, projectName = '') {
  // Validate project type
  const validProjectTypes = [
    'Empty Node.js', 'React', 'Next.js', 'Angular', 'Vue.js', 'Svelte',
    'Express.js', 'NestJS', 'Fastify', 'AdonisJS', 'FeathersJS',
    'React Native', 'Expo', 'NativeScript', 'Ionic', 'Capacitor.js',
    'Electron', 'Tauri', 'Neutralino.js', 'Proton Native', 'Sciter'
  ];

  if (!validProjectTypes.includes(projectType)) {
    console.error(`Invalid project type: ${projectType}`);
    console.error(`Valid project types: ${validProjectTypes.join(', ')}`);
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Function to ask a question and get user input
  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    // Read project name
    let projectLocalDir = '';
    let projectDir = '';

    while (true) {
      if (!projectName) {
        projectName = await question('Enter project name (e.g. "my-app"): ');
      }

      projectName = projectName.trim();

      // Validate project name
      if (!projectName) {
        console.error('Project name cannot be empty');
        projectName = ''; // Reset project name to force prompt on next iteration
        continue;
      }

      // Regexp check
      if (!/^[a-z0-9-_]+$/i.test(projectName)) {
        console.error('Project name can only contain letters, numbers, hyphens, and underscores');
        projectName = ''; // Reset project name to force prompt on next iteration
        continue;
      }

      // Paths
      projectLocalDir = path.join('projects', projectName);
      projectDir = path.join(rootDir, projectLocalDir);

      // Check if directory already exists
      if (fs.existsSync(projectDir)) {
        console.error(`Directory already exists: ${projectDir}`);
        projectName = ''; // Reset project name to force prompt on next iteration
        continue;
      }

      // Done
      break;
    }

    // Create project directory
    fs.mkdirSync(projectDir, { recursive: true });

    // Create project based on type
    await createProjectByType(rootDir, projectDir, projectName, projectType);

    // Done
    console.log(`Project "${projectName}" successfully created!`);

    // Return the project local directory path on success
    return projectLocalDir;
  } catch (error) {
    console.error('Error creating project:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

/**
 * Creates project based on its type
 * @param {string} rootDir - Root directory of the monorepo
 * @param {string} projectDir - Project directory
 * @param {string} projectName - Project name in slug format
 * @param {string} projectType - Type of project to create
 */
async function createProjectByType(rootDir, projectDir, projectName, projectType) {
  // Create project settings object
  const settings = createProjectSettings(rootDir, projectDir, projectName, projectType);

  let callback;

  switch (projectType) {
    case 'Empty Node.js':
      callback = createEmptyNodeProject(settings);
      break;
    case 'React':
      callback = createReactProject(settings);
      break;
    case 'Next.js':
      callback = createNextJsProject(settings);
      break;
    case 'Angular':
      callback = createAngularProject(settings);
      break;
    case 'Vue.js':
      callback = createVueProject(settings);
      break;
    case 'Svelte':
      callback = createSvelteProject(settings);
      break;
    case 'Express.js':
      callback = createExpressProject(settings);
      break;
    case 'NestJS':
      callback = createNestJsProject(settings);
      break;
    case 'Fastify':
      callback = createFastifyProject(settings);
      break;
    case 'AdonisJS':
      callback = createAdonisJsProject(settings);
      break;
    case 'FeathersJS':
      callback = createFeathersJsProject(settings);
      break;
    case 'React Native':
      callback = createReactNativeProject(settings);
      break;
    case 'Expo':
      callback = createExpoProject(settings);
      break;
    case 'NativeScript':
      callback = createNativeScriptProject(settings);
      break;
    case 'Ionic':
      callback = createIonicProject(settings);
      break;
    case 'Capacitor.js':
      callback = createCapacitorProject(settings);
      break;
    case 'Electron':
      callback = createElectronProject(settings);
      break;
    case 'Tauri':
      callback = createTauriProject(settings);
      break;
    case 'Neutralino.js':
      callback = createNeutralinoProject(settings);
      break;
    case 'Proton Native':
      callback = createProtonNativeProject(settings);
      break;
    case 'Sciter':
      callback = createSciterProject(settings);
      break;
    default:
      throw new Error(`Unsupported project type: ${projectType}`);
  }

  // Prepare package.json
  prepareProjectPackage(settings);

  // Prepare VSCode configurations
  prepareProjectVSCodeConfigs(settings);

  // Prepare other configurations
  prepareProjectOtherConfigs(settings);

  // Execute the save function
  settings.func.save();

  // Create symlink to shared directory
  createProjectSymlinks(settings);

  // Execute the callback returned from create function
  if (typeof callback === 'function') {
    callback();
  }

  // Update monorepo package configuration
  await updateMonorepoPackage(settings);

  // Install project dependencies
  settings.func.install();
}

/**
 * Creates an Empty Node.js project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createEmptyNodeProject(settings) {
  // ToDo

  return function() {
    console.log("ToDo: createEmptyNodeProject");
  };
}

/**
 * Creates a React project using Vite
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createReactProject(settings) {
  // execSync(`npx create-vite ${settings.basic.projectDir} --template react-ts`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createReactProject");
  };
}

/**
 * Creates a Next.js project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createNextJsProject(settings) {
  // execSync(`npx create-next-app ${settings.basic.projectDir} --typescript`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createNextJsProject");
  };
}

/**
 * Creates an Angular project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createAngularProject(settings) {
  // execSync(`npx @angular/cli new ${path.basename(settings.basic.projectDir)} --directory ${settings.basic.projectDir} --skip-git --skip-install`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createAngularProject");
  };
}

/**
 * Creates a Vue.js project using Vite
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createVueProject(settings) {
  // execSync(`npx create-vite ${settings.basic.projectDir} --template vue-ts`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createVueProject");
  };
}

/**
 * Creates a Svelte project using Vite
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createSvelteProject(settings) {
  // execSync(`npx create-vite ${settings.basic.projectDir} --template svelte-ts`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createSvelteProject");
  };
}

/**
 * Creates an Express.js project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createExpressProject(settings) {
  return function() {
    console.log("ToDo: createExpressProject");
  };
}

/**
 * Creates a NestJS project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createNestJsProject(settings) {
  // execSync(`npx @nestjs/cli new ${settings.basic.projectDir} --skip-git --package-manager npm`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createNestJsProject");
  };
}

/**
 * Creates a Fastify project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createFastifyProject(settings) {
  return function() {
    console.log("ToDo: createFastifyProject");
  };
}

/**
 * Creates an AdonisJS project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createAdonisJsProject(settings) {
  // execSync(`npx create-adonis-ts-app ${settings.basic.projectDir} --api-only`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createAdonisJsProject");
  };
}

/**
 * Creates a FeathersJS project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createFeathersJsProject(settings) {
  return function() {
    console.log("ToDo: createFeathersJsProject");
  };
}

/**
 * Creates a React Native project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createReactNativeProject(settings) {
  // execSync(`npx react-native init ${path.basename(settings.basic.projectDir)} --directory ${settings.basic.projectDir} --template react-native-template-typescript`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createReactNativeProject");
  };
}

/**
 * Creates an Expo project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createExpoProject(settings) {
  // execSync(`npx create-expo-app ${settings.basic.projectDir} -t expo-template-blank-typescript`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createExpoProject");
  };
}

/**
 * Creates a NativeScript project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createNativeScriptProject(settings) {
  // execSync(`npx @nativescript/cli create ${settings.basic.projectDir} --ts`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createNativeScriptProject");
  };
}

/**
 * Creates an Ionic project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createIonicProject(settings) {
  // execSync(`npx @ionic/cli start ${settings.basic.projectDir} blank --type=react --capacitor`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createIonicProject");
  };
}

/**
 * Creates a Capacitor project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createCapacitorProject(settings) {
  return function() {
    console.log("ToDo: createCapacitorProject");
  };
}

/**
 * Creates an Electron project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createElectronProject(settings) {
  return function() {
    console.log("ToDo: createElectronProject");
  };
}

/**
 * Creates a Tauri project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createTauriProject(settings) {
  return function() {
    console.log("ToDo: createTauriProject");
  };
}

/**
 * Creates a Neutralino.js project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createNeutralinoProject(settings) {
  // execSync(`npx @neutralinojs/neu create ${settings.basic.projectDir}`, { stdio: 'inherit' });

  return function() {
    console.log("ToDo: createNeutralinoProject");
  };
}

/**
 * Creates a Proton Native project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createProtonNativeProject(settings) {
  return function() {
    console.log("ToDo: createProtonNativeProject");
  };
}

/**
 * Creates a Sciter project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createSciterProject(settings) {
  return function() {
    console.log("ToDo: createSciterProject");
  };
}

/**
 * Prepares package.json with required scripts for a project
 * @param {Object} settings - Project settings object
 */
function prepareProjectPackage(settings) {
  // Clean up unnecessary directories and files
  for (const name of ['.git', 'node_modules', 'package-lock.json']) {
    const itemPath = path.join(settings.basic.projectDir, name);
    const isFile = (name === 'package-lock.json');
    if (fs.existsSync(itemPath)) {
      if (isFile) {
        fs.unlinkSync(itemPath);
      } else {
        fs.rmSync(itemPath, { recursive: true, force: true });
      }
      console.log(`Removed ${name}`);
    }
  }

  // Load or create package.json
  let package = settings.func.addFile('package', 'package.json', {});

  // Create new package object
  const newPackage = {
    "name": settings.basic.packageName,
    "version": "1.0.0",
    "private": true,
    "scripts": {},
    "dependencies": {},
    "devDependencies": {}
  };

  // Transfer existing sections
  for (const section of ['scripts', 'dependencies', 'devDependencies']) {
    if (package[section]) {
      newPackage[section] = package[section];
    }
  }

  // Transfer other sections from package
  for (const [key, value] of Object.entries(package)) {
    if (!(key in newPackage)) {
      newPackage[key] = value;
    }
  }

  // Required scripts based on monorepo pattern
  const requiredScripts = {
    clean: 'echo "ToDo: clean"',
    lint: 'echo "ToDo: lint"',
    test: 'jest --passWithNoTests',
    build: 'echo "ToDo: build"',
    start: 'echo "ToDo: start"',
    dev: 'echo "ToDo: dev"'
  };

  // Add missing scripts
  for (const [scriptName, existingCommand] of Object.entries(newPackage.scripts || {})) {
    requiredScripts[scriptName] = existingCommand;
  }
  newPackage.scripts = requiredScripts;

  // Update package
  settings.package = newPackage;
}

/**
 * Prepares VSCode configuration files for the project
 * @param {Object} settings - Project settings object
 */
function prepareProjectVSCodeConfigs(settings) {
  // Define launch.json
  const launchJson = {
    "version": "0.2.0",
    "configurations": [
      {
        "type": "node",
        "request": "launch",
        "name": "Debug",
        "runtimeExecutable": "npm",
        "runtimeArgs": [
          "run",
          "dev"
        ],
        "cwd": "${workspaceFolder}",
        "console": "integratedTerminal",
        "internalConsoleOptions": "neverOpen"
      }
    ]
  };

  // Define tasks.json
  const tasksJson = {
    "version": "2.0.0",
    "tasks": [
      {
        "label": "Clean",
        "type": "shell",
        "command": "npm run clean",
        "group": "none"
      },
      {
        "label": "Lint",
        "type": "shell",
        "command": "npm run lint",
        "group": "test",
        "problemMatcher": "$eslint-stylish"
      },
      {
        "label": "Test",
        "type": "shell",
        "command": "npm run test",
        "group": "test"
      },
      {
        "label": "Build",
        "type": "shell",
        "command": "npm run build",
        "group": {
          "kind": "build",
          "isDefault": true
        },
        "problemMatcher": "$tsc"
      },
      {
        "label": "Start",
        "type": "shell",
        "command": "npm run start",
        "group": "none"
      }
    ]
  };

  // Define settings.json
  const settingsJson = {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit"
    },
    "eslint.validate": [
      "typescript"
    ],
    "typescript.tsdk": "node_modules/typescript/lib"
  };

  // Register all VSCode configuration files
  settings.func.addFile('vscode.launch', '.vscode/launch.json', launchJson);
  settings.func.addFile('vscode.tasks', '.vscode/tasks.json', tasksJson);
  settings.func.addFile('vscode.settings', '.vscode/settings.json', settingsJson);
}

/**
 * Prepares other configuration files for the project, including tsconfig.json and .gitignore
 * @param {Object} settings - Project settings object
 */
function prepareProjectOtherConfigs(settings) {
  // Load or create .gitignore
  const gitignore = settings.func.addFile('gitignore', '.gitignore', []);

  // Add VSCode-specific .gitignore entries
  if (gitignore.length > 0) {
    gitignore.push('');
  }
  gitignore.push(
    '# VSCode files',
    '.vscode/*',
    '!.vscode/settings.json',
    '!.vscode/tasks.json',
    '!.vscode/launch.json',
    '!.vscode/extensions.json'
  );

  // Ignore node_modules
  settings.func.ignoreDir('node_modules');

  // Default tsconfig configuration
  const defaultTSConfig = {
    "compilerOptions": {
      "target": "ES2020",
      "module": "CommonJS",
      "moduleResolution": "node",
      "esModuleInterop": true,
      "strict": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "sourceMap": true,
      "declaration": true,
      "declarationMap": true,
      "composite": true,
      "incremental": true,
      "outDir": "./dist",
      "tsBuildInfoFile": "./dist/tsconfig.tsbuildinfo",
      "rootDir": "./src"
    },
    "include": [
      "src/**/*"
    ]
  };

  // Load or create tsconfig.json
  settings.func.addFile('tsconfig', 'tsconfig.json', defaultTSConfig);
}

/**
 * Creates symlink to shared directory for the project
 * @param {Object} settings - Project settings object
 */
function createProjectSymlinks(settings) {
  const sharedDir = path.join(settings.basic.rootDir, 'shared');
  const sharedSymlink = path.join(settings.basic.projectDir, 'src', '@shared');
  const srcDir = path.join(settings.basic.projectDir, 'src');

  try {
    // Create source directory if it doesn't exist
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }

    // Create directory structure for symlink
    const linkDir = path.dirname(sharedSymlink);
    if (!fs.existsSync(linkDir)) {
      fs.mkdirSync(linkDir, { recursive: true });
    }

    // Remove existing symlink if it exists
    if (fs.existsSync(sharedSymlink)) {
      fs.unlinkSync(sharedSymlink);
    }

    // Determine relative path
    const relativeTarget = path.relative(path.dirname(sharedSymlink), sharedDir);

    // Create symlink
    fs.symlinkSync(relativeTarget, sharedSymlink, 'dir');
    console.log(`Created symlink: ${sharedSymlink} -> ${relativeTarget}`);
  } catch (error) {
    console.error('Error creating symlink:', error);
    console.error('You may need administrative privileges to create symlinks');
  }
}

/**
 * Updates the monorepo package.json to include the new project
 * @param {Object} settings - Project settings object
 */
async function updateMonorepoPackage(settings) {
  // Update root package.json
  const rootPackagePath = path.join(settings.basic.rootDir, 'package.json');
  if (fs.existsSync(rootPackagePath)) {
    try {
      const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));

      // Add scripts following the existing pattern in the monorepo
      if (!rootPackage.scripts) {
        rootPackage.scripts = {};
      }

      // Based on the provided package.json structure
      const projectName = settings.basic.projectName;
      const packageName = settings.basic.packageName;
      rootPackage.scripts[`clean:${projectName}`] = `npm run clean --workspace=${packageName}`;
      rootPackage.scripts[`lint:${projectName}`] = `npm run lint --workspace=${packageName}`;
      rootPackage.scripts[`test:${projectName}`] = `npm run test --workspace=${packageName}`;
      rootPackage.scripts[`build:${projectName}`] = `npm run build --workspace=${packageName}`;
      rootPackage.scripts[`start:${projectName}`] = `npm run start --workspace=${packageName}`;

      fs.writeFileSync(rootPackagePath, JSON.stringify(rootPackage, null, 2));
      console.log('Updated root package.json');
    } catch (error) {
      console.error('Error updating root package.json:', error);
    }
  }
}

export { createNewProject };