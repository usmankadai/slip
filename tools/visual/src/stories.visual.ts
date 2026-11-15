/**
 * One screenshot per story and density. The list of stories is read from the built Storybook,
 * so a new story is covered without touching this file; its first run writes its baseline.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const INDEX = resolve(import.meta.dirname, '../../../packages/ui/storybook-static/index.json');
const index = JSON.parse(readFileSync(INDEX, 'utf8')) as {
  entries: Record<string, { id: string; title: string; name: string; type: string }>;
};
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');

for (const story of stories) {
  test(`${story.title} / ${story.name}`, async ({ page }, info) => {
    const density = info.project.name;
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story&globals=density:${density}`);
    // Attached, not visible: a story drawn in a fixed layer (a dialog, the HUD) leaves the root empty.
    await page.locator('#storybook-root').waitFor({ state: 'attached' });
    // Fonts are self-hosted; wait for them, and for any canvas to be painted.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot(`${story.id}.png`, { fullPage: true });
  });
}
