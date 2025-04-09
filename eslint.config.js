import globals from "globals";
import tseslint from "typescript-eslint";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// Get current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create FlatCompat instance to support importing legacy presets and plugins
const compat = new FlatCompat({
  recommendedConfig: tseslint.configs.recommended,
  allConfig: tseslint.configs.all,
});

// Setup file patterns for monorepo
const basePatterns = [
  "projects/*/src/**/*.ts",
  "projects/*/src/**/*.tsx",
  // Don't lint files in node_modules and dist
  "!**/node_modules/**",
  "!**/dist/**",
];

export default [
  // Parser options for TypeScript
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./projects/*/tsconfig.json"],
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
  },

  // Apply recommended TypeScript rules
  ...tseslint.configs.recommended,

  // Import plugins via FlatCompat
  ...compat.extends(
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript"
  ),

  // Core rules for all TypeScript files
  {
    files: basePatterns,
    rules: {
      // Basic JavaScript rules
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-unused-vars": "off", // Disabled in favor of @typescript-eslint/no-unused-vars
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "curly": ["error", "all"],
      "quotes": ["error", "single", { avoidEscape: true }],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],

      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "@typescript-eslint/explicit-function-return-type": ["warn", {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
        disallowTypeAnnotations: false,
      }],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": "allow-with-description",
          "minimumDescriptionLength": 3
        },
      ],

      // Import rules
      "import/no-unresolved": "error",
      "import/no-named-as-default": "off", // Turn off the warning about named exports vs default exports
      "import/order": [
        "error",
        {
          "groups": [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index"
          ],
          "newlines-between": "never",
          "alphabetize": {
            "order": "asc",
            "caseInsensitive": true
          }
        }
      ],
      "import/no-duplicates": "error",
    },
  },

  // Special rules for test files
  {
    files: ["projects/*/src/**/*.test.ts", "projects/*/src/**/*.spec.ts"],
    rules: {
      // Relaxed rules for test files
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  // Type checking rules only for TypeScript files
  {
    files: ["projects/*/src/**/*.ts", "projects/*/src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
    },
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./projects/*/tsconfig.json"],
      },
    },
  },

  // Completely ignore certain files
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "**/coverage/**",
    ],
  },
];
