/**
 * Module for creating new projects in the monorepo.
 * Supports various project types and handles project setup, configuration, and symlinks.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import { __rootdir, __shareddir, colors, getProjectDir, getProjectFullPath, jsonStringify, setupSymlink, setupProjectSymlinks, createProjectSettings } from './project-utils.js';

/**
 * Helper class to provide additional functionalities to the settings object.
 */
class SettingsHelper {
  /**
   * Creates an instance of SettingsHelper.
   * @param {Object} settings - The project settings object.
   */
  constructor(settings) {
    this.settings = settings;
    // Bind methods to ensure 'this' context is correct when called from settings
    // Example: this.someMethod = this.someMethod.bind(this);
    this.getUnimplementedProjectTypeError = this.getUnimplementedProjectTypeError.bind(this);
    this.apply = this.apply.bind(this);
  }

  /**
   * Generates an error message for unimplemented project types.
   * @returns {string} - The formatted error message.
   */
  getUnimplementedProjectTypeError() {
    const projectType = this.settings.basic.projectType;
    const contributionLink = 'https://github.com/d-mozulyov/ts-monorepo?tab=readme-ov-file#contributing';
    return `Project type "${projectType}" is not yet fully implemented. You can contribute to the project here: ${contributionLink}`;
  }

  /**
   * Applies configuration settings from the provided object to the project settings.
   * @param {Object} config - Configuration object to apply. Expected structure:
   *   {
   *     sourceDir?: string,
   *     buildDir?: string,
   *     ignore?: {
   *       [sectionComment: string]: string | string[], // For gitignore entries
   *       directory?: string | string[],             // For directories to ignore
   *       directories?: string | string[]            // Alias for directory
   *     },
   *     symlinks?: { [symlinkPath: string]: string }, // Key: symlink path, Value: source path
   *     dependencies?: string | string[],
   *     devDependencies?: string | string[],
   *     eslint?: boolean,
   *     jest?: boolean | string | string[], // boolean enables default, string/array specifies libraries
   *     production?: string | string[],     // Paths to include in production build
   *     scripts?: { [scriptName: string]: string } // Key: script name, Value: script command
   *   }
   * @throws {Error} If config is not an object or if properties have incorrect types or values.
   */
  apply(config) {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Configuration must be an object');
    }

    for (const [key, value] of Object.entries(config)) {
      switch (key) {
        case 'sourceDir':
          if (typeof value !== 'string') {
            throw new Error(`Property 'sourceDir' must be a string`);
          }
          this.settings.func.setSourceDir(value);
          break;

        case 'buildDir':
          if (typeof value !== 'string') {
            throw new Error(`Property 'buildDir' must be a string`);
          }
          this.settings.func.setBuildDir(value);
          break;

        case 'ignore':
          if (typeof value !== 'object' || value === null) {
            throw new Error(`Property 'ignore' must be an object`);
          }
          for (const [ignoreKey, ignoreValue] of Object.entries(value)) {
            if (ignoreKey === 'directory' || ignoreKey === 'directories') {
              this.settings.func.ignoreDir(ignoreValue);
            } else {
              if (typeof ignoreValue === 'string') {
                this.settings.func.gitignore(ignoreKey, ignoreValue);
              } else if (Array.isArray(ignoreValue)) {
                ignoreValue.forEach(val => {
                  if (typeof val !== 'string') {
                    throw new Error(`Value in array for ignore property '${ignoreKey}' must be a string`);
                  }
                  this.settings.func.gitignore(ignoreKey, val);
                });
              } else {
                throw new Error(`Value for ignore property '${ignoreKey}' must be a string or array of strings`);
              }
            }
          }
          break;

        case 'dependencies':
          if (typeof value === 'string' || Array.isArray(value)) {
            this.settings.func.addDependencies(value);
          } else {
            throw new Error(`Property 'dependencies' must be a string or array of strings`);
          }
          break;

        case 'devDependencies':
          if (typeof value === 'string' || Array.isArray(value)) {
            this.settings.func.addDevDependencies(value);
          } else {
            throw new Error(`Property 'devDependencies' must be a string or array of strings`);
          }
          break;

        case 'eslint':
          if (typeof value !== 'boolean') {
            throw new Error(`Property 'eslint' must be a boolean`);
          }
          if (value) {
            this.settings.package.scripts.lint = `eslint ./${this.settings.sourceDir}`;
            this.settings.func.addEslintDependencies();
          }
          break;

        case 'jest':
          if (typeof value === 'boolean' || typeof value === 'string' || Array.isArray(value)) {
            if (typeof value === 'boolean' && !value) {
              // Do nothing if false
            } else {
              this.settings.package.scripts.test = 'jest --passWithNoTests';
              const jestArg = typeof value === 'boolean' ? [] : value;
              this.settings.func.addJestDependencies(jestArg);
            }
          } else {
            throw new Error(`Property 'jest' must be a boolean, string, or array of strings`);
          }
          break;

        case 'symlinks':
          if (typeof value !== 'object' || value === null) {
            throw new Error(`Property 'symlinks' must be an object`);
          }
          for (const [symlinkKey, symlinkValue] of Object.entries(value)) {
            this.settings.func.addSymlink(symlinkKey, symlinkValue);
          }
          break;

        case 'production':
          // Handle 'production' property: value must be a string or array of strings
          if (typeof value === 'string') {
            // Add single string path to production paths
            this.settings.setup.production.paths.push(value);
          } else if (Array.isArray(value)) {
            // Add each string path from the array
            value.forEach(path => {
              if (typeof path !== 'string') {
                throw new Error(`Each item in the 'production' array must be a string`);
              }
              this.settings.setup.production.paths.push(path);
            });
          } else {
            throw new Error(`Property 'production' must be a string or array of strings`);
          }
          break;

        case 'debug':
          // Handle 'debug' property: value must be a string or array of strings
          if (typeof value === 'string' || Array.isArray(value)) {
            this.settings.vscode.debug(value);
          } else {
            throw new Error(`Property 'debug' must be a string or array of strings`);
          }
          break;

        case 'scripts':
          // Handle 'scripts' property: value must be an object where each value is a string
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new Error(`Property 'scripts' must be an object`);
          }
          // Iterate through the scripts object and assign each script
          for (const [scriptName, scriptCommand] of Object.entries(value)) {
            if (typeof scriptCommand !== 'string') {
              throw new Error(`Value for script '${scriptName}' must be a string`);
            }
            this.settings.package.scripts[scriptName] = scriptCommand;
          }
          break;

        case 'compilerOptions':
          // Handle 'compilerOptions' property: value must be an object where each value is a string
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new Error(`Property 'compilerOptions' must be an object`);
          }
          // Iterate through the compilerOptions object and assign each option
          for (const [name, optionValue] of Object.entries(value)) {
            if (typeof optionValue !== 'string') {
              throw new Error(`Value for compilerOption '${name}' must be a string`);
            }
            this.settings.tsconfig.compilerOptions[name] = optionValue;
          }
          break;

        default:
          throw new Error(`Unknown configuration property: ${key}`);
      }
    }

    // Return this for chaining (duck-style)
    return this;
  }
}

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

  // Initialize the helper within the settings object
  settings.helper = new SettingsHelper(settings);

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

  // Validate sourceDir and buildDir to ensure they are defined
  if (!settings.sourceDir || !settings.buildDir) {
    settings.func.save(); // Save configuration files
    if (!settings.sourceDir && !settings.buildDir) { // Both undefined
      throw new Error('Source and build directories not defined');
    } else if (!settings.sourceDir) { // Source undefined
      throw new Error('Source directory not defined');
    } else if (!settings.buildDir) { // Build undefined
      throw new Error('Build directory not defined');
    }
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
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    // Apply React settings
    settings.helper.apply({
      sourceDir: 'src',
      buildDir: 'dist',
      eslint: true,
      jest: ['react', 'jsdom', 'vitest'],
      production: 'public',
      debug: 'with-chrome',
      scripts: {
        lint: "eslint .",
        test: "vitest run",
        start: settings.package.scripts.preview
      }
    });

    // Add vite.config.ts file
    settings.func.addFile('vite-config', 'vite.config.ts', [
      "import { defineConfig } from 'vite'",
      "import react from '@vitejs/plugin-react-swc'",
      "",
      "// https://vite.dev/config/",
      "export default defineConfig({",
      "  plugins: [react()]",
      "})"
    ]);

    // Add vitest.config.ts file
    settings.func.addFile('vitest-config', 'vitest.config.ts', [
      "import { defineConfig } from 'vitest/config'",
      "import react from '@vitejs/plugin-react-swc'",
      "",
      "// https://vitest.dev/config/",
      "export default defineConfig({",
      "  plugins: [react()],",
      "  test: {",
      "    globals: true,",
      "    environment: 'jsdom',",
      "    setupFiles: ['./__tests__/setupTests.ts'],",
      "    include: ['./__tests__/**/*.{test,spec}.{ts,tsx}'],",
      "  },",
      "})"
    ]);

    // Add setupTests.ts file
    settings.func.addFile('tests.setup', '__tests__/setupTests.ts', [
      "import '@testing-library/jest-dom';"
    ]);

    // Add App.test.tsx file
    settings.func.addFile('tests.app-test', '__tests__/App.test.tsx', [
      "import { describe, it, expect } from 'vitest';",
      "import { render, screen } from '@testing-library/react';",
      "import App from '../src/App';",
      "",
      "describe('App', () => {",
      "  it('renders the heading', () => {",
      "    render(<App />);",
      "    expect(screen.getByText('Vite + React')).toBeInTheDocument();",
      "  });",
      "});"
    ]);
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
    // Apply Next.js settings
    settings.helper.apply({
      sourceDir: 'src',
      buildDir: '.next',
      eslint: true,
      jest: 'react',
      production: 'public',
      debug: 'with-chrome',
      scripts: {
        lint: "next lint",
        build: "next build",
        dev: "next dev --turbopack",
        start: "next start"
      }
    });

    // Add jest.config.mjs
    settings.func.addFile('jest-config', 'jest.config.mjs', [
        '/**',
        ' * Jest configuration for Next.js project.',
        ' * This configuration sets up Jest to work with TypeScript and Next.js environment.',
        ' * For more details, refer to: https://jestjs.io/docs/configuration',
        ' */',
        "import nextJest from 'next/jest.js';",
        '',
        '// Providing the path to your Next.js app which will enable loading next.config.js and .env files',
        "const createJestConfig = nextJest({ dir: './' })",
        '',
        '// Any custom config you want to pass to Jest',
        'const customJestConfig = {',
        '    // Specifies the test environment to simulate a browser-like environment using jsdom',
        "    testEnvironment: 'jsdom',",
        '    // Defines module name mapper for aliasing imports (useful for Next.js paths)',
        '    moduleNameMapper: {',
        "        '^@/(.*)$': '<rootDir>/src/$1',",
        '    },',
        '    // Indicates which provider should be used to instrument code for coverage',
        "    coverageProvider: 'v8',",
        '    // Collects coverage from specific files',
        "    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],",
        '}',
        '',
        '// createJestConfig is exported in this way to ensure that next/jest can load the Next.js configuration, which is async',
        'export default createJestConfig(customJestConfig)'
    ]);

    // Add __tests__/App.test.tsx
    settings.func.addFile('tests.app-test', '__tests__/App.test.tsx', [
        "import { render, screen } from '@testing-library/react';",
        "import '@testing-library/jest-dom';  // Import to extend Jest matchers",
        "import Home from '../src/app/page';  // Adjust the path as necessary",
        "",
        "describe('Home Page', () => {",
        "  it('renders the home page with expected text', () => {",
        "    render(<Home />);",
        "    const headingElement = screen.getByText(/Get started by editing/i);",
        "    expect(headingElement).toBeInTheDocument();",
        "  });",
        "});"
    ]);
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
    // ToDo: Add Angular-specific post-creation steps here if needed
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    // Apply Vue.js settings
    settings.helper.apply({
      sourceDir: 'src',
      buildDir: 'dist',
      eslint: true,
      jest: ['eslint-plugin-vue', '@vue/test-utils', 'typescript-eslint', 'jsdom', 'vitest'],
      production: 'public',
      debug: 'with-chrome',
      scripts: {
        lint: "eslint .",
        test: "vitest run",
        start: settings.package.scripts.preview
      }
    });

    // Add eslint.config.js file
    settings.func.addFile('eslint-config', 'eslint.config.js', [
      "import js from '@eslint/js';",
      "import eslintPluginVue from 'eslint-plugin-vue';",
      "import tseslint from 'typescript-eslint';",
      "import vueParser from 'vue-eslint-parser';",
      "",
      "export default [",
      "  js.configs.recommended,",
      "  ...tseslint.configs.recommended,",
      "  {",
      "    files: ['**/*.ts'],",
      "    plugins: {",
      "      '@typescript-eslint': tseslint.plugin",
      "    },",
      "    languageOptions: {",
      "      parser: tseslint.parser",
      "    }",
      "  },",
      "  {",
      "    files: ['**/*.vue'],",
      "    plugins: {",
      "      vue: eslintPluginVue",
      "    },",
      "    languageOptions: {",
      "      parser: vueParser,",
      "      parserOptions: {",
      "        parser: tseslint.parser,",
      "        extraFileExtensions: ['.vue']",
      "      }",
      "    }",
      "  },",
      "  {",
      "    ignores: ['node_modules/**', 'dist/**']",
      "  }",
      "];"
    ]);

    // Add vite.config.ts file
    settings.func.addFile('vite-config', 'vite.config.ts', [
      "import { defineConfig } from 'vite'",
      "import vue from '@vitejs/plugin-vue'",
      "",
      "// https://vite.dev/config/",
      "export default defineConfig({",
      "  plugins: [vue()],",
      "})"
    ]);

    // Add vitest.config.ts file
    settings.func.addFile('vitest-config', 'vitest.config.ts', [
      "import { defineConfig } from 'vitest/config';",
      "import vue from '@vitejs/plugin-vue';",
      "import { fileURLToPath } from 'url';",
      "",
      "export default defineConfig({",
      "  plugins: [vue()],",
      "  test: {",
      "    // Test environment configuration",
      "    environment: 'jsdom',",
      "    // Enable Vue components support",
      "    globals: true,",
      "    // Test file extensions configuration",
      "    include: ['**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}'],",
      "  },",
      "  resolve: {",
      "    alias: {",
      "      '@': fileURLToPath(new URL('./src', import.meta.url)),",
      "    },",
      "  },",
      "});"
    ]);

    // Add App.spec.ts file
    settings.func.addFile('tests.app-spec', '__tests__/App.spec.ts', [
      "import { describe, it, expect } from 'vitest';",
      "import { mount } from '@vue/test-utils';",
      "import HelloWorld from '../src/components/HelloWorld.vue';",
      "",
      "describe('HelloWorld Component', () => {",
      "  it('renders message correctly', () => {",
      "    const message = 'Hello Vitest';",
      "    const wrapper = mount(HelloWorld, {",
      "      props: {",
      "        msg: message,",
      "      },",
      "    });",
      "    expect(wrapper.find('h1').text()).toBe(message);",
      "  });",
      "});"
    ]);
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
    // Apply Svelte settings
    settings.helper.apply({
      sourceDir: 'src',
      buildDir: 'dist',
      eslint: true,
      jest: ['svelte-eslint-parser', 'jsdom', 'vitest'],
      production: 'public',
      debug: 'with-chrome',
      scripts: {
        lint: "eslint .",
        test: "vitest run",
        start: settings.package.scripts.preview
      }
    });

    // Add eslint.config.js file
    settings.func.addFile('eslint-config', 'eslint.config.js', [
      "import js from '@eslint/js';",
      "import globals from 'globals';",
      "import typescriptParser from '@typescript-eslint/parser';",
      "import svelteParser from 'svelte-eslint-parser';",
      "",
      "export default [",
      "    {",
      "        ignores: ['dist/**/*', 'node_modules/**/*', 'coverage/**/*']",
      "    },",
      "    js.configs.recommended,",
      "    {",
      "        files: ['src/**/*.{js,ts}', '__tests__/**/*.{js,ts}'],",
      "        ignores: ['dist/**/*', 'node_modules/**/*', 'coverage/**/*'],",
      "        languageOptions: {",
      "            ecmaVersion: 2023,",
      "            sourceType: 'module',",
      "            parser: typescriptParser,",
      "            globals: {",
      "                ...globals.browser,",
      "                ...globals.es2021,",
      "                ...globals.node,",
      "                ...globals.vitest",
      "            }",
      "        },",
      "        rules: {",
      "            'no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],",
      "            'no-console': 'warn'",
      "        }",
      "    },",
      "    {",
      "        files: ['**/*.svelte'],",
      "        languageOptions: {",
      "            parser: svelteParser,",
      "            parserOptions: {",
      "                parser: typescriptParser",
      "            }",
      "        }",
      "    }",
      "];"
    ]);

    // Add vite.config.ts file
    settings.func.addFile('vite-config', 'vite.config.ts', [
      "import { defineConfig } from 'vite'",
      "import { svelte } from '@sveltejs/vite-plugin-svelte'",
      "",
      "// https://vite.dev/config/",
      "export default defineConfig({",
      "  plugins: [svelte()],",
      "})"
    ]);

    // Add vitest.config.ts file
    settings.func.addFile('vitest-config', 'vitest.config.ts', [
      "import { defineConfig } from 'vite'",
      "import { svelte } from '@sveltejs/vite-plugin-svelte'",
      "",
      "export default defineConfig({",
      "  // Нужен только для vitest",
      "  define: {",
      "    'import.meta.vitest': false,",
      "  },  plugins: [",
      "    svelte({",
      "      compilerOptions: {",
      "        compatibility: {",
      "          componentApi: 4",
      "        }",
      "      }",
      "    })",
      "  ],test: {",
      "    globals: true,",
      "    environment: 'jsdom',",
      "    include: ['__tests__/**/*.{test,spec}.{js,ts}'],",
      "    coverage: {",
      "      provider: 'v8',",
      "      reporter: ['text', 'json', 'html']",
      "    },",
      "    deps: {",
      "      optimizer: {",
      "        web: {",
      "          include: ['svelte']",
      "        }",
      "      }",
      "    }",
      "  }",
      "})"
    ]);

    // Add App.test.ts file
    settings.func.addFile('tests.app-spec', '__tests__/App.test.ts', [
      "import { describe, it, expect } from 'vitest';",
      "import App from '../src/App.svelte';",
      "",
      "describe('App.svelte', () => {",
      "    it('has correct page title', () => {",
      "        const target = document.createElement('div');",
      "        document.body.appendChild(target);",
      "",
      "        new App({ target });",
      "",
      "        const heading = document.querySelector('h1');",
      "        expect(heading?.textContent).toBe('Vite + Svelte');",
      "",
      "        document.body.removeChild(target);",
      "    });",
      "});"
    ]);
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
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    // ToDo: Add NestJS-specific post-creation steps here if needed
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    // ToDo: Add React Native-specific post-creation steps here if needed
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    // ToDo: Add Expo-specific post-creation steps here if needed
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    // ToDo: Add Ionic-specific post-creation steps here if needed
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    // ToDo: Add Electron-specific post-creation steps here if needed
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    // ToDo: Add Tauri-specific post-creation steps here if needed
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    // ToDo: Add Neutralino.js-specific post-creation steps here if needed
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    // ToDo: Add Proton Native-specific post-creation steps here if needed
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    throw new Error(settings.helper.getUnimplementedProjectTypeError());
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
    "type": "module",
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
  // Define launch configuration with Debug configuration
  const launch = {
    Debug: {
      "type": "node",
      "request": "launch",
      "name": "Debug",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    }
  };
  settings.vscode.add('launch', launch);

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
  tasks.dev.group = 'none';
  settings.vscode.add('tasks', tasks);

  // Define VSCode settings
  const vscodeSettings = {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit"
    },
    "eslint.validate": [
      "typescript"
    ],
    "typescript.tsdk": "node_modules/typescript/lib"
  };
  settings.vscode.add('settings', vscodeSettings);
}

/**
 * Prepares other configuration files for the project, including tsconfig.json and .gitignore
 * @param {Object} settings - Project settings object
 */
function prepareProjectOtherConfigs(settings) {
  // Load and correct .gitignore file or create new
  const gitignore = settings.func.addFile('gitignore', '.gitignore', []);
  for (let i = 0; i < gitignore.length; i++) {
    gitignore[i] = gitignore[i].trim();
    if (gitignore[i].startsWith('/')) {
      gitignore[i] = gitignore[i].slice(1);
    } else if (gitignore[i].startsWith('!/')) {
      gitignore[i] = '!' + gitignore[i].slice(2);
    }
  }

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
   const tsconfig = settings.func.addFile('tsconfig', 'tsconfig.json', defaultTSConfig);
   if (!tsconfig.compilerOptions) {
     tsconfig.compilerOptions = {};
   }
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

    // Add all default scripts from settings.basic.defaultScripts
    const projectName = settings.basic.projectName;
    const packageName = settings.basic.packageName;
    for (const scriptName of Object.keys(settings.basic.defaultScripts)) {
      rootPackage.scripts[`${scriptName}:${projectName}`] = `npm run ${scriptName} --workspace=${packageName}`;
    }

    fs.writeFileSync(rootPackagePath, jsonStringify(rootPackage), 'utf8');
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
