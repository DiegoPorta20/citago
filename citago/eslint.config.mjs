// @ts-check
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
    },
  },

  // ── Architecture boundaries ────────────────────────────────────────────────
  // The domain layer must not know that a framework, an ORM or a transport
  // exists. Enforced by the linter so it cannot erode silently.
  {
    files: ['src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@nestjs/*',
                'typeorm',
                'typeorm/*',
                'mysql2',
                'mysql2/*',
                'axios',
                'express',
                'class-validator',
                'class-transformer',
                '**/infrastructure/**',
                '**/presentation/**',
                '**/application/**',
              ],
              message:
                'The domain layer must not depend on frameworks, ORMs, transports or outer layers.',
            },
          ],
        },
      ],
    },
  },
  // The application layer orchestrates use cases. It may use Nest decorators
  // for dependency injection, but must never reach for persistence details.
  {
    files: ['src/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'typeorm',
                'typeorm/*',
                'mysql2',
                'mysql2/*',
                'express',
                '@nestjs/typeorm',
                '**/infrastructure/**',
                '**/presentation/**',
              ],
              message:
                'The application layer must depend on ports, not on infrastructure or presentation.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      // Fakes implement Promise-returning contracts without awaiting anything;
      // `async` is the clearest way to satisfy the signature.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  // Integration tests exist to compose real adapters with the use cases they
  // serve, so they cross layers on purpose. Unit specs are still bound by the
  // rules above: a domain test that needs TypeORM is a design smell.
  {
    files: ['**/*.int-spec.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
