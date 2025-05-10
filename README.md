# Lightweight TypeScript Monorepo

[<img align="left" src="https://github.com/user-attachments/assets/d8fdc0f6-950d-4e3e-a847-a001dfe056f5">](https://t.me/ts_monorepo)

A **monorepo** (monolithic repository) is a software development strategy where code for multiple projects is stored in the same repository. This approach brings multiple projects together under one roof, offering key benefits. It enables streamlined code sharing between projects with direct access to shared modules, simplifies dependency management through centralized versioning, and allows atomic changes across projects for coordinated updates. Monorepos also provide unified tooling and configuration for consistent standards across the ecosystem.

This approach is especially valuable for individual developers managing multiple interconnected projects, small teams seeking to reduce overhead, and early-stage projects that need flexibility to evolve rapidly.

TypeScript monorepos typically face challenges like cross-project type sharing, proper references configuration, efficient build systems, and consistent path aliases. This template provides a lightweight solution that minimizes dependencies while delivering robust development tooling.

## Why This Monorepo Template?

This TypeScript monorepo template provides an opinionated yet flexible foundation with several key advantages:

- **Lightweight & Minimal Dependencies** - Built with simplicity in mind using native workspaces without heavy external orchestration tools, resulting in faster installations and reduced dependency maintenance
- **Project Scaffolding** - Interactive CLI tool for creating new projects/modules with proper configuration
- **Multi-Framework Support** - Ready-to-use templates for popular frameworks (React, Vue, Angular, Express, NestJS, React Native, Electron, etc.)
- **Shared Module System** - Automatic symlink creation to shared modules with proper TypeScript path resolution
- **VS Code Integration** - Pre-configured debugging, tasks, and settings optimized for monorepo development
- **Atomicity** - Each workspace project builds independently, allowing for isolated debugging, testing, and deployment while still enabling cross-project imports when needed - perfect balance of independence and integration

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
   git commit -m "Add TypeScript monorepo structure"
   git remote add origin url/to/your/repository.git
   git push origin main
   ```
3. **Setup dependencies**. Instead of using standard `npm install`, run the universal setup script:
   ```bash
   setup.cmd         # Windows
   sh ./setup.cmd    # Linux/macOS/Bash
   ```
   For more details on how this works and why it's important, see the _"Shared Modules and Atomic Build Architecture"_ section below.

4. **Build the app example project**. This monorepo features a comprehensive set of standard scripts (detailed in the _"Standard Package Scripts_" section below). You can build only the "app" application or all monorepo applications with a single command:
   ```bash
   npm run build       # Build all applications
   npm run build:app   # Build "app" application
   ```
5. **Run the app example project**.
   ```bash
   # Start the app project
   npm run start:app

   # You should see the following output in the console:
   Hello from the app!
   2 + 3 = 5
   ```

## Standard Package Scripts

Each `package.json` contains a `scripts` section that can be manually configured and executed from the command line. Each script has a name (like `build`, `test`, `start`, etc.) which is used to execute it. For example, the same script named `build` can be run using different package managers:
```bash
npm run build | yarn build | pnpm build
```
The monorepo template does not impose any restrictions on this section beyond the existing syntax rules. However, when generating a new project within this monorepo, for your convenience, we pre-populate a set of typical scripts that you can run right away: some are described in the root directory, some in the project directory.

For example, if you are in the project directory `projects/app`, you can run the following:
```
npm run clean  - Removes build artifacts
npm run lint   - Runs ESLint
npm run test   - Runs tests
npm run build  - Compiles TypeScript to JavaScript
npm run start  - Runs the compiled project
```
When in the root directory of the monorepo, you can run scripts affecting all projects or target specific projects with namespaced commands:
```
npm run clean  - Removes build artifacts from all projects
npm run lint   - Runs ESLint on all projects
npm run test   - Runs tests for all projects
npm run build  - Compiles TypeScript to JavaScript for all projects

npm run clean:app    - Removes build artifacts from app project
npm run lint:app     - Runs ESLint on app project
npm run test:app     - Runs tests for app project
npm run build:app    - Compiles TypeScript to JavaScript for app project
npm run start:app    - Runs the compiled app project

npm run build:telegram-bot  - Builds only the telegram-bot project
npm run start:backend       - Starts only the backend project
```
Following the same pattern, you can work with any workspace project in the monorepo. Each new project created with `create-new.cmd` automatically registers these standardized scripts in the root package.json.

## VS Code Integration

The monorepo includes pre-configured VS Code settings that enhance development, which you can see in the example project "app":

- **Tasks** - All standard package scripts are available as VS Code tasks in `tasks.json`:
  `Clean`, `Lint`, `Test`, `Build`, `Start`
- **Debugging** - Each project has its own `Debug` configuration in `launch.json`
- **Editor Settings** - The `settings.json` file contains settings that improve development experience, such as formatOnSave and ESLint integration

All these standard configurations are automatically added for a newly created project when you execute the `create-new.cmd` script. In Windows, you can run the script directly through the GUI or from the command line, but administrator privileges will be required. For Linux and macOS, you need to execute it through the terminal using, for example, `sh ./create-new.cmd`.

## Shared Modules and Atomic Build Architecture

There are multiple ways to organize access to a `shared` directory in a monorepo. We suggest you consider creating a symbolic link called `src/@shared` pointing to this directory. This approach differs from the traditional method of importing shared code as a package, offering advantages like flexible module hierarchy, tree-shaking optimizations, and direct source access for easier debugging. In the "app" application example, the `add()` function is imported from `@shared` symlink. This approach allows importing directly from a specific directory or module for better optimization and readability, which is practically impossible when importing from a packaged dependency:
```typescript
import { add } from './@shared' /* or './@shared/utils' or './@shared/utils/math' */;

console.log('Hello from the App!');
console.log(`2 + 3 = ${add(2, 3)}`);
```
We've developed a universal `./setup.cmd` script that downloads dependencies and creates symlinks. In Windows, run it directly (requires administrator privileges for symlinks). For Linux and macOS, execute it via terminal: `sh ./setup.cmd`. You can use any package manager instead (npm, yarn, pnpm) and manage symlinks yourself. We prefer npm for its stability and speed. All monorepo dependencies are stored in the root node_modules, saving disk space but including all projects' dependencies. For smaller deployments, use bundlers or run `npm ci --omit=dev` in the project directory.

## Multi-Framework Support

The monorepo architecture doesn't limit what frameworks you can add, but with the built-in `create-new.cmd` script, you can easily initialize a wide variety of project types and add the generated files to Git:

- Shared module
- Empty Node.js
- Frontend: React, Next.js, Angular, Vue.js, Svelte
- Backend: Express.js, NestJS, Fastify, AdonisJS, FeathersJS
- Mobile: React Native, Expo, NativeScript, Ionic, Capacitor.js
- Desktop: Electron, Tauri, Neutralino.js, Proton Native, Sciter

<img src="./cli/create-new-menu.png" width="640" alt="Project Creation Menu">

Run it on Windows with `create-new.cmd` or on Linux/macOS with `sh ./create-new.cmd`. Each framework comes with properly configured TypeScript, build scripts, and shared module integration. **Note**: On Windows, this script requires administrator privileges to create symbolic links and will prompt for permissions when started - if denied, the script will fail with an error.

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
