/** Set at build time in vite.config.ts: the commit the build was made from, or '' locally. */
declare const __BUILD_COMMIT__: string;

interface ImportMetaEnv {
  /** Where the design system's Storybook is published. Not a secret; optional. */
  readonly VITE_STORYBOOK_URL?: string;
}
