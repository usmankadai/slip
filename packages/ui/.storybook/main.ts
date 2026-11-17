import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  // Feature stories live beside the feature in the app; the design system's own live here.
  stories: ['../src/**/*.stories.tsx', '../../../apps/web/src/**/*.stories.tsx'],
  // The design drawings, served as they are so the Design process pages can show them.
  staticDirs: [{ from: '../../../docs/design', to: '/design' }],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
};

export default config;
