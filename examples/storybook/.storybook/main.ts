import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@dtgraph/storybook',
    {
      name: '@deramond.dev/storybook',
      options: { brand: { title: 'dtgraph', url: 'https://julien-deramond.github.io/dtgraph/' } },
    },
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
