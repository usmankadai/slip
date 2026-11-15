import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import plugin, { isRawColour, isRawSpacing, isSpacingProperty } from '../src/index.ts';

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser as never,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

describe('no-raw-color', () => {
  it('runs', () => {
    tester.run('no-raw-color', plugin.rules['no-raw-color'], {
      valid: [
        { code: "const c = 'var(--text-primary)';", filename: 'x.tsx' },
        // Activity codes are cited as #CODE; a code is not a colour unless it is all hex.
        { code: "const s = 'Caused by #P03-A002-ENB-0110.';", filename: 'x.tsx' },
        { code: 'const s = `#${code}`;', filename: 'x.tsx' },
        { code: "const s = 'Issue #12';", filename: 'x.tsx' },
      ],
      invalid: [
        { code: "const c = '#1c1b18';", errors: [{ messageId: 'raw' }], filename: 'x.tsx' },
        { code: "const c = '#FFF';", errors: [{ messageId: 'raw' }], filename: 'x.tsx' },
        {
          code: "const s = { color: 'rgb(0 0 0)' };",
          errors: [{ messageId: 'raw' }],
          filename: 'x.tsx',
        },
        {
          code: 'const s = `hsl(${h} 50% 50%)`;',
          errors: [{ messageId: 'raw' }],
          filename: 'x.tsx',
        },
        {
          code: "const s = <div style={{ background: 'oklch(70% 0.1 200)' }} />;",
          errors: [{ messageId: 'raw' }],
          filename: 'x.tsx',
        },
      ],
    });
  });
});

describe('no-raw-spacing', () => {
  it('runs', () => {
    tester.run('no-raw-spacing', plugin.rules['no-raw-spacing'], {
      valid: [
        { code: "const a = <div style={{ padding: 'var(--space-2)' }} />;", filename: 'x.tsx' },
        { code: 'const a = <div style={{ margin: 0 }} />;', filename: 'x.tsx' },
        // Widths and positions are layout, not spacing: they are often computed from data.
        { code: 'const a = <div style={{ width: 120, top: rowHeight }} />;', filename: 'x.tsx' },
        // Only style attributes are checked; other objects can hold anything.
        { code: 'const a = { padding: 12 };', filename: 'x.tsx' },
      ],
      invalid: [
        {
          code: 'const a = <div style={{ padding: 16 }} />;',
          errors: [{ messageId: 'raw' }],
          filename: 'x.tsx',
        },
        {
          code: "const a = <div style={{ marginTop: '8px' }} />;",
          errors: [{ messageId: 'raw' }],
          filename: 'x.tsx',
        },
        {
          code: "const a = <div style={{ gap: '4px 8px' }} />;",
          errors: [{ messageId: 'raw' }],
          filename: 'x.tsx',
        },
        {
          code: 'const a = <div style={{ columnGap: `${n}px` }} />;',
          errors: [{ messageId: 'raw' }],
          filename: 'x.tsx',
        },
      ],
    });
  });
});

describe('helpers', () => {
  it('tells colours from things that look like them', () => {
    expect(isRawColour('#abc')).toBe(true);
    expect(isRawColour('#abcd12')).toBe(true);
    expect(isRawColour('#A001')).toBe(true);
    expect(isRawColour('#A001-B')).toBe(false);
    expect(isRawColour('#12345')).toBe(false);
  });

  it('knows which properties are spacing and which values are raw', () => {
    expect(isSpacingProperty('paddingInlineStart')).toBe(true);
    expect(isSpacingProperty('width')).toBe(false);
    expect(isRawSpacing(0)).toBe(false);
    expect(isRawSpacing('calc(var(--space-2) + 1px)')).toBe(true);
    expect(isRawSpacing('var(--space-2)')).toBe(false);
  });
});
