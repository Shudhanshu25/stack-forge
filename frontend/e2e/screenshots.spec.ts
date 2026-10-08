import { test } from '@playwright/test';
import { mockApi } from './mock-api';

/**
 * Screenshots of the main views in both themes, for review (not part of the check):
 *   SHOT_DIR=../screenshots npx playwright test e2e/screenshots.spec.ts
 */
const OUT = process.env.SHOT_DIR;
const PAGES: [string, string, boolean][] = [
  ['dashboard', '/simulations/sim1', true],
  ['scenarios', '/simulations/sim1/scenarios', true],
  ['analytics', '/simulations/sim1/analytics', true],
  ['analytics-market', '/simulations/sim1/analytics/market', true],
  ['analytics-location', '/simulations/sim1/analytics/location', true],
  ['timeline', '/simulations/sim1/timeline', true],
  ['startups', '/startups', true],
  ['account', '/account', true],
  ['login', '/login', false],
];

test.skip(!OUT, 'set SHOT_DIR to take screenshots');

for (const theme of ['dark', 'light'] as const) {
  test.describe(theme, () => {
    test.use({
      colorScheme: theme,
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });
    for (const [name, path, signedIn] of PAGES) {
      test(name, async ({ page }) => {
        await mockApi(page, { signedIn });
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: `${OUT}/${theme}-${name}.png`, fullPage: true });
      });
    }
    test('command palette', async ({ page }) => {
      await mockApi(page);
      await page.goto('/simulations/sim1');
      await page.waitForLoadState('networkidle');
      await page.keyboard.press('Control+k');
      await page.getByRole('dialog').waitFor();
      await page.screenshot({ path: `${OUT}/${theme}-palette.png` });
    });
  });
}
