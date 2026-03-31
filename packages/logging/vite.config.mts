/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import * as path from 'path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/logging',
  plugins: [
    nxViteTsPaths(),
    viteStaticCopy({
      targets: [],
    }),
  ],
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: './src/client/index.ts',
      name: 'logging-plugin',
      formats: ['es'],
      fileName: (format) => (format === 'es' ? 'index.js' : `index.${format}.js`),
    },
    rollupOptions: {
      external: []
    },
  },
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['../..'],
    },
  },
}));
