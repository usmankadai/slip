import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  // Feature stories live beside the feature in the app; the design system's own live here.
  stories: ['../src/**/*.stories.tsx', '../../../apps/web/src/**/*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
};

export default config;
