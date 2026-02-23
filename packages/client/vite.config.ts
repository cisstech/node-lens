/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import * as path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/client',
  plugins: [
    viteStaticCopy({
      targets: [],
    }),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
    nxViteTsPaths(),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  // Configuration for building your library.
  // See: https://vitejs.dev/guide/build.html#library-mode
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    cssCodeSplit: true,
    rollupOptions: {
      input: ['./index.html', './src/style.css', './src/index.ts'],
      external: [],
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'index' ? 'node-lens.js' : '[name].js';
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.names[0] === 'style.css') {
            return 'node-lens.css';
          }
          return assetInfo.names[0] ?? '';
        },
      },
    },
  },
}))
