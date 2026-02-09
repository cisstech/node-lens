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
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
]
