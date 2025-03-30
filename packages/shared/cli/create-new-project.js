const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

/**
 * Default dependency versions used for project initialization
 */
const defaultDependencies = {
  // Common dependencies
  'typescript': '^5.8.2',
  'rimraf': '^6.0.1',
  'eslint': '^9.23.0',
  'jest': '^29.7.0',
  '@types/jest': '^29.5.14',
  'ts-jest': '^29.3.0',
  'ts-node': '^10.4.0',
  'ts-node-dev': '^2.0.0',
  '@types/node': '^22.13.13',
  '@typescript-eslint/eslint-plugin': '^8.28.0',
  '@typescript-eslint/parser': '^8.28.0',
  
  // React/Vue/Svelte
  'react': '^18.2.0',
  'react-dom': '^18.2.0',
  'vite': '^4.3.0',
  '@vitejs/plugin-react': '^4.0.0',
  'vitest': '^0.32.0',
  '@testing-library/react': '^14.0.0',
  '@testing-library/react-native': '^9.0.0',
  '@testing-library/jest-dom': '^5.16.0',
  '@testing-library/svelte': '^3.0.0',
  '@testing-library/vue': '^2.0.0',
  
  // Express/Fastify/NestJS
  'express': '^4.18.0',
  '@types/express': '^4.17.0',
  'fastify': '^4.0.0',
  '@nestjs/cli': '^9.0.0',
  'supertest': '^6.0.0',
  '@types/supertest': '^2.0.0',
  
  // Mobile
  'react-native': '^0.72.0',
  'expo': '^49.0.0',
  '@nativescript/cli': '^8.0.0',
  '@ionic/cli': '^6.0.0',
  '@capacitor/core': '^5.0.0',
  
  // Desktop
  'electron': '^24.0.0',
  'electron-builder': '^23.0.0',
  '@tauri-apps/cli': '^1.0.0',
  '@tauri-apps/api': '^1.0.0',
  '@neutralinojs/neu': '^9.0.0',
  'proton-native': '^2.0.0',
  'sciter-js': '^4.0.0'
};


/**
 * Creates a new project in the monorepo
 * @param {string} rootDir - Root directory of the monorepo
 * @param {string} projectType - Type of project to create
 */
async function createNewProject(rootDir, projectType) {
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
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Function to ask a question and get user input
  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    // Get project name
    let projectName = '';
    let isValidProjectName = false;

    while (!isValidProjectName) {
      projectName = await question('Enter project name (e.g. "My App"): ');
      projectName = projectName.trim();

      // Validate project name
      if (!projectName) {
        console.error('Project name cannot be empty');
        continue;
      }

      // Check if the project name already exists in launch.json or tasks.json
      isValidProjectName = await validateProjectName(rootDir, projectName);
      if (!isValidProjectName) {
        console.error('Please choose a different project name');
      }
    }

    // Calculate and validate slug
    let defaultSlug = calculateSlug(projectName);
    let slug = await question(`Enter project slug (default: "${defaultSlug}"): `);
    slug = slug.trim() || defaultSlug;

    let isValidSlug = false;
    while (!isValidSlug) {
      // Validate slug
      if (!slug) {
        console.error('Slug cannot be empty');
        slug = await question(`Enter project slug (default: "${defaultSlug}"): `);
        slug = slug.trim() || defaultSlug;
        continue;
      }

      if (!/^[a-z0-9-_]+$/i.test(slug)) {
        console.error('Slug can only contain letters, numbers, hyphens, and underscores');
        slug = await question(`Enter project slug: `);
        slug = slug.trim();
        continue;
      }

      // Check if directory already exists
      const projectDir = path.join(rootDir, 'packages', slug);
      if (fs.existsSync(projectDir)) {
        console.error(`Directory already exists: ${projectDir}`);
        slug = await question(`Enter project slug: `);
        slug = slug.trim();
        continue;
      }

      isValidSlug = true;
    }

    const projectDir = path.join(rootDir, 'packages', slug);

    // Create project
    console.log(`Creating ${projectType} project "${projectName}" in ${projectDir}...`);
    
    // Create project directory
    fs.mkdirSync(projectDir, { recursive: true });

    // Create project based on type
    await createProjectByType(rootDir, projectDir, slug, projectType);

    // Create symlink to shared directory
    const sharedDir = path.join(rootDir, 'packages', 'shared');
    const sharedSymlink = path.join(projectDir, 'src', '@shared');

    // Ensure src directory exists
    const srcDir = path.join(projectDir, 'src');
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }

    // Create symlink
    createSymlink(sharedDir, sharedSymlink);

    // Update monorepo configuration
    await updateMonorepoConfig(rootDir, projectDir, projectName, slug);

    // Verify package.json exists and contains required scripts
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
          lint: 'eslint src --ext .ts,.tsx',
          test: 'jest',
          build: 'tsc',
          start: 'node ./dist/index.js',
          dev: 'tsc && node ./dist/index.js'
        };
        
        // Add missing scripts
        let scriptsModified = false;
        for (const [scriptName, defaultCommand] of Object.entries(requiredScripts)) {
          if (!packageJson.scripts[scriptName]) {
            packageJson.scripts[scriptName] = defaultCommand;
            scriptsModified = true;
          }
        }
        
        // If scripts were added, update package.json
        if (scriptsModified) {
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
          console.log('Updated package.json with required scripts');
        }
      } else {
        console.warn('package.json not found in the project');
      }
    } catch (error) {
      console.error('Error updating package.json:', error);
      throw error;
    }
    
    // Update tsconfig.json for proper monorepo integration
    updateTsConfig(rootDir, projectDir);

    // Run npm install to install dependencies
    if (!installNpmDependencies(projectDir)) {
      process.exit(1);
    }

    console.log(`Project "${projectName}" successfully created!`);
  } catch (error) {
    console.error('Error creating project:', error);
  } finally {
    rl.close();
  }
}

/**
 * Validates if the project name already exists in launch.json or tasks.json
 * @param {string} rootDir - Root directory of the monorepo
 * @param {string} projectName - Name of the project to validate
 * @returns {boolean} - True if valid, false if already exists
 */
async function validateProjectName(rootDir, projectName) {
  // Check launch.json
  const launchJsonPath = path.join(rootDir, '.vscode', 'launch.json');
  if (fs.existsSync(launchJsonPath)) {
    try {
      const launchJson = JSON.parse(fs.readFileSync(launchJsonPath, 'utf8'));
      const debugConfig = launchJson.configurations.find(config => 
        config.name.toLowerCase() === `Debug ${projectName}`.toLowerCase()
      );
      
      if (debugConfig) {
        console.error(`Configuration "Debug ${projectName}" already exists in launch.json`);
        return false;
      }
    } catch (error) {
      console.warn(`Warning: Could not parse launch.json: ${error.message}`);
    }
  }

  // Check tasks.json
  const tasksJsonPath = path.join(rootDir, '.vscode', 'tasks.json');
  if (fs.existsSync(tasksJsonPath)) {
    try {
      const tasksJson = JSON.parse(fs.readFileSync(tasksJsonPath, 'utf8'));
      const taskNames = [
        `Clean ${projectName}`,
        `Lint ${projectName}`,
        `Test ${projectName}`,
        `Build ${projectName}`,
        `Start ${projectName}`
      ];

      for (const taskName of taskNames) {
        const existingTask = tasksJson.tasks.find(task => 
          task.label.toLowerCase() === taskName.toLowerCase()
        );
        
        if (existingTask) {
          console.error(`Task "${taskName}" already exists in tasks.json`);
          return false;
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not parse tasks.json: ${error.message}`);
    }
  }

  return true;
}

/**
 * Calculates slug from project name
 * @param {string} projectName - Name of the project
 * @returns {string} - Calculated slug
 */
function calculateSlug(projectName) {
  return projectName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with a single one
    .trim();
}

/**
 * Creates project based on its type
 * @param {string} rootDir - Root directory of the monorepo
 * @param {string} projectDir - Project directory
 * @param {string} slug - Project slug
 * @param {string} projectType - Type of project to create
 */
async function createProjectByType(rootDir, projectDir, slug, projectType) {
  const packageName = `@monorepo/${slug}`;

  switch (projectType) {
    case 'Empty Node.js':
      await createEmptyNodeProject(projectDir, packageName);
      break;
    case 'React':
      await createReactProject(projectDir, packageName);
      break;
    case 'Next.js':
      await createNextJsProject(projectDir, packageName);
      break;
    case 'Angular':
      await createAngularProject(projectDir, packageName);
      break;
    case 'Vue.js':
      await createVueProject(projectDir, packageName);
      break;
    case 'Svelte':
      await createSvelteProject(projectDir, packageName);
      break;
    case 'Express.js':
      await createExpressProject(projectDir, packageName);
      break;
    case 'NestJS':
      await createNestJsProject(projectDir, packageName);
      break;
    case 'Fastify':
      await createFastifyProject(projectDir, packageName);
      break;
    case 'AdonisJS':
      await createAdonisJsProject(projectDir, packageName);
      break;
    case 'FeathersJS':
      await createFeathersJsProject(projectDir, packageName);
      break;
    case 'React Native':
      await createReactNativeProject(projectDir, packageName);
      break;
    case 'Expo':
      await createExpoProject(projectDir, packageName);
      break;
    case 'NativeScript':
      await createNativeScriptProject(projectDir, packageName);
      break;
    case 'Ionic':
      await createIonicProject(projectDir, packageName);
      break;
    case 'Capacitor.js':
      await createCapacitorProject(projectDir, packageName);
      break;
    case 'Electron':
      await createElectronProject(projectDir, packageName);
      break;
    case 'Tauri':
      await createTauriProject(projectDir, packageName);
      break;
    case 'Neutralino.js':
      await createNeutralinoProject(projectDir, packageName);
      break;
    case 'Proton Native':
      await createProtonNativeProject(projectDir, packageName);
      break;
    case 'Sciter':
      await createSciterProject(projectDir, packageName);
      break;
    default:
      throw new Error(`Unsupported project type: ${projectType}`);
  }

  // Ensure project has proper tsconfig.json
  updateTsConfig(rootDir, projectDir);
}

/**
 * Creates an Empty Node.js project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createEmptyNodeProject(projectDir, packageName) {
  // Create basic package.json based on app/package.json
  const packageJson = {
    "name": packageName,
    "version": "1.0.0",
    "private": true,
    "scripts": {
      "build": "tsc",
      "clean": "rimraf ./dist",
      "lint": "eslint src --ext .ts",
      "test": "jest --passWithNoTests",
      "start": "node ./dist/index.js",
      "dev": "tsc && node ./dist/index.js"
    },
    "devDependencies": {
      "@types/jest": "^29.5.14",
      "@types/node": "^22.13.13",
      "@typescript-eslint/eslint-plugin": "^8.28.0",
      "@typescript-eslint/parser": "^8.28.0",
      "eslint": "^9.23.0", 
      "jest": "^29.7.0",
      "rimraf": "^6.0.1",
      "ts-jest": "^29.3.0",
      "typescript": "^5.8.2"
    },
    "dependencies": {}
  };
  
  // Add package dependency to itself for proper monorepo setup
  packageJson.dependencies[packageName] = "file:";

  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create basic structure
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });
  
  // Create sample index.ts
  fs.writeFileSync(
    path.join(projectDir, 'src', 'index.ts'),
    `console.log('Hello from ${packageName}!');`
  );

  // Create empty test file
  fs.writeFileSync(
    path.join(projectDir, 'tests', 'index.test.ts'),
    `describe('${packageName}', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});`
  );
}

/**
 * Creates a React project using Vite
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createReactProject(projectDir, packageName) {
  try {
    // Use Vite to create React project
    execSync(`npx create-vite ${projectDir} --template react-ts`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Add missing scripts
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf ./dist';
    }
    if (!packageJson.scripts.lint) {
      packageJson.scripts.lint = 'eslint src --ext .ts,.tsx';
    }
    if (!packageJson.scripts.test) {
      packageJson.scripts.test = 'vitest run';
      // Add testing dependencies if they don't exist
      packageJson.devDependencies['vitest'] = defaultDependencies['vitest'];
      packageJson.devDependencies['@testing-library/react'] = defaultDependencies['@testing-library/react'];
    }
    
    // Add rimraf for clean script
    packageJson.devDependencies['rimraf'] = defaultDependencies['rimraf'];
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating React project:', error);
    throw error;
  }
}

/**
 * Creates a Next.js project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createNextJsProject(projectDir, packageName) {
  try {
    // Use create-next-app to create Next.js project
    execSync(`npx create-next-app ${projectDir} --typescript`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Add missing scripts
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf .next';
    }
    if (!packageJson.scripts.lint && !packageJson.scripts['lint:fix']) {
      packageJson.scripts.lint = 'next lint';
    }
    if (!packageJson.scripts.test) {
      packageJson.scripts.test = 'jest';
      // Add testing dependencies if they don't exist
      packageJson.devDependencies['jest'] = defaultDependencies['jest'];
      packageJson.devDependencies['@testing-library/react'] = defaultDependencies['@testing-library/react'];
      packageJson.devDependencies['@testing-library/jest-dom'] = defaultDependencies['@testing-library/jest-dom'];
    }
    
    // Add rimraf for clean script
    packageJson.devDependencies['rimraf'] = defaultDependencies['rimraf'];
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating Next.js project:', error);
    throw error;
  }
}

/**
 * Creates an Angular project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createAngularProject(projectDir, packageName) {
  try {
    // Use Angular CLI to create Angular project
    execSync(`npx @angular/cli new ${path.basename(projectDir)} --directory ${projectDir} --skip-git --skip-install`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Ensure all required scripts are present
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf ./dist';
    }
    
    // Add rimraf for clean script
    if (!packageJson.devDependencies.rimraf) {
      packageJson.devDependencies['rimraf'] = defaultDependencies['rimraf'];
    }
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating Angular project:', error);
    throw error;
  }
}

/**
 * Creates a Vue.js project using Vite
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createVueProject(projectDir, packageName) {
  try {
    // Use Vite to create Vue project
    execSync(`npx create-vite ${projectDir} --template vue-ts`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Add missing scripts
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf ./dist';
    }
    if (!packageJson.scripts.lint) {
      packageJson.scripts.lint = 'eslint src --ext .ts,.vue';
    }
    if (!packageJson.scripts.test) {
      packageJson.scripts.test = 'vitest run';
      // Add testing dependencies if they don't exist
      packageJson.devDependencies['vitest'] = defaultDependencies['vitest'];
      packageJson.devDependencies['@vue/test-utils'] = defaultDependencies['@vue/test-utils'];
    }
    
    // Add rimraf for clean script
    packageJson.devDependencies['rimraf'] = defaultDependencies['rimraf'];
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating Vue.js project:', error);
    throw error;
  }
}

/**
 * Creates a Svelte project using Vite
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createSvelteProject(projectDir, packageName) {
  try {
    // Use Vite to create Svelte project
    execSync(`npx create-vite ${projectDir} --template svelte-ts`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Add missing scripts
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf ./dist';
    }
    if (!packageJson.scripts.lint) {
      packageJson.scripts.lint = 'eslint src --ext .ts,.svelte';
    }
    if (!packageJson.scripts.test) {
      packageJson.scripts.test = 'vitest run';
      // Add testing dependencies if they don't exist
      packageJson.devDependencies['vitest'] = defaultDependencies['vitest'];
      packageJson.devDependencies['@testing-library/svelte'] = defaultDependencies['@testing-library/svelte'];
    }
    
    // Add rimraf for clean script
    packageJson.devDependencies['rimraf'] = defaultDependencies['rimraf'];
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating Svelte project:', error);
    throw error;
  }
}

/**
 * Creates an Express.js project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createExpressProject(projectDir, packageName) {
  // Create project structure
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });
  
  // Create package.json
  const packageJson = {
    name: packageName,
    version: '0.1.0',
    private: true,
    scripts: {
      clean: 'rimraf ./dist',
      lint: 'eslint src --ext .ts',
      test: 'jest',
      build: 'tsc',
      start: 'node ./dist/index.js',
      dev: 'ts-node-dev --respawn src/index.ts'
    },
    dependencies: {
      'express': defaultDependencies['express'],
      '@types/express': defaultDependencies['@types/express']
    },
    devDependencies: {
      '@types/node': defaultDependencies['@types/node'],
      'typescript': defaultDependencies['typescript'],
      'ts-node': defaultDependencies['ts-node'],
      'ts-node-dev': defaultDependencies['ts-node-dev'],
      'rimraf': defaultDependencies['rimraf'],
      'eslint': defaultDependencies['eslint'],
      'jest': defaultDependencies['jest'],
      '@types/jest': defaultDependencies['@types/jest'],
      'ts-jest': defaultDependencies['ts-jest'],
      'supertest': defaultDependencies['supertest'],
      '@types/supertest': defaultDependencies['@types/supertest']
    }
  };

  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create sample index.ts
  fs.writeFileSync(
    path.join(projectDir, 'src', 'index.ts'),
    `import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from ${packageName}!' });
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});

export default app;`
  );

  // Create sample test
  fs.writeFileSync(
    path.join(projectDir, 'tests', 'index.test.ts'),
    `import request from 'supertest';
import app from '../src/index';

describe('Express App', () => {
  it('should return hello message', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Hello from ${packageName}!');
  });
});`
  );
}

/**
 * Creates a NestJS project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createNestJsProject(projectDir, packageName) {
  try {
    // Use Nest CLI to create NestJS project
    execSync(`npx @nestjs/cli new ${projectDir} --skip-git --package-manager npm`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Ensure all required scripts are present
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf ./dist';
    }
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating NestJS project:', error);
    throw error;
  }
}

/**
 * Creates a Fastify project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createFastifyProject(projectDir, packageName) {
  // Create project structure
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });
  
  // Create package.json
  const packageJson = {
    name: packageName,
    version: '0.1.0',
    private: true,
    scripts: {
      clean: 'rimraf ./dist',
      lint: 'eslint src --ext .ts',
      test: 'jest',
      build: 'tsc',
      start: 'node ./dist/index.js',
      dev: 'ts-node-dev --respawn src/index.ts'
    },
    dependencies: {
      'fastify': defaultDependencies['fastify']
    },
    devDependencies: {
      '@types/node': defaultDependencies['@types/node'],
      'typescript': defaultDependencies['typescript'],
      'ts-node': defaultDependencies['ts-node'],
      'ts-node-dev': defaultDependencies['ts-node-dev'],
      'rimraf': defaultDependencies['rimraf'],
      'eslint': defaultDependencies['eslint'],
      'jest': defaultDependencies['jest'],
      '@types/jest': defaultDependencies['@types/jest'],
      'ts-jest': defaultDependencies['ts-jest']
    }
  };

  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create sample index.ts
  fs.writeFileSync(
    path.join(projectDir, 'src', 'index.ts'),
    `import Fastify from 'fastify';

const fastify = Fastify({
  logger: true
});

fastify.get('/', async (request, reply) => {
  return { message: 'Hello from ${packageName}!' };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export default fastify;`
  );

  // Create sample test
  fs.writeFileSync(
    path.join(projectDir, 'tests', 'index.test.ts'),
    `import fastify from '../src/index';

describe('Fastify App', () => {
  afterAll(() => {
    fastify.close();
  });

  it('should return hello message', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/'
    });
    
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).message).toBe('Hello from ${packageName}!');
  });
});`
  );
}

/**
 * Creates an AdonisJS project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createAdonisJsProject(projectDir, packageName) {
  try {
    // Use AdonisJS CLI to create AdonisJS project
    execSync(`npx create-adonis-ts-app ${projectDir} --api-only`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Add missing scripts
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf build';
    }
    
    // Add rimraf for clean script
    packageJson.devDependencies['rimraf'] = defaultDependencies['rimraf'];
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating AdonisJS project:', error);
    throw error;
  }
}

/**
 * Creates a FeathersJS project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createFeathersJsProject(projectDir, packageName) {
  try {
    // TODO: Implement using Feathers CLI when available
    // For now, create a basic structure

    // Create project structure
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: packageName,
      version: '0.1.0',
      private: true,
      scripts: {
        clean: 'rimraf lib',
        lint: 'eslint src --ext .ts',
        test: 'jest',
        build: 'tsc',
        start: 'node lib/index.js',
        dev: 'ts-node-dev --respawn src/index.ts'
      },
      dependencies: {
        '@feathersjs/feathers': defaultDependencies['@feathersjs/feathers'],
        '@feathersjs/express': defaultDependencies['@feathersjs/express'],
        '@feathersjs/socketio': defaultDependencies['@feathersjs/socketio']
      },
      devDependencies: {
        '@types/node': defaultDependencies['@types/node'],
        'typescript': defaultDependencies['typescript'],
        'ts-node': defaultDependencies['ts-node'],
        'ts-node-dev': defaultDependencies['ts-node-dev'],
        'rimraf': defaultDependencies['rimraf'],
        'eslint': defaultDependencies['eslint'],
        'jest': defaultDependencies['jest'],
        '@types/jest': defaultDependencies['@types/jest'],
        'ts-jest': defaultDependencies['ts-jest']
      }
    };
  
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create sample index.ts
    fs.writeFileSync(
      path.join(projectDir, 'src', 'index.ts'),
      `import feathers from '@feathersjs/feathers';
import express from '@feathersjs/express';
import socketio from '@feathersjs/socketio';

// Create a Feathers application
const app = express(feathers());

// Parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure Socket.io realtime API
app.configure(socketio());

// Register a simple message service
app.use('messages', {
  async find() {
    return [
      { message: 'Hello from ${packageName}!' }
    ];
  }
});

// Start the server
const port = process.env.PORT || 3030;
app.listen(port, () => {
  console.log(\`Feathers server running on http://localhost:\${port}\`);
});

export default app;`
    );
  
    // Create sample test
    fs.writeFileSync(
      path.join(projectDir, 'tests', 'index.test.ts'),
      `import app from '../src/index';

describe('Feathers App', () => {
  it('should return hello message', async () => {
    const service = app.service('messages');
    const messages = await service.find();
    
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toBe('Hello from ${packageName}!');
  });
});`
    );
  } catch (error) {
    console.error('Error creating FeathersJS project:', error);
    throw error;
  }
}

/**
 * Creates a React Native project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createReactNativeProject(projectDir, packageName) {
  try {
    // Use React Native CLI to create React Native project
    execSync(`npx react-native init ${path.basename(projectDir)} --directory ${projectDir} --template react-native-template-typescript`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Add missing scripts
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf android/app/build ios/build';
    }
    if (!packageJson.scripts.lint && !packageJson.scripts['lint:fix']) {
      packageJson.scripts.lint = 'eslint . --ext .js,.jsx,.ts,.tsx';
    }
    if (!packageJson.scripts.build) {
      packageJson.scripts.build = 'tsc';
    }
    
    // Add rimraf for clean script
    packageJson.devDependencies['rimraf'] = defaultDependencies['rimraf'];
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating React Native project:', error);
    throw error;
  }
}

/**
 * Creates an Expo project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createExpoProject(projectDir, packageName) {
  try {
    // Use Expo CLI to create Expo project
    execSync(`npx create-expo-app ${projectDir} -t expo-template-blank-typescript`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Add missing scripts
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf .expo .expo-shared dist';
    }
    if (!packageJson.scripts.lint) {
      packageJson.scripts.lint = 'eslint . --ext .js,.jsx,.ts,.tsx';
    }
    if (!packageJson.scripts.test) {
      packageJson.scripts.test = 'jest';
      // Add testing dependencies if they don't exist
      packageJson.devDependencies['jest'] = defaultDependencies['jest'];
      packageJson.devDependencies['@testing-library/react-native'] = defaultDependencies['@testing-library/react-native'];
    }
    if (!packageJson.scripts.build) {
      packageJson.scripts.build = 'expo export:web';
    }
    
    // Add rimraf for clean script
    packageJson.devDependencies['rimraf'] = defaultDependencies['rimraf'];
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating Expo project:', error);
    throw error;
  }
}

/**
 * Creates a NativeScript project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createNativeScriptProject(projectDir, packageName) {
  try {
    // Use NativeScript CLI to create NativeScript project
    execSync(`npx @nativescript/cli create ${projectDir} --ts`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Add missing scripts
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf hooks node_modules platforms';
    }
    if (!packageJson.scripts.lint) {
      packageJson.scripts.lint = 'eslint src --ext .ts';
    }
    if (!packageJson.scripts.test) {
      packageJson.scripts.test = 'jest';
      // Add testing dependencies if they don't exist
      packageJson.devDependencies['jest'] = defaultDependencies['jest'];
      packageJson.devDependencies['@types/jest'] = defaultDependencies['@types/jest'];
    }
    
    // Add rimraf for clean script
    packageJson.devDependencies['rimraf'] = defaultDependencies['rimraf'];
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating NativeScript project:', error);
    throw error;
  }
}

/**
 * Creates an Ionic project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createIonicProject(projectDir, packageName) {
  try {
    // Use Ionic CLI to create Ionic project
    execSync(`npx @ionic/cli start ${projectDir} blank --type=react --capacitor`, { stdio: 'inherit' });
    
    // Modify package.json to comply with monorepo structure
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.name = packageName;
    packageJson.private = true;
    
    // Add missing scripts
    if (!packageJson.scripts.clean) {
      packageJson.scripts.clean = 'rimraf build';
    }
    
    // Add rimraf for clean script
    packageJson.devDependencies['rimraf'] = defaultDependencies['rimraf'];
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating Ionic project:', error);
    throw error;
  }
}

/**
 * Creates a Capacitor project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createCapacitorProject(projectDir, packageName) {
  try {
    // First create a React project with Vite (web app)
    await createReactProject(projectDir, packageName);
    
    // Add Capacitor
    execSync(`cd ${projectDir} && npm install @capacitor/core @capacitor/cli`, { stdio: 'inherit' });
    execSync(`cd ${projectDir} && npx cap init ${packageName} ${packageName} --web-dir=dist`, { stdio: 'inherit' });
    execSync(`cd ${projectDir} && npm install @capacitor/ios @capacitor/android`, { stdio: 'inherit' });
    
    // Modify package.json to add Capacitor scripts
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Add Capacitor scripts
    packageJson.scripts['cap:add'] = 'cap add';
    packageJson.scripts['cap:copy'] = 'cap copy';
    packageJson.scripts['cap:open'] = 'cap open';
    packageJson.scripts['cap:build'] = 'npm run build && npm run cap:copy';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating Capacitor project:', error);
    throw error;
  }
}

/**
 * Creates an Electron project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createElectronProject(projectDir, packageName) {
  try {
    // Create project structure
    fs.mkdirSync(projectDir, { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: packageName,
      version: '0.1.0',
      private: true,
      scripts: {
        clean: 'rimraf ./dist',
        lint: 'eslint src --ext .ts,.tsx',
        test: 'jest',
        build: 'vite build',
        start: 'electron .',
        dev: 'vite & electron .'
      },
      main: 'electron/main.js',
      dependencies: {
        'electron': defaultDependencies['electron'],
        'react': defaultDependencies['react'],
        'react-dom': defaultDependencies['react-dom']
      },
      devDependencies: {
        '@types/react': defaultDependencies['@types/react'],
        '@types/react-dom': defaultDependencies['@types/react-dom'],
        '@types/node': defaultDependencies['@types/node'],
        'typescript': defaultDependencies['typescript'],
        'vite': defaultDependencies['vite'],
        '@vitejs/plugin-react': defaultDependencies['@vitejs/plugin-react'],
        'electron-builder': defaultDependencies['electron-builder'],
        'rimraf': defaultDependencies['rimraf'],
        'eslint': defaultDependencies['eslint'],
        'jest': defaultDependencies['jest'],
        '@types/jest': defaultDependencies['@types/jest']
      }
    };
    
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create directories
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'electron'), { recursive: true });
    
    // Create Vite config
    fs.writeFileSync(
      path.join(projectDir, 'vite.config.ts'),
      `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  }
});`
    );
    
    // Create main.js for Electron
    fs.writeFileSync(
      path.join(projectDir, 'electron', 'main.js'),
      `const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : url.format({
        pathname: path.join(__dirname, '../dist/index.html'),
        protocol: 'file:',
        slashes: true
      });

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function() {
  if (mainWindow === null) {
    createWindow();
  }
});`
    );
    
    // Create React app files
    fs.writeFileSync(
      path.join(projectDir, 'src', 'index.html'),
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${packageName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
    );
    
    fs.writeFileSync(
      path.join(projectDir, 'src', 'main.tsx'),
      `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
    );
    
    fs.writeFileSync(
      path.join(projectDir, 'src', 'App.tsx'),
      `import React from 'react';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to ${packageName}!</h1>
        <p>An Electron application with React and TypeScript</p>
      </header>
    </div>
  );
}

export default App;`
    );
  } catch (error) {
    console.error('Error creating Electron project:', error);
    throw error;
  }
}

/**
 * Creates a Tauri project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createTauriProject(projectDir, packageName) {
  try {
    // Create a React project with Vite first
    await createReactProject(projectDir, packageName);
    
    // Add Tauri
    execSync(`cd ${projectDir} && npm install @tauri-apps/cli @tauri-apps/api`, { stdio: 'inherit' });
    execSync(`cd ${projectDir} && npx @tauri-apps/cli init`, { stdio: 'inherit' });
    
    // Update package.json with Tauri scripts
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Add Tauri scripts
    packageJson.scripts['tauri'] = 'tauri';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Error creating Tauri project:', error);
    throw error;
  }
}

/**
 * Creates a Neutralino.js project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createNeutralinoProject(projectDir, packageName) {
  try {
    // Create project using Neutralino CLI
    execSync(`npx @neutralinojs/neu create ${projectDir}`, { stdio: 'inherit' });
    
    // Add package.json for monorepo integration
    const packageJson = {
      name: packageName,
      version: '0.1.0',
      private: true,
      scripts: {
        clean: 'rimraf ./dist',
        lint: 'eslint src --ext .ts,.js',
        test: 'jest',
        build: 'npx @neutralinojs/neu build',
        start: 'npx @neutralinojs/neu run',
        dev: 'npx @neutralinojs/neu run --frontend-lib-dev'
      },
      devDependencies: {
        '@neutralinojs/neu': defaultDependencies['@neutralinojs/neu'],
        'typescript': defaultDependencies['typescript'],
        'rimraf': defaultDependencies['rimraf'],
        'eslint': defaultDependencies['eslint'],
        'jest': defaultDependencies['jest'],
        '@types/jest': defaultDependencies['@types/jest']
      }
    };
    
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  } catch (error) {
    console.error('Error creating Neutralino.js project:', error);
    throw error;
  }
}

/**
 * Creates a Proton Native project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createProtonNativeProject(projectDir, packageName) {
  try {
    // Create basic structure
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: packageName,
      version: '0.1.0',
      private: true,
      scripts: {
        clean: 'rimraf ./dist',
        lint: 'eslint src --ext .js,.jsx',
        test: 'jest',
        build: 'babel src -d dist',
        start: 'node ./dist/index.js',
        dev: 'babel-node src/index.js'
      },
      dependencies: {
        'proton-native': defaultDependencies['proton-native'],
        'react': defaultDependencies['react']
      },
      devDependencies: {
        '@babel/cli': defaultDependencies['@babel/cli'],
        '@babel/core': defaultDependencies['@babel/core'],
        '@babel/node': defaultDependencies['@babel/node'],
        '@babel/preset-env': defaultDependencies['@babel/preset-env'],
        '@babel/preset-react': defaultDependencies['@babel/preset-react'],
        'eslint': defaultDependencies['eslint'],
        'jest': defaultDependencies['jest'],
        'rimraf': defaultDependencies['rimraf']
      }
    };
    
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create babel config
    fs.writeFileSync(
      path.join(projectDir, '.babelrc'),
      JSON.stringify({
        presets: ['@babel/preset-env', '@babel/preset-react']
      }, null, 2)
    );
    
    // Create sample app
    fs.writeFileSync(
      path.join(projectDir, 'src', 'index.js'),
      `import React, { Component } from 'react';
import { render, Window, App, Text, Box } from 'proton-native';

class Example extends Component {
  render() {
    return (
      <App>
        <Window title="${packageName}" size={{ width: 600, height: 400 }}>
          <Box>
            <Text>Welcome to ${packageName}!</Text>
          </Box>
        </Window>
      </App>
    );
  }
}

render(<Example />);`
    );
  } catch (error) {
    console.error('Error creating Proton Native project:', error);
    throw error;
  }
}

/**
 * Creates a Sciter project
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 */
async function createSciterProject(projectDir, packageName) {
  try {
    // Create basic structure
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'resources'), { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: packageName,
      version: '0.1.0',
      private: true,
      scripts: {
        clean: 'rimraf ./dist',
        lint: 'eslint src --ext .js',
        test: 'jest',
        build: 'rollup -c',
        start: 'scapp src/index.html',
        dev: 'rollup -c -w'
      },
      dependencies: {
        'sciter-js': defaultDependencies['sciter-js']
      },
      devDependencies: {
        'rollup': defaultDependencies['rollup'],
        'eslint': defaultDependencies['eslint'],
        'jest': defaultDependencies['jest'],
        'rimraf': defaultDependencies['rimraf']
      }
    };
    
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create sample HTML file
    fs.writeFileSync(
      path.join(projectDir, 'src', 'index.html'),
      `<!DOCTYPE html>
<html>
  <head>
    <title>${packageName}</title>
    <style>
      body {
        font-family: system-ui;
        padding: 2em;
      }
      h1 {
        color: #333;
      }
    </style>
    <script type="module">
      import * as sciter from '@sciter';
      
      document.addEventListener('DOMContentLoaded', function() {
        document.getElementById('app-name').textContent = '${packageName}';
      });
    </script>
  </head>
  <body>
    <h1>Welcome to <span id="app-name"></span>!</h1>
    <p>This is a Sciter.js application.</p>
  </body>
</html>`
    );
    
    // Create rollup config
    fs.writeFileSync(
      path.join(projectDir, 'rollup.config.js'),
      `export default {
  input: 'src/main.js',
  output: {
    file: 'dist/bundle.js',
    format: 'es'
  }
};`
    );
  } catch (error) {
    console.error('Error creating Sciter project:', error);
    throw error;
  }
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
 * Updates the monorepo configuration to include the new project
 * @param {string} rootDir - Root directory of the monorepo
 * @param {string} projectDir - Project directory
 * @param {string} projectName - Project name
 * @param {string} slug - Project slug
 */
async function updateMonorepoConfig(rootDir, projectDir, projectName, slug) {
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
      rootPackageJson.scripts[`clean:${slug}`] = `npm run clean --workspace=@monorepo/${slug}`;
      rootPackageJson.scripts[`lint:${slug}`] = `npm run lint --workspace=@monorepo/${slug}`;
      rootPackageJson.scripts[`test:${slug}`] = `npm run test --workspace=@monorepo/${slug}`;
      rootPackageJson.scripts[`build:${slug}`] = `npm run build --workspace=@monorepo/${slug}`;
      rootPackageJson.scripts[`start:${slug}`] = `npm run start --workspace=@monorepo/${slug}`;
      
      fs.writeFileSync(rootPackageJsonPath, JSON.stringify(rootPackageJson, null, 2));
      console.log('Updated root package.json');
    } catch (error) {
      console.error('Error updating root package.json:', error);
    }
  }

  // Update VSCode launch.json to include the new project
  const launchJsonPath = path.join(rootDir, '.vscode', 'launch.json');
  if (fs.existsSync(launchJsonPath)) {
    try {
      const launchJson = JSON.parse(fs.readFileSync(launchJsonPath, 'utf8'));
      
      // Create a new configuration based on the format in launch.json
      const newConfig = {
        "type": "node",
        "request": "launch",
        "name": `Debug ${projectName}`,
        "runtimeExecutable": "npm",
        "runtimeArgs": [
          "run",
          "dev"
        ],
        "cwd": `$\{workspaceFolder}/packages/${slug}`,
        "console": "integratedTerminal",
        "internalConsoleOptions": "neverOpen"
      };
      
      // Add the new configuration
      launchJson.configurations.push(newConfig);
      
      fs.writeFileSync(launchJsonPath, JSON.stringify(launchJson, null, 2));
      console.log('Updated launch.json');
    } catch (error) {
      console.error('Error updating launch.json:', error);
    }
  } else {
    console.warn('launch.json not found, creating it');
    
    // Create launch.json based on the provided structure
    const launchJson = {
      "version": "0.2.0",
      "configurations": [
        {
          "type": "node",
          "request": "launch",
          "name": `Debug ${projectName}`,
          "runtimeExecutable": "npm",
          "runtimeArgs": [
            "run",
            "dev"
          ],
          "cwd": `$\{workspaceFolder}/packages/${slug}`,
          "console": "integratedTerminal",
          "internalConsoleOptions": "neverOpen"
        }
      ]
    };
    
    // Ensure .vscode directory exists
    const vscodeDir = path.join(rootDir, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
    
    fs.writeFileSync(launchJsonPath, JSON.stringify(launchJson, null, 2));
    console.log('Created launch.json');
  }

  // Update VSCode tasks.json
  const tasksJsonPath = path.join(rootDir, '.vscode', 'tasks.json');
  if (fs.existsSync(tasksJsonPath)) {
    try {
      const tasksJson = JSON.parse(fs.readFileSync(tasksJsonPath, 'utf8'));
      
      // Add new tasks based on existing pattern in tasks.json
      const newTasks = [
        {
          "label": `Clean ${projectName}`,
          "type": "shell",
          "command": `npm run clean:${slug}`,
          "group": "none"
        },
        {
          "label": `Lint ${projectName}`,
          "type": "shell",
          "command": `npm run lint:${slug}`,
          "group": "test",
          "problemMatcher": "$eslint-stylish"
        },
        {
          "label": `Test ${projectName}`,
          "type": "shell",
          "command": `npm run test:${slug}`,
          "group": "test"
        },
        {
          "label": `Build ${projectName}`,
          "type": "shell",
          "command": `npm run build:${slug}`,
          "group": "build",
          "problemMatcher": "$tsc"
        },
        {
          "label": `Start ${projectName}`,
          "type": "shell",
          "command": `npm run start:${slug}`,
          "group": "none"
        }
      ];
      
      // Add the new tasks
      tasksJson.tasks.push(...newTasks);
      
      fs.writeFileSync(tasksJsonPath, JSON.stringify(tasksJson, null, 2));
      console.log('Updated tasks.json');
    } catch (error) {
      console.error('Error updating tasks.json:', error);
    }
  } else {
    console.warn('tasks.json not found, creating it');
    
    // Create tasks.json based on the provided structure
    const tasksJson = {
      "version": "2.0.0",
      "tasks": [
        {
          "label": `Clean ${projectName}`,
          "type": "shell",
          "command": `npm run clean:${slug}`,
          "group": "none"
        },
        {
          "label": `Lint ${projectName}`,
          "type": "shell",
          "command": `npm run lint:${slug}`,
          "group": "test",
          "problemMatcher": "$eslint-stylish"
        },
        {
          "label": `Test ${projectName}`,
          "type": "shell",
          "command": `npm run test:${slug}`,
          "group": "test"
        },
        {
          "label": `Build ${projectName}`,
          "type": "shell",
          "command": `npm run build:${slug}`,
          "group": "build",
          "problemMatcher": "$tsc"
        },
        {
          "label": `Start ${projectName}`,
          "type": "shell",
          "command": `npm run start:${slug}`,
          "group": "none"
        }
      ]
    };
    
    // Ensure .vscode directory exists
    const vscodeDir = path.join(rootDir, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
    
    fs.writeFileSync(tasksJsonPath, JSON.stringify(tasksJson, null, 2));
    console.log('Created tasks.json');
  }
}

/**
 * Updates the tsconfig.json of the project
 * @param {string} rootDir - Root directory of the monorepo
 * @param {string} projectDir - Project directory
 */
function updateTsConfig(rootDir, projectDir) {
  const appTsConfigPath = path.join(rootDir, 'packages', 'app', 'tsconfig.json');
  const projectTsConfigPath = path.join(projectDir, 'tsconfig.json');
  
  // Based on the provided app-tsconfig.json, create a proper tsconfig.json
  if (!fs.existsSync(projectTsConfigPath)) {
    try {
      // Create a tsconfig.json similar to the app's
      const tsConfig = {
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
      
      fs.writeFileSync(projectTsConfigPath, JSON.stringify(tsConfig, null, 2));
      console.log('Created tsconfig.json');
    } catch (error) {
      console.error('Error creating tsconfig.json:', error);
    }
  } else if (fs.existsSync(appTsConfigPath) && fs.existsSync(projectTsConfigPath)) {
    // If both exist, ensure the project's tsconfig has the correct structure
    try {
      const appTsConfig = JSON.parse(fs.readFileSync(appTsConfigPath, 'utf8'));
      const projectTsConfig = JSON.parse(fs.readFileSync(projectTsConfigPath, 'utf8'));
      
      let modified = false;
      
      // Ensure extends is set correctly
      if (projectTsConfig.extends !== "../../tsconfig.json") {
        projectTsConfig.extends = "../../tsconfig.json";
        modified = true;
      }
      
      // Ensure compilerOptions are set correctly
      if (!projectTsConfig.compilerOptions) {
        projectTsConfig.compilerOptions = appTsConfig.compilerOptions;
        modified = true;
      } else {
        if (!projectTsConfig.compilerOptions.outDir || !projectTsConfig.compilerOptions.outDir.includes("dist")) {
          projectTsConfig.compilerOptions.outDir = "./dist";
          modified = true;
        }
        if (!projectTsConfig.compilerOptions.tsBuildInfoFile) {
          projectTsConfig.compilerOptions.tsBuildInfoFile = "./dist/tsconfig.tsbuildinfo";
          modified = true;
        }
        if (!projectTsConfig.compilerOptions.rootDir) {
          projectTsConfig.compilerOptions.rootDir = "./src";
          modified = true;
        }
      }
      
      // Ensure include is set correctly
      if (!projectTsConfig.include) {
        projectTsConfig.include = ["src/**/*"];
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(projectTsConfigPath, JSON.stringify(projectTsConfig, null, 2));
        console.log('Updated tsconfig.json with correct structure');
      }
    } catch (error) {
      console.error('Error updating tsconfig.json:', error);
    }
  }
}

/**
 * Install npm dependencies for a package
 * @param {string} packageDir - Directory containing package.json
 * @returns {boolean} - True if installation was successful
 */
function installNpmDependencies(packageDir) {
  try {
    console.error(`${packageDir}: npm install --include=dev --prefix=.`);
    execSync('npm install --include=dev --prefix=.', { cwd: packageDir, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Error: Failed running npm install in ${packageDir}: ${err.message}`);
    return false;
  }
}

module.exports = { createNewProject };