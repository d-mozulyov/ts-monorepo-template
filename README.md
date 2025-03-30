# TypeScript Monorepo Template

A comprehensive template for managing multiple TypeScript projects within a single repository.

## What is a Monorepo?

A monorepo (monolithic repository) is a software development strategy where code for multiple projects is stored in the same repository, enabling easy code sharing, simplified dependency management, atomic changes across packages, coordinated versioning, unified CI/CD pipelines, and improved developer experience with better visibility into the entire ecosystem — all while maintaining centralized configuration, shared tooling, and consistent standards.

## Common Challenges with TypeScript Monorepos

TypeScript monorepos face significant setup challenges: cross-package type sharing, project references configuration, efficient incremental builds, consistent path aliases, proper build order orchestration, and maintaining IDE intellisense across workspace boundaries while keeping build performance acceptable as the codebase grows.

## Why This Monorepo Template?

This TypeScript monorepo template provides an opinionated yet flexible foundation with several key advantages:

- **Lightweight & Minimal Dependencies** - Built with simplicity in mind using native workspaces without heavy external orchestration tools, resulting in faster installations and reduced dependency maintenance
- **Project Scaffolding** - Interactive CLI tool for creating new projects/modules with proper configuration
- **Multi-Framework Support** - Ready-to-use templates for popular frameworks (React, Vue, Angular, Express, NestJS, React Native, Electron, etc.)
- **Shared Module System** - Automatic symlink creation to shared modules with proper TypeScript path resolution
- **VS Code Integration** - Pre-configured debugging, tasks, and settings optimized for monorepo development
- **Atomicity** - Each workspace project builds independently, allowing for isolated debugging, testing, and deployment while still enabling cross-package imports when needed - perfect balance of independence and integration

## Getting Started

To create your own monorepo based on this template, follow these steps:

1. **Obtain the template**. You can download the source code as a [ZIP archive from GitHub](https://github.com/d-mozulyov/ts-monorepo-template/archive/refs/heads/main.zip) or clone the repository and remove the `.git` folder:
   ```bash
   git clone https://github.com/d-mozulyov/ts-monorepo-template.git my-monorepo
   cd my-monorepo
   rmdir /s /q .git    # Windows
   rm -rf .git         # Linux/macOS/Bash
   ```
2. **Initialize Git repository**. This monorepo structure doesn't impose any restrictions on repository usage, so you're free to either use it without creating a repository or **copy these files into your existing one** and add them with the console command `git add .`. If you'd prefer to create a new repository, you can do so like this:
   ```bash
   git init
   git add .
   git commit -m "Add TypeScript monorepo structure
   git remote add origin url/to/your/repository.git
   git push origin main
   ```
3. **Setup dependencies**. Instead of using standard `npm install`, run the universal setup script:
   ```bash
   setup.cmd         # Windows
   sh ./setup.cmd    # Linux/macOS/Bash
   ```
   For more details on how this works and why it's important, see the "Shared Modules and Atomic Build Architecture" section below.
   
4. **Build the app example project**. This monorepo features a comprehensive set of standard scripts (detailed in the "Standard NPM Scripts" section below). You can build only the App application or all monorepo applications with a single command:
   ```bash
   npm run build       # Build all applications
   npm run build:app   # Build App application
   ```
5. **Run the app example project**
   Start the app project:
   ```bash
   npm run start:app
   ```
   You should see the following output in the console:
   ```
   Hello from the App!
   2 + 3 = 5
   ```
   This demonstrates that the app project successfully imports a function from the shared module.

## Standard NPM Scripts
When inside a specific project directory (e.g., `packages/app`), you can run these standard scripts:
```
npm run clean  - Removes build artifacts
npm run lint   - Runs ESLint
npm run test   - Runs tests
npm run build  - Compiles TypeScript to JavaScript
npm run start  - Runs the compiled project
```
When in the root directory of the monorepo, you can run scripts affecting all projects:
```
npm run clean  - Removes build artifacts from all projects
npm run lint   - Runs ESLint on all projects
npm run test   - Runs tests for all projects
npm run build  - Compiles TypeScript to JavaScript for all projects
```
Or target specific projects with namespaced commands:
```
npm run clean:app        - Removes build artifacts from app project
npm run lint:app         - Runs ESLint on app project
npm run test:app         - Runs tests for app project
npm run build:app        - Compiles TypeScript to JavaScript for app project
npm run start:app        - Runs the compiled app project

npm run build:telegram-bot  - Builds only the telegram-bot project
npm run start:backend       - Starts only the backend project
```
Following the same pattern, you can work with any workspace project in the monorepo. Each new project created with `create-new.cmd` automatically registers these standardized scripts in the root package.json.

## VS Code Integration
The monorepo includes pre-configured VS Code settings that enhance development:
- **Tasks** - All standard npm scripts are available as VS Code tasks in `tasks.json`:
  ```
  Clean, Lint, Test, Build                                # all application
  Clean App, Lint App, Test App, Build App, Start App     # specific application (App)
  ```
- **Debugging** - Each project has its own debug configuration in `launch.json`:
  ```
  Debug App
  ```
- **Editor Settings** - TypeScript-optimized configuration with formatOnSave and ESLint integration in `settings.json`

When you create a new project using `create-new.cmd`, corresponding VS Code tasks and debug configurations are automatically added to these files. This ensures a consistent development experience and allows you to run, debug, and maintain all projects directly from VS Code's interface.

## Shared Modules and Atomic Build Architecture

This monorepo uses symbolic links instead of package dependencies to connect the `shared` directory to each project via `src/@shared`. This approach allows any module hierarchy in the shared folder and ensures only used code gets included in builds. For example, here's the code from the App application:

```typescript
import { add } from './@shared' /* or './@shared/utils' or './@shared/utils/math' */;

console.log('Hello from the App!');
console.log(`2 + 3 = ${add(2, 3)}`);
```
Standard `npm install` doesn't work correctly here as it would create node_modules only in the repository root. Instead, the `setup.cmd` script creates symlinks, installs dependencies for each package individually, and configures the TypeScript path resolutions. Run it on Windows with `setup.cmd` or on Linux/macOS with `sh ./setup.cmd`. Note that Windows requires administrator privileges for symlink creation.

Each project builds independently, allowing isolated debugging and deploying only changed projects. The shared module system ensures code consistency while maintaining component independence.

## Multi-Framework Support

The monorepo architecture doesn't limit what frameworks you can add, but with the built-in `create-new.cmd` script, you can easily initialize a wide variety of project types:

- Shared module
- Empty Node.js
- Frontend: React, Next.js, Angular, Vue.js, Svelte
- Backend: Express.js, NestJS, Fastify, AdonisJS, FeathersJS
- Mobile: React Native, Expo, NativeScript, Ionic, Capacitor.js
- Desktop: Electron, Tauri, Neutralino.js, Proton Native, Sciter

![Project Creation Menu](./packages/shared/cli/create-new-menu.png)

Run it on Windows with `create-new.cmd` or on Linux/macOS with sh `./create-new.cmd`. Each framework comes with properly configured TypeScript, build scripts, and shared module integration. Note that Windows requires administrator privileges for symlink creation. If you're developing on Windows and don't have administrator rights, this monorepo template will likely be unusable for you.

## Contributing

This TypeScript monorepo template is an open project, and contributions are welcome! If you find it useful, consider:

- ⭐ Star the repository
- 🐛 Creating issues for bugs you find
- 🔧 Submitting PRs to improve functionality
- 📚 Enhancing documentation
- 🚀 Sharing your experience using it

If you're using this template for your own projects, I'd love to hear about your use case and any customizations you've made. For major changes or new framework additions, please open an issue first to discuss what you'd like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
