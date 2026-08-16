// @ts-check

import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig({
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
    "@typescript-eslint/no-unnecessary-condition": [
      "error",
      {
        allowConstantLoopConditions: true
      }
    ],
    "@typescript-eslint/no-namespace": [
      "error",
      {
        allowDeclarations: true,
        allowDefinitionFiles: false
      }
    ],
    "@typescript-eslint/strict-boolean-expressions": "error",
  }
});
