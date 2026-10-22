module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/ui/**/*.tsx', '!src/main.ts'],
  coverageReporters: ['text', 'lcov', 'html'],
  roots: ['<rootDir>'],
};
