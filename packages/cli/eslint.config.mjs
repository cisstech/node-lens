import baseConfig from '../../eslint.config.mjs'

export default [
  ...baseConfig,
  {
    // `template/` holds plugin scaffolding files that are copied verbatim into a
    // user's project; they are data, not part of the CLI's own source graph.
    ignores: ['template/**'],
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
          // The CLI ships the dashboard so a single install is enough; the server
          // serves it by reading its dist from disk, so nothing imports it here.
          ignoredDependencies: ['@cisstech/node-lens-client'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
]
