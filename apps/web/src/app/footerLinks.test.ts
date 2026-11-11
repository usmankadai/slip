import { describe, expect, it } from 'vitest';
import { STORYBOOK, buildLink, footerLinks } from './footerLinks.ts';

describe('footerLinks', () => {
  it('links to the repository, the design system, the numbers and the journal', () => {
    const links = footerLinks({ commit: '', storybookUrl: '' });
    expect(links.map((link) => link.label)).toEqual([
      'Source code',
      'Design system',
      'Performance numbers',
      'Build journal',
    ]);
    expect(links[1]!.href).toBe(STORYBOOK);
  });

  it('uses another design system address when one is set', () => {
    const links = footerLinks({ commit: '', storybookUrl: 'https://preview.example.com' });
    expect(links[1]!.href).toBe('https://preview.example.com/');
  });

  it('falls back to the published address when the override is not an https URL', () => {
    for (const bad of ['javascript:alert(1)', 'http://example.com', 'not a url', '//x', ' ']) {
      expect(footerLinks({ commit: '', storybookUrl: bad })[1]!.href, bad).toBe(STORYBOOK);
    }
  });
});

describe('buildLink', () => {
  it('links to the commit the build was made from', () => {
    expect(buildLink({ commit: '20b79bc41f0e', storybookUrl: '' })).toEqual({
      label: 'Build 20b79bc',
      href: 'https://github.com/usmankadai/slip/commit/20b79bc41f0e',
    });
  });

  it('is absent for a local build or anything that is not a commit', () => {
    for (const bad of ['', 'dev', '../../x', '20b79bc/../..', 'ABCDEF1']) {
      expect(buildLink({ commit: bad, storybookUrl: '' }), bad).toBeNull();
    }
  });
});
