// @ts-check

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    "./clang-test-source",
    "./lib",
    "./node_modules",
    "./swift-test-package",
    "./utils",
  ]),
  {
    files: [
      'src/**/*.ts'
    ],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "no-throw-literal": "off", // To enable @typescript-eslint/only-throw-error
      "@typescript-eslint/no-namespace": [
        "error",
        {
          allowDeclarations: true,
          allowDefinitionFiles: false
        }
      ],
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        {
          allowConstantLoopConditions: true
        }
      ],
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/unified-signatures": "off",
    }
  }
);
