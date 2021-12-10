module.exports = {
  testEnvironment: 'node', // or 'jsdom'
  rootDir: 'src',
  testMatch: ['**/*.spec.{js,jsx,ts,tsx}'],
  coverageDirectory: '../coverage',
  transform: {
    '\\.(js|jsx|ts|tsx)$': [
      '@stagas/sucrase-jest-plugin',
      {
        jsxPragma: 'h',
        jsxFragmentPragma: 'Fragment',
        production: true,
        disableESTransforms: true,
      },
    ],
  },
}
