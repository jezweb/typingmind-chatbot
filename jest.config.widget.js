export default {
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost',
    customExportConditions: ['node', 'node-addons'],
  },
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/widget/**/__tests__/**/*.js',
    '**/widget/**/?(*.)+(spec|test).js'
  ],
  setupFilesAfterEnv: ['<rootDir>/widget/test-setup.js'],
  collectCoverageFrom: [
    'widget/src/**/*.js',
    '!widget/src/icons.js',
    '!widget/src/styles.css'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};