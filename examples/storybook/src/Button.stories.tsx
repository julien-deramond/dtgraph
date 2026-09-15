import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button.js';

const meta: Meta<typeof Button> = {
  title: 'Example/Button',
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

/**
 * The `dtgraph` parameter tells the addon which tokens this story uses — open the
 * "Token Graph" panel below to see it rendered.
 */
export const Primary: Story = {
  args: { label: 'Click me' },
  parameters: {
    dtgraph: {
      tokens: {
        color: {
          'button-bg': { $type: 'color', $value: '#3b82f6' },
          'button-text': { $type: 'color', $value: '#ffffff' },
        },
        button: {
          background: { $value: '{color.button-bg}' },
          text: { $value: '{color.button-text}' },
        },
      },
    },
  },
};
