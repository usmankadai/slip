/** Grid density (exploration 06). Compact is the default. */
export type Density = 'compact' | 'comfortable';

/**
 * Row height in pixels for each density. Windowing needs the number, not the CSS
 * variable; a test keeps these equal to `--row-height` in tokens.css.
 */
export const ROW_HEIGHT: Record<Density, number> = { compact: 24, comfortable: 32 };
