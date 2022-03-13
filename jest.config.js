module.exports = {
  collectCoverage: true,
  coverageReporters: ['html', 'text-summary'],
  modulePathIgnorePatterns: ['dist'],
  coverageThreshold: {
    global: {
      statements: 94,
      branches: 84,
      functions: 92,
      lines: 93,
    },
  },
};
