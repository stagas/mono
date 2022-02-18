const { summaryReporter } = require('@web/test-runner')
const { fromRollup } = require('@web/dev-server-rollup')
const rollupCommonjs = require('@rollup/plugin-commonjs')
const vite = require('vite-web-test-runner-plugin')

const commonjs = fromRollup(rollupCommonjs)

module.exports = {
  concurrency: 1,
  nodeResolve: true,
  files: ['test/**/*.spec.web.{ts,tsx}'],
  plugins: [vite(), commonjs()],
  reporters: [summaryReporter()],
  coverageConfig: {
    include: ['src/**/*.{ts,tsx}'],
  },
  testRunnerHtml: testFramework => `
    <html>
      <head>
        <script type="module" src="${testFramework}"></script>
        <script type="module">import 'jest-browser-globals';</script>
      </head>
    </html>
  `,
}
