import { describe, expect, it } from 'vitest';
import {
  HOME_VIEW,
  namesPair,
  readUrl,
  sameScreen,
  updateId,
  writeUrl,
  type UrlState,
} from './urlState.ts';

const HASH_A = '3f9c0a1b2c3d'.padEnd(64, '0');
const HASH_B = 'aa11bb22cc33'.padEnd(64, '1');
const facts = {
  a: { sourceHash: HASH_A, projectId: 12 },
  b: { sourceHash: HASH_B, projectId: 12 },
};
const pair = { a: '3f9c0a1b2c3d-p12', b: 'aa11bb22cc33-p12' };

describe('the URL for a view', () => {
  it('names each update by its shortened hash and project', () => {
    expect(updateId(facts.a)).toBe('3f9c0a1b2c3d-p12');
    expect(namesPair({ pair, view: HOME_VIEW }, facts)).toBe(true);
    expect(namesPair({ pair: { ...pair, b: pair.a }, view: HOME_VIEW }, facts)).toBe(false);
    expect(namesPair({ pair: null, view: HOME_VIEW }, facts)).toBe(false);
  });

  it('is empty on the import screen and short on the summary', () => {
    expect(writeUrl({ pair: null, view: HOME_VIEW })).toBe('');
    expect(writeUrl({ pair, view: HOME_VIEW })).toBe('?a=3f9c0a1b2c3d-p12&b=aa11bb22cc33-p12');
  });

  const views: UrlState[] = [
    { pair, view: HOME_VIEW },
    { pair, view: { underneath: 'health', changes: null, trace: null } },
    { pair, view: { underneath: 'health', changes: { kind: null, check: 3 }, trace: null } },
    {
      pair,
      view: { underneath: 'finish', changes: { kind: null, text: 'P01-A001' }, trace: null },
    },
    { pair, view: { underneath: 'summary', changes: { kind: 'added' }, trace: 'MS-COMPLETE' } },
    { pair, view: { underneath: 'log', changes: null, trace: null } },
    {
      pair,
      view: {
        underneath: 'summary',
        changes: { kind: 'dates', sel: 'P01-A001-TRK-1000' },
        trace: null,
      },
    },
    { pair, view: { underneath: 'summary', changes: null, trace: 'P01 A001/TRK#1000' } },
  ];

  it.each(views.map((view) => [writeUrl(view), view]))('reads %s back as written', (url, view) => {
    expect(readUrl(url)).toEqual(view);
  });
});

describe('a URL that was typed, cut short or tampered with', () => {
  const base = '?a=3f9c0a1b2c3d-p12&b=aa11bb22cc33-p12';

  it('opens the import screen when either update is missing or malformed', () => {
    for (const url of [
      '',
      '?a=3f9c0a1b2c3d-p12',
      '?a=3f9c0a1b2c3d&b=aa11bb22cc33-p12',
      '?a=3F9C0A1B2C3D-p12&b=aa11bb22cc33-p12',
      '?a=../../etc&b=aa11bb22cc33-p12',
      '?s=health&c=all&t=MS-COMPLETE',
    ]) {
      expect(readUrl(url)).toEqual({ pair: null, view: HOME_VIEW });
    }
  });

  it('drops a screen, kind or check it does not know', () => {
    expect(readUrl(`${base}&s=admin`).view.underneath).toBe('summary');
    expect(readUrl(`${base}&c=everything-else`).view.changes).toBeNull();
    expect(readUrl(`${base}&c=all&check=15`).view.changes).toEqual({ kind: 'all' });
    expect(readUrl(`${base}&c=all&check=1.5`).view.changes).toEqual({ kind: 'all' });
    expect(readUrl(`${base}&check=3`).view.changes).toBeNull();
  });

  it('drops a selection that is not a code, or has no grid to be in', () => {
    expect(readUrl(`${base}&c=all&sel=${'x'.repeat(61)}`).view.changes).toEqual({ kind: 'all' });
    expect(readUrl(`${base}&c=all&sel=${encodeURIComponent('a\tb')}`).view.changes).toEqual({
      kind: 'all',
    });
    expect(readUrl(`${base}&sel=P01`).view.changes).toBeNull();
  });

  it('treats a new selection as the same screen, so it replaces the history step', () => {
    const grid = { underneath: 'summary' as const, changes: { kind: null }, trace: null };
    expect(sameScreen(grid, { ...grid, changes: { kind: null, sel: 'A' } })).toBe(true);
    expect(sameScreen(grid, { ...grid, trace: 'A' })).toBe(false);
  });

  it('drops a trace code that is too long or not printable', () => {
    expect(readUrl(`${base}&t=${'x'.repeat(61)}`).view.trace).toBeNull();
    expect(readUrl(`${base}&t=${encodeURIComponent('<script>\n')}`).view.trace).toBeNull();
    expect(readUrl(`${base}&t=`).view.trace).toBeNull();
  });

  it('keeps only an activity code to find, never longer text', () => {
    expect(readUrl(`${base}&c=all&q=P01-A001`).view.changes).toEqual({
      kind: 'all',
      text: 'P01-A001',
    });
    expect(readUrl(`${base}&c=all&q=${'x'.repeat(61)}`).view.changes).toEqual({ kind: 'all' });
    expect(readUrl(`${base}&c=all&q=${encodeURIComponent('a\nb')}`).view.changes).toEqual({
      kind: 'all',
    });
  });
});
