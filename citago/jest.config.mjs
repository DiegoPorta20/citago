/**
 * Jest in native ESM mode.
 *
 * NestJS 12 ships as ESM only, so the whole project is ESM and Jest must run
 * with `--experimental-vm-modules` (see the `test` scripts in package.json).
 *
 * Unit tests live next to the code they cover (`*.spec.ts`).
 * End-to-end tests live under test/ with their own configuration.
 *
 * @type {import('jest').Config}
 */
export default {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  // Decorator metadata (class-validator, class-transformer, Nest DI).
  setupFiles: ['reflect-metadata'],
  // ESM imports carry a .js extension that points at a .ts source file.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { useESM: true, tsconfig: '<rootDir>/../tsconfig.json' },
    ],
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  collectCoverageFrom: ['**/*.ts', '!**/*.orm-entity.ts', '!**/*.dto.ts'],
  coverageDirectory: '../coverage',
  clearMocks: true,
};
