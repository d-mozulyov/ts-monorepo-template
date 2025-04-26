/**
 * Module for creating new projects in the monorepo.
 * Supports various project types and handles project setup, configuration, and symlinks.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import { colors, __rootdir, __shareddir, getProjectDir, getProjectFullPath, setupSymlink, setupProjectSymlinks, createProjectSettings } from './project-utils.js';

/**
 * Creates a new project in the monorepo
 * @param {string} projectType - Type of project to create
 * @param {string} [projectName] - Optional project name (will prompt if not provided or invalid)
 * @returns {string} - Relative path to the created project directory or empty string if creation failed
 * @throws {Error} If project creation fails
 */
async function createNewProject(projectType, projectName = '') {
  // Validate project type
  const validProjectTypes = [
    'Empty Node.js', 'React', 'Next.js', 'Angular', 'Vue.js', 'Svelte',
    'Express.js', 'NestJS', 'Fastify', 'AdonisJS', 'FeathersJS',
    'React Native', 'Expo', 'NativeScript', 'Ionic', 'Capacitor.js',
    'Electron', 'Tauri', 'Neutralino.js', 'Proton Native', 'Sciter'
  ];

  if (!validProjectTypes.includes(projectType)) {
    throw new Error(`Invalid project type: ${projectType}. Valid types: ${validProjectTypes.join(', ')}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  if (!projectName) {
    console.log('');
  }

  // Function to ask a question and get user input
  const question = (query) => new Promise((resolve) => rl.question(query, resolve));
  try {
    // Read project name
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

      // Check if project directory already exists
      projectDir = getProjectDir(projectName);
      if (fs.existsSync(projectDir)) {
        console.error(`Directory already exists: ${projectDir}`);
        projectName = ''; // Reset project name to force prompt on next iteration
        continue;
      }

      // Done
      break;
    }

    // Create project based on type
    await createProjectByType(projectName, projectType);

    // Return the relative project directory path
    return getProjectDir(projectName, true);
  } finally {
    rl.close();
  }
}

/**
 * Creates project based on its type
 * @param {string} projectName - Project name in slug format
 * @param {string} projectType - Type of project to create
 * @throws {Error} If project type is unsupported or creation fails
 */
async function createProjectByType(projectName, projectType) {
  // Create project settings object
  const settings = createProjectSettings(projectName, projectType);

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

  // Execute the callback returned from create function
  if (typeof callback === 'function') {
    callback();
  }

  // Check for scripts that still use default values
  const defaultScripts = settings.basic.defaultScripts;
  const currentScripts = settings.package.scripts || {};
  const unchangedScripts = Object.keys(currentScripts).filter(
    (scriptName) => currentScripts[scriptName] === defaultScripts[scriptName]
  );
  if (unchangedScripts.length > 0) {
    console.log(colors.yellow(
      `Warning: The following scripts are not overridden and use default values: ${unchangedScripts.join(', ')}`
    ));
  }

  // Validate sourceDir and buildDir
  if (!settings.sourceDir && !settings.buildDir) {
    throw new Error('Source and build directories are not defined');
  } else if (!settings.sourceDir) {
    throw new Error('Source directory is not defined');
  } else if (!settings.buildDir) {
    throw new Error('Build directory is not defined');
  }

  // Update monorepo configurations
  updateMonorepoConfigs(settings);

  // Save all configuration files to disk
  settings.func.save();

  // Setup project symlinks
  setupProjectSymlinks(projectName);

  // Install project dependencies
  settings.func.install();
}

/**
 * Creates an Empty Node.js project
 * @param {Object} settings - Project settings object
 * @returns {Function} - Callback function
 */
function createEmptyNodeProject(settings) {
  // ToDo: Implement Empty Node.js project creation

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
  // Initialize React project with Vite and TypeScript
  execSync(`npx --yes create-vite ${settings.basic.projectName} --template react-swc-ts --skip-git --skip-install`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // Initialize Next.js project with TypeScript and specific configurations
  execSync(`npx --yes create-next-app ${settings.basic.projectName} --ts --eslint --tailwind --src-dir --app --turbopack --no-import-alias --disable-git --skip-install`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // Initialize Angular project with CLI and TypeScript
  execSync(`npx --yes @angular/cli new ${settings.basic.packageName} --directory ${settings.basic.projectName} --no-interactive --skip-git --skip-install`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit',
    env: { ...process.env, NG_CLI_ANALYTICS: 'false' }
  });

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
  // Initialize Vue.js project with Vite and TypeScript
  execSync(`npx --yes create-vite ${settings.basic.projectName} --template vue-ts --skip-git --skip-install`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // Initialize Svelte project with Vite and TypeScript
  execSync(`npx --yes create-vite ${settings.basic.projectName} --template svelte-ts --skip-git --skip-install`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // ToDo: Implement Express.js project creation

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
  // Initialize NestJS project with CLI and npm
  execSync(`npx --yes @nestjs/cli new ${settings.basic.projectName} --package-manager npm --skip-git --skip-install`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // ToDo: Implement Fastify project creation

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
  // ToDo: Implement FeathersJS project creation

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
  // Initialize React Native project with CLI and TypeScript
  execSync(`npx --yes @react-native-community/cli init ${settings.basic.projectName} --skip-git-init --skip-install`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // Initialize Expo project with blank TypeScript template
  execSync(`npx --yes create-expo-app ${settings.basic.projectName} --template blank-typescript --no-install`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // ToDo: Implement NativeScript project creation

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
  // Initialize Ionic project with React and Capacitor
  execSync(`npx --yes @ionic/cli start ${settings.basic.projectName} blank --type=react --capacitor --no-deps --no-git`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // ToDo: Implement Capacitor project creation

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
  // Initialize Electron project
  execSync(`npx --yes create-electron-app ${settings.basic.projectName} --skip-git`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // Initialize Tauri project with React and TypeScript
  execSync(`npx --yes create-tauri-app ${settings.basic.projectName} --template react-ts --manager npm`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // Initialize Neutralino.js project
  execSync(`npx --yes @neutralinojs/neu create ${settings.basic.projectName}`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // Initialize Proton Native project
  execSync(`npx --yes proton-native-cli init ${settings.basic.projectName}`, {
    cwd: settings.basic.projectParentDir,
    stdio: 'inherit'
  });

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
  // ToDo: Implement Sciter project creation

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
  let packageObj = settings.func.addFile('package', 'package.json', {});

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
    if (packageObj[section]) {
      newPackage[section] = packageObj[section];
    }
  }

  // Transfer other sections from package
  for (const [key, value] of Object.entries(packageObj)) {
    if (!(key in newPackage)) {
      newPackage[key] = value;
    }
  }

  // Initialize required scripts from settings.basic.defaultScripts
  const requiredScripts = { ...settings.basic.defaultScripts };

  // Add missing scripts
  for (const [scriptName, existingCommand] of Object.entries(newPackage.scripts || {})) {
    requiredScripts[scriptName] = existingCommand;
  }
  newPackage.scripts = requiredScripts;

  // Update package
  settings.package = newPackage;

  // Add TypeScript as a devDependency
  settings.func.addDevDependencies('typescript');
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

  // Initialize tasks object based on settings.basic.defaultScripts
  const tasks = {};
  for (const name of Object.keys(settings.basic.defaultScripts)) {
    tasks[name] = {
      label: name.charAt(0).toUpperCase() + name.slice(1),
      type: 'shell',
      command: `npm run ${name}`
    };
  }
  tasks.clean.group = 'none';
  tasks.lint.group = 'test';
  tasks.lint.problemMatcher = '$eslint-stylish';
  tasks.test.group = 'test';
  tasks.build.group = {
    kind: 'build',
    isDefault: true
  };
  tasks.build.problemMatcher = '$tsc';
  tasks.start.group = 'none';

  // Define tasksJson using the values of the tasks object
  const tasksJson = {
    "version": "2.0.0",
    "tasks": Object.values(tasks)
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

  // Ignore node_modules
  settings.func.ignoreDir('node_modules');

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

  // Define default setup configuration
  const defaultSetupConfig = {
    type: settings.basic.projectType,
    builddir: "",
    production: {
      node_modules: false,
      paths: []
    },
    symlinks: {}
  };

  // Load or create setup.json
  settings.func.addFile('setup', 'setup.json', defaultSetupConfig);

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
 * Updates monorepo configurations to include the new project
 * @param {Object} settings - Project settings object
 */
function updateMonorepoConfigs(settings) {
  // Update root package.json
  const rootPackagePath = path.join(__rootdir, 'package.json');
  if (fs.existsSync(rootPackagePath)) {
    const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));

    // Add project directory to workspaces if not already present
    if (!rootPackage.workspaces) {
      rootPackage.workspaces = [];
    }
    const relativeProjectDir = settings.basic.projectDir
      .slice(__rootdir.length + 1)
      .replace(/\\/g, '/');
    if (!rootPackage.workspaces.includes(relativeProjectDir)) {
      rootPackage.workspaces.push(relativeProjectDir);
    }

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
  }
}

/**
 * Creates a single symlink for a project and updates its configuration
 * @param {string} projectName - Project name in slug format
 * @param {string} symlinkPath - Relative path for the symlink
 * @param {string} sourcePath - Relative path to the source file or directory
 * @throws {Error} If setup.json does not exist or if the symlink source path is invalid
 */
function createNewSymlink(projectName, symlinkPath, sourcePath) {
  const projectDir = getProjectDir(projectName);

  // Check if setup.json exists
  const setupPath = path.join(projectDir, 'setup.json');
  if (!fs.existsSync(setupPath)) {
    throw new Error(`Setup file does not exist: ${setupPath}`);
  }

  // Create settings object for the project
  const settings = createProjectSettings(projectName, 'dummy');

  // Setup the symlink
  const fullSymlinkPath = getProjectFullPath(projectName, symlinkPath);
  const fullSourcePath = getProjectFullPath(projectName, sourcePath, true);
  setupSymlink(fullSymlinkPath, fullSourcePath);

  // Update project settings
  settings.func.addFile('gitignore', '.gitignore', []);
  settings.func.addFile('setup', 'setup.json', {});
  settings.func.addSymlink(symlinkPath, sourcePath);
  settings.func.save();
}

export { createNewProject, createNewSymlink };