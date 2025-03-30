import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    // Set language and environment options
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Define global variables if needed
        console: 'readonly',
        process: 'readonly',
      },
    },
    // Use all recommended rules from the TypeScript ESLint plugin
    plugins: {
      '@typescript-eslint': tseslint,
    },
    // Extend recommended configurations
    rules: {
      ...tseslint.configs['recommended'].rules,
      ...tseslint.configs['recommended-requiring-type-checking'].rules,
      
      // Customize rules as needed
      'no-console': 'warn', // Warn about console statements
      'prefer-const': 'error', // Require const for variables not reassigned
      'no-unused-vars': 'off', // Turn off base rule
      '@typescript-eslint/no-unused-vars': ['error', { // Use TS-specific version
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
      }],
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        'allowExpressions': true,
        'allowTypedFunctionExpressions': true,
      }],
      '@typescript-eslint/no-explicit-any': 'warn', // Discourage using 'any' type
      '@typescript-eslint/no-floating-promises': 'error', // Require promise handling
      '@typescript-eslint/ban-ts-comment': ['warn', {
        'ts-ignore': 'allow-with-description', // Allow with explanation
        'minimumDescriptionLength': 10,
      }],
    },
    // Ignore patterns
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.js',  // Ignore JS files if needed
    ],
  },
  // Add overrides for specific file patterns if needed
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in test files
    },
  },
];
