import js from '@eslint/js';
import globals from 'globals';
import typescriptParser from '@typescript-eslint/parser';
import svelteParser from 'svelte-eslint-parser';

export default [
    {
        ignores: ['dist/**/*', 'node_modules/**/*', 'coverage/**/*']
    },
    js.configs.recommended,
    {
        files: ['src/**/*.{js,ts}', '__tests__/**/*.{js,ts}'],
        ignores: ['dist/**/*', 'node_modules/**/*', 'coverage/**/*'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            parser: typescriptParser,
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.node,
                ...globals.vitest
            }
        },
        rules: {
            'no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
            'no-console': 'warn'
        }
    },
    {
        files: ['**/*.svelte'],
        languageOptions: {
            parser: svelteParser,
            parserOptions: {
                parser: typescriptParser
            }
        }
    }
];