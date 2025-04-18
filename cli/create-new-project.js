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
      packageName
    },
    func: {
      save: function() {
        console.log(`Saving project with settings:
          rootDir: ${this.basic.rootDir}
          projectDir: ${this.basic.projectDir}
          projectName: ${this.basic.projectName}
          projectType: ${this.basic.projectType}
          packageName: ${this.basic.packageName}
        `);
      },
      // Example of another function for demonstration
      log: function() {
        console.log(`Logging project: ${this.basic.projectName}`);
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

  // Create symlink to shared directory
  const sharedDir = path.join(rootDir, 'shared');
  const sharedSymlink = path.join(projectDir, 'src', '@shared');
  const srcDir = path.join(projectDir, 'src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }
  createSymlink(sharedDir, sharedSymlink);

  // Verify package.json exists and contains required scripts
  updateProjectPackage(projectDir);

  // Update tsconfig.json for proper monorepo integration
  updateProjectTSConfig(projectDir);

  // VSCode configurations
  createProjectVSCodeConfigs(projectDir);

  // Execute the callback returned from create function
  if (typeof callback === 'function') {
    callback();
  }

  // Execute the save function
  settings.func.save();

  // Update monorepo package configuration
  await updateMonorepoPackage(rootDir, projectName);
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
 * Creates symlink
 * @param {string} target - Target directory
 * @param {string} linkPath - Link path
 */
function createSymlink(target, linkPath) {
  try {
    // Create directory structure if it doesn't exist
    const linkDir = path.dirname(linkPath);
    if (!fs.existsSync(linkDir)) {
      fs.mkdirSync(linkDir, { recursive: true });
    }

    // Remove existing symlink if it exists
    if (fs.existsSync(linkPath)) {
      fs.unlinkSync(linkPath);
    }

    // Determine relative path
    const relativeTarget = path.relative(path.dirname(linkPath), target);

    // Create symlink
    fs.symlinkSync(relativeTarget, linkPath, 'dir');
    console.log(`Created symlink: ${linkPath} -> ${relativeTarget}`);
  } catch (error) {
    console.error('Error creating symlink:', error);
    console.error('You may need administrative privileges to create symlinks');
  }
}

/**
 * Updates package.json with required scripts for a project
 * @param {string} projectDir - Project directory
 */
function updateProjectPackage(projectDir) {
  try {
    // Check if package.json exists in the project
    const packageJsonPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Ensure scripts object exists
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      // Required scripts based on monorepo pattern
      const requiredScripts = {
        clean: 'rimraf ./dist',
        lint: 'eslint ./src',
        test: 'jest --passWithNoTests --config=../../jest.config.js',
        build: 'tsc',
        start: 'node ./dist/index.js',
        dev: 'tsc && node ./dist/index.js'
      };

      // Add missing scripts
      for (const [scriptName, existingCommand] of Object.entries(packageJson.scripts || {})) {
        requiredScripts[scriptName] = existingCommand;
      }
      packageJson.scripts = requiredScripts;

      // Update package.json
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    } else {
      console.warn('package.json not found in the project');
    }
  } catch (error) {
    console.error('Error updating package.json:', error);
    throw error;
  }
}

/**
 * Updates or creates the tsconfig.json of the project with proper monorepo settings
 * @param {string} projectDir - Project directory
 */
function updateProjectTSConfig(projectDir) {
  const projectTsConfigPath = path.join(projectDir, 'tsconfig.json');

  // Base configuration that all projects should have
  const baseTsConfig = {
    "extends": "../../tsconfig.json",
    "compilerOptions": {
      "outDir": "./dist",
      "tsBuildInfoFile": "./dist/tsconfig.tsbuildinfo",
      "rootDir": "./src"
    },
    "include": [
      "src/**/*"
    ]
  };

  try {
    if (!fs.existsSync(projectTsConfigPath)) {
      // Create new tsconfig.json if it doesn't exist
      fs.writeFileSync(projectTsConfigPath, JSON.stringify(baseTsConfig, null, 2));
      console.log('Created tsconfig.json');
    } else {
      // Update existing tsconfig.json
      const existingConfig = JSON.parse(fs.readFileSync(projectTsConfigPath, 'utf8'));
      let modified = false;

      // Ensure extends is set correctly
      if (existingConfig.extends !== baseTsConfig.extends) {
        existingConfig.extends = baseTsConfig.extends;
        modified = true;
      }

      // Ensure compilerOptions exists and has required properties
      if (!existingConfig.compilerOptions) {
        existingConfig.compilerOptions = {};
        modified = true;
      }

      for (const [key, value] of Object.entries(baseTsConfig.compilerOptions)) {
        if (!existingConfig.compilerOptions[key] ||
            (key === 'outDir' && !existingConfig.compilerOptions[key].includes('dist'))) {
          existingConfig.compilerOptions[key] = value;
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(projectTsConfigPath, JSON.stringify(existingConfig, null, 2));
        console.log('Updated tsconfig.json with correct structure');
      }
    }
  } catch (error) {
    console.error('Error updating tsconfig.json:', error);
  }
}

/**
 * Creates VSCode configuration files for the project
 * @param {string} projectDir - Project directory
 */
function createProjectVSCodeConfigs(projectDir) {
  // Ensure .vscode directory exists
  const vscodeDir = path.join(projectDir, '.vscode');
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  // Create launch.json
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

  const launchJsonPath = path.join(projectDir, '.vscode', 'launch.json');
  fs.writeFileSync(launchJsonPath, JSON.stringify(launchJson, null, 2));
  console.log('Created launch.json');

  // Create tasks.json
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

  const tasksJsonPath = path.join(projectDir, '.vscode', 'tasks.json');
  fs.writeFileSync(tasksJsonPath, JSON.stringify(tasksJson, null, 2));
  console.log('Created tasks.json');

  // Create settings.json
  const settingsJson = {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit"
    },
    "eslint.validate": [
      "typescript"
    ],
    "typescript.tsdk": "node_modules/typescript/lib",
    "files.exclude": {
      "dist": true
    },
    "search.exclude": {
      "dist": true
    }
  };

  const settingsJsonPath = path.join(projectDir, '.vscode', 'settings.json');
  fs.writeFileSync(settingsJsonPath, JSON.stringify(settingsJson, null, 2));
  console.log('Created settings.json');
}

/**
 * Updates the monorepo package.json to include the new project
 * @param {string} rootDir - Root directory of the monorepo
 * @param {string} projectName - Project name in slug format
 */
async function updateMonorepoPackage(rootDir, projectName) {
  // Update root package.json
  const rootPackageJsonPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(rootPackageJsonPath)) {
    try {
      const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));

      // Add scripts following the existing pattern in the monorepo
      if (!rootPackageJson.scripts) {
        rootPackageJson.scripts = {};
      }

      // Based on the provided package.json structure
      rootPackageJson.scripts[`clean:${projectName}`] = `npm run clean --workspace=@monorepo/${projectName}`;
      rootPackageJson.scripts[`lint:${projectName}`] = `npm run lint --workspace=@monorepo/${projectName}`;
      rootPackageJson.scripts[`test:${projectName}`] = `npm run test --workspace=@monorepo/${projectName}`;
      rootPackageJson.scripts[`build:${projectName}`] = `npm run build --workspace=@monorepo/${projectName}`;
      rootPackageJson.scripts[`start:${projectName}`] = `npm run start --workspace=@monorepo/${projectName}`;

      fs.writeFileSync(rootPackageJsonPath, JSON.stringify(rootPackageJson, null, 2));
      console.log('Updated root package.json');
    } catch (error) {
      console.error('Error updating root package.json:', error);
    }
  }
}

export { createNewProject };
