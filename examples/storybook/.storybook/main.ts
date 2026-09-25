import type { StorybookConfig } from '@storybook/react-vite';

import { viewerChromeCss } from './dtgraph-chrome';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@dtgraph/storybook',
    {
      name: '@deramond.dev/storybook',
      options: { brand: { title: 'dtgraph', url: 'https://julien-deramond.github.io/dtgraph/' } },
    },
  ],
  managerHead: (head) => `${head}\n<style>\n${viewerChromeCss}\n</style>`,
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
