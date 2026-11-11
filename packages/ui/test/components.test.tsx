import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, Notice, ProgressBar } from '../src/index.ts';

describe('Button', () => {
  it('is a button that does not submit a form by default', () => {
    expect(renderToStaticMarkup(<Button>Compare updates</Button>)).toMatch(
      /^<button type="button"[^>]*>Compare updates<\/button>$/,
    );
  });

  it('passes disabled through', () => {
    expect(renderToStaticMarkup(<Button disabled>Compare updates</Button>)).toContain('disabled');
  });
});

describe('ProgressBar', () => {
  it('ties the label to the bar and clamps the value', () => {
    const html = renderToStaticMarkup(
      <ProgressBar value={120} max={84} label="Reading: 84 of 84 MB" />,
    );
    expect(html).toContain('value="84"');
    expect(html).toContain('max="84"');
    const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });

  it('is indeterminate when no value is given', () => {
    expect(renderToStaticMarkup(<ProgressBar label="Generating a sample pair" />)).not.toContain(
      'value=',
    );
  });
});

describe('Notice', () => {
  it('is a status by default and an alert when it needs attention', () => {
    expect(renderToStaticMarkup(<Notice>Same project.</Notice>)).toContain('role="status"');
    expect(renderToStaticMarkup(<Notice tone="attention">Wrong order.</Notice>)).toContain(
      'role="alert"',
    );
  });

  it('renders text as text, never as markup', () => {
    expect(renderToStaticMarkup(<Notice>{'<img src=x onerror=alert(1)>'}</Notice>)).toContain(
      '&lt;img',
    );
  });
});
