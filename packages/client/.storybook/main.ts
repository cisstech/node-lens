import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  stories: [
    '../src/lib/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
    '../src/stories/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
  ],
  addons: [],
  framework: {
    name: '@storybook/web-components-vite',
    options: {
      builder: {
        viteConfigPath: 'vite.config.ts',
      },
    },
  },
  staticDirs: [
  ],
  previewHead: (head) => `${head}
    <style>
      body {
        font-family: var(--nl-font-family-sans);
        font-size: var(--nl-font-size-base);
        line-height: var(--nl-line-height-base);
        background-color: var(--nl-surface-app);
        color: var(--nl-text-primary);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    </style>
  `,
};

export default config

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
