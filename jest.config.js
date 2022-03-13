module.exports = {
  collectCoverage: true,
  coverageReporters: ['html', 'text-summary'],
  modulePathIgnorePatterns: ['dist'],
  coverageThreshold: {
    global: {
      statements: 93,
      branches: 81,
      functions: 89,
      lines: 92,
    },
  },
};
