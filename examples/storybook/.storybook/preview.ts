import type { Preview } from '@storybook/react-vite';

import { viewerTheme } from './dtgraph-theme';

const preview: Preview = {
  // Merged with each story's `dtgraph.tokens`: every Token Graph panel gets the brand canvas.
  parameters: { dtgraph: { theme: viewerTheme } },
};

export default preview;
