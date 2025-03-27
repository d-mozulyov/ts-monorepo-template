#!/usr/bin/env node

/**
 * This script allows creating new projects/modules in the monorepo.
 * It provides an interactive CLI for selecting project types and templates.
 */

const os = require('os');
const readline = require('readline');
const chalk = require('chalk');
const { execSync } = require('child_process');
const { exit } = require('process');
const { createNewProject } = require('./create-new-project');

/**
 * Checks if script is running with administrator privileges on Windows
 * @returns {boolean} True if admin rights are available or not on Windows
 */
function isAdminWindows() {
  if (os.platform() !== 'win32') return true; // Not Windows, assume it has the necessary permissions
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Creates an interactive menu with keyboard navigation
 * @param {string} title - Menu title/prompt
 * @param {string[]} options - Array of menu options
 * @returns {Promise<number>} Index of selected option
 */
function createInteractiveMenu(title, options) {
  let selectedIndex = 0;
  let cursorPosition = 0;

  function renderMenu() {
    // Clear previous menu if any
    if (cursorPosition > 0) {
      process.stdout.write(`\x1B[${cursorPosition}A`); // Move cursor up
      process.stdout.write(`\x1B[J`); // Clear from cursor to end of screen
    }

    // Render the title and navigation hint
    console.log(chalk.bold(title));
    console.log(chalk.italic('Use ↑/↓ arrow keys to navigate and Enter to select'));
    console.log('');

    // Render menu options
    options.forEach((option, index) => {
      if (index === selectedIndex) {
        console.log(chalk.blue(`> ${option}`));
      } else {
        console.log(`  ${option}`);
      }
    });

    // Update cursor position for next render
    cursorPosition = options.length + 3; // title + hint + blank line + options
  }

  return new Promise((resolve) => {
    // Set up terminal to handle input without requiring Enter
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume(); // Ensure stdin is active

    renderMenu();

    // Handle keypress events
    const onKeyPress = (str, key) => {
      if (key.name === 'c' && key.ctrl) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        exit(0);
      } else if (key.name === 'up' && selectedIndex > 0) {
        selectedIndex--;
        renderMenu();
      } else if (key.name === 'down' && selectedIndex < options.length - 1) {
        selectedIndex++;
        renderMenu();
      } else if (key.name === 'return') {
        process.stdin.removeListener('keypress', onKeyPress); // Clean up listener
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(selectedIndex);
      }
    };

    process.stdin.on('keypress', onKeyPress);
  });
}

/**
 * Main function that orchestrates the project creation workflow
 */
async function main() {
  console.log(chalk.bold.green('🚀 Create New Project in Monorepo'));
  console.log('');

  // Check admin rights for Windows
  if (os.platform() === 'win32' && !isAdminWindows()) {
    console.error(chalk.red('Error: This script requires administrator privileges on Windows.'));
    console.error(chalk.yellow('Please run it again as administrator.'));
    exit(1);
  }

  // Primary project category menu
  const projectCategories = [
    'Shared module',
    'Empty Node.js',
    'Frontend: React, Next.js, Angular, Vue.js, Svelte',
    'Backend: Express.js, NestJS, Fastify, AdonisJS, FeathersJS',
    'Mobile: React Native, Expo, NativeScript, Ionic, Capacitor.js',
    'Desktop: Electron, Tauri, Neutralino.js, Proton Native, Sciter',
  ];

  const categoryIndex = await createInteractiveMenu('What would you like to create?', projectCategories);
  const selectedCategory = projectCategories[categoryIndex];

  let selectedProject = null;

  // Secondary menu for selecting specific project
  if (categoryIndex >= 2) { // Not Shared module or Empty Node.js
    let projectOptions = [];

    switch (categoryIndex) {
      case 2: // Frontend
        projectOptions = ['React', 'Next.js', 'Angular', 'Vue.js', 'Svelte'];
        break;
      case 3: // Backend
        projectOptions = ['Express.js', 'NestJS', 'Fastify', 'AdonisJS', 'FeathersJS'];
        break;
      case 4: // Mobile
        projectOptions = ['React Native', 'Expo', 'NativeScript', 'Ionic', 'Capacitor.js'];
        break;
      case 5: // Desktop
        projectOptions = ['Electron', 'Tauri', 'Neutralino.js', 'Proton Native', 'Sciter'];
        break;
    }

    // Add a blank line for visual separation before the second menu
    console.log('');
    const projectIndex = await createInteractiveMenu(`Select ${selectedCategory.split(':')[0]} project:`, projectOptions);
    selectedProject = projectOptions[projectIndex];
  } else {
    selectedProject = selectedCategory;
  }

  // Output the final selection
  console.log('');
  console.log(chalk.green('✅ Selected project type:'), chalk.bold(selectedProject));

  // Create the new project
  await createNewProject(selectedProject);
}

// Execute the main function
main().catch(err => {
  console.error(chalk.red('Error:'), err.message);
  exit(1);
});