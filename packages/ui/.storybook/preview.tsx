import type { Preview } from '@storybook/react-vite';
import '../src/fonts.css';
import '../src/tokens.css';
import '../src/base.css';

const preview: Preview = {
  globalTypes: {
    density: {
      description: 'Grid density',
      toolbar: {
        title: 'Density',
        items: [
          { value: 'compact', title: 'Compact' },
          { value: 'comfortable', title: 'Comfortable' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { density: 'compact' },
  decorators: [
    (Story, context) => (
      <div data-density={context.globals.density as string}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'padded',
    options: {
      storySort: {
        order: ['Foundations', ['Colour', 'Slip scale', 'Type', 'Density', 'Space and shape']],
      },
    },
  },
};

export default preview;
