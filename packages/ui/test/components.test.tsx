import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Button,
  DeltaCell,
  Notice,
  ProgressBar,
  SegmentedControl,
  Skeleton,
  barLength,
  formatDelta,
} from '../src/index.ts';

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

describe('DeltaCell', () => {
  it('writes a signed number of working days with a unit', () => {
    expect(formatDelta(67)).toBe('+67d');
    expect(formatDelta(-10)).toBe('−10d');
    expect(formatDelta(2.5)).toBe('+2.5d');
    expect(formatDelta(1250)).toBe('+1,250d');
    expect(formatDelta(0)).toBe('0d');
    expect(formatDelta(-0.04)).toBe('0d');
  });

  it('keeps the bar on a fixed scale that is full at 40 working days', () => {
    expect(barLength(40)).toBe(50);
    expect(barLength(67)).toBe(50);
    expect(barLength(-400)).toBe(50);
    expect(barLength(10)).toBe(25);
    expect(barLength(0)).toBe(0);
  });

  it('draws later to the right of the centre and earlier to the left', () => {
    expect(renderToStaticMarkup(<DeltaCell days={10} />)).toContain('x="50" y="1" width="25"');
    expect(renderToStaticMarkup(<DeltaCell days={-10} />)).toContain('x="25" y="1" width="25"');
  });

  it('shows the number as text and hides the bar from assistive technology', () => {
    const html = renderToStaticMarkup(<DeltaCell days={67} />);
    expect(html).toContain('>+67d</span>');
    expect(html).toContain('aria-hidden="true"');
  });

  it('is empty when there is nothing to compare, or the value is not a number', () => {
    for (const days of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const html = renderToStaticMarkup(<DeltaCell days={days} />);
      expect(html).not.toContain('<svg');
      expect(html).not.toContain('d</span>');
    }
  });

  it('draws no bar for no move', () => {
    expect(renderToStaticMarkup(<DeltaCell days={0} />)).not.toContain('y="1"');
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive technology', () => {
    expect(renderToStaticMarkup(<Skeleton />)).toContain('aria-hidden="true"');
  });
});

describe('SegmentedControl', () => {
  it('marks exactly one option as pressed and names the group', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        label="Density"
        value="comfortable"
        onChange={() => {}}
        options={[
          { value: 'compact', label: 'Compact' },
          { value: 'comfortable', label: 'Comfortable' },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Density"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Comfortable/);
  });
});
