/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'ES2022',
        module: 'CommonJS',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true
      }
    }]
  },
  // uuid v9+ ships ESM only; tell Jest to transform it
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid)/)',
  ],
  // Map .js imports to TypeScript source (CommonJS + ts-jest compatibility)
  moduleNameMapper: {
    '^(\.{1,2}/.*)\.js$': '$1'
  },
  collectCoverageFrom: ['src/**/*.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json']
};
