/** The links in the app footer. Built from build-time values, which are checked before use. */

const REPOSITORY = 'https://github.com/usmankadai/slip';

export interface FooterLink {
  label: string;
  href: string;
}

export interface BuildInfo {
  /** Short commit the build was made from, or '' for a local build. */
  commit: string;
  /** Where the design system's Storybook is published, or '' when it is not. */
  storybookUrl: string;
}

/** An https address, or null. Anything else (another scheme, not a URL) is left out. */
function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function footerLinks(build: BuildInfo): FooterLink[] {
  const links: FooterLink[] = [
    { label: 'Source code', href: REPOSITORY },
    { label: 'Performance numbers', href: `${REPOSITORY}/blob/main/docs/perf.md` },
    { label: 'Build journal', href: `${REPOSITORY}/blob/main/docs/journal.md` },
  ];
  const storybook = httpsUrl(build.storybookUrl);
  if (storybook) links.splice(1, 0, { label: 'Design system', href: storybook });
  return links;
}

/** The build line: a link to the commit when it looks like one, plain words otherwise. */
export function buildLink(build: BuildInfo): FooterLink | null {
  return /^[0-9a-f]{7,40}$/.test(build.commit)
    ? { label: `Build ${build.commit.slice(0, 7)}`, href: `${REPOSITORY}/commit/${build.commit}` }
    : null;
}
