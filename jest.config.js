/** @type {import('jest').Config} */
export default {
  // Use ts-jest for TypeScript files
  preset: 'ts-jest/presets/default-esm',

  // Test environment
  testEnvironment: 'node',

  // Run tests serially to avoid credential file race conditions
  // Tests that manipulate shared state (credentials.json) need serial execution
  maxWorkers: 1,

  // ESM support
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  // Module name mapping for ESM
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Transform configuration for ts-jest
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
      },
    ],
  },

  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.test.tsx',
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Coverage thresholds (starting low, increase over time)
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 5,
      lines: 5,
      statements: 5,
    },
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/lib/**/*.tsx',
    '!src/lib/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output
  verbose: true,

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
