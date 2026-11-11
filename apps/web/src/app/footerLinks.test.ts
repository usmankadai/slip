import { describe, expect, it } from 'vitest';
import { buildLink, footerLinks } from './footerLinks.ts';

describe('footerLinks', () => {
  it('links to the repository, the numbers and the journal', () => {
    const labels = footerLinks({ commit: '', storybookUrl: '' }).map((link) => link.label);
    expect(labels).toEqual(['Source code', 'Performance numbers', 'Build journal']);
  });

  it('adds the design system when its address is set', () => {
    const links = footerLinks({ commit: '', storybookUrl: 'https://slip-storybook.vercel.app' });
    expect(links[1]).toEqual({
      label: 'Design system',
      href: 'https://slip-storybook.vercel.app/',
    });
  });

  it('leaves out a design system address that is not an https URL', () => {
    for (const bad of ['javascript:alert(1)', 'http://example.com', 'not a url', '//x', ' ']) {
      const labels = footerLinks({ commit: '', storybookUrl: bad }).map((link) => link.label);
      expect(labels, bad).not.toContain('Design system');
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
