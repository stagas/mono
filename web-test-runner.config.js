// eslint-disable-next-line @typescript-eslint/no-var-requires
const { esbuildPlugin } = require('@web/dev-server-esbuild')

module.exports = {
  nodeResolve: true,
  files: ['src/**/*.spec.{ts,tsx}'],
  plugins: [
    esbuildPlugin({
      ts: true,
      tsx: true,
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
    }),
  ],
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
