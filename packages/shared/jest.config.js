module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: 'coverage',
  verbose: true,
  moduleNameMapper: {
    '^@bytepulse/pulsewave-shared$': '<rootDir>/src/index.ts',
  },
  transformIgnorePatterns: ['/node_modules/'],
};
