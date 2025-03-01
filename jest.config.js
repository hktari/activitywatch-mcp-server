/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  // Only test the TypeScript source files, not the compiled JavaScript
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  // Ignore the dist directory entirely
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  // Silence console output during tests
  setupFilesAfterEnv: ['./jest.setup.js'],
};
