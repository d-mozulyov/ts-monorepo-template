import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginVue from 'eslint-plugin-vue';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

/**
 * ESLint configuration for Vue.js project with TypeScript
 */
export default [
  // Basic ESLint rules
  js.configs.recommended,

  // Rules for TypeScript
  ...tseslint.configs.recommended,

  // Rules for Vue
  {
    files: ['**/*.vue'],
    plugins: {
      vue: eslintPluginVue,
    },
    languageOptions: {
      parser: eslintPluginVue.configs.base.parser,
    },
    rules: {
      ...eslintPluginVue.configs['vue3-recommended'].rules,
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/html-self-closing': [
        'error',
        {
          html: {
            void: 'always',
            normal: 'always',
            component: 'always',
          },
        },
      ],
    },
  },

  // Rules for Prettier
  {
    files: ['**/*.js', '**/*.ts', '**/*.vue'],
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },

  // Integration with Prettier
  prettierConfig,

  // Common rules
  {
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    },
  },

  // Ignored files and directories
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', '*.min.js', '*.bundle.js'],
  },
];
