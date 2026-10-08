import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mock-api';

/**
 * Accessibility check on the main routes in both themes: axe (WCAG 2.1 A/AA, including colour
 * contrast) at desktop and phone width, no horizontal scrolling on a phone, keyboard
 * reachability and visible focus, and a text alternative for charts. Axe runs with reduced
 * motion so it measures the settled page, not a frame of a fade.
 */
const GUEST = ['/login', '/register', '/forgot-password', '/privacy'];
const SIGNED_IN = [
  '/startups',
  '/startups/new',
  '/simulations/sim1',
  '/simulations/sim1/scenarios',
  '/simulations/sim1/analytics',
  '/simulations/sim1/analytics/customers',
  '/simulations/sim1/analytics/location',
  '/simulations/sim1/timeline',
  '/account',
];
const VIEWPORTS = { desktop: { width: 1280, height: 900 }, phone: { width: 375, height: 812 } };
const THEMES = ['dark', 'light'] as const;

async function open(page: Page, path: string, signedIn: boolean) {
  await mockApi(page, { signedIn });
  await page.goto(path);
  await expect(page.locator('h1').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
}

for (const theme of THEMES) {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`${theme} theme, ${name} (${viewport.width}px)`, () => {
      // The operating system preference picks the theme (no stored choice).
      test.use({ viewport, colorScheme: theme, reducedMotion: 'reduce' });
      for (const path of [...GUEST, ...SIGNED_IN]) {
        test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
          await open(page, path, !GUEST.includes(path));
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await axe(page);
          if (name === 'phone') {
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            );
            expect(overflow, 'page scrolls horizontally at phone width').toBeLessThanOrEqual(1);
          }
        });
      }
    });
  }
}

test.describe('theme and command palette', () => {
  test.use({ colorScheme: 'dark' });

  test('the header toggle overrides the system theme and survives a reload', async ({ page }) => {
    await open(page, '/startups', true);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    // Applied by the blocking head script, before the app renders.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
  });

  test('the command palette runs a command by keyboard alone', async ({ page }) => {
    await open(page, '/simulations/sim1', true);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();
    const search = page.getByRole('combobox', { name: 'Search commands' });
    await expect(search).toBeFocused();
    await page.keyboard.press('Tab'); // focus stays inside
    await expect(search).toBeFocused();
    await page.keyboard.type('timeline');
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/simulations\/sim1\/timeline$/);
  });

  test('the palette closes with Escape and returns focus to its button', async ({ page }) => {
    await open(page, '/startups', true);
    const trigger = page.getByRole('button', { name: /Commands/ });
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('the palette toggles the theme', async ({ page }) => {
    await open(page, '/startups', true);
    await page.keyboard.press('Control+k');
    await page.keyboard.type('light theme');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

for (const theme of THEMES) {
  test(`the password reset code step is accessible (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await open(page, '/forgot-password', false);
    await page.getByLabel('Email').fill('founder@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByRole('heading', { name: 'Enter the code' })).toBeFocused();
    await expect(page.getByLabel('6-digit code')).toHaveAttribute('autocomplete', 'one-time-code');
    await axe(page);
  });
}

for (const theme of THEMES) {
  test(`the wizard's location step and profile card are accessible (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await open(page, '/startups/new', true);
    await page.keyboard.type('Located Co');
    await page.keyboard.press('Enter');
    await page.getByRole('radio', { name: /^SaaS/ }).check();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Where is it based?' })).toBeVisible();
    await page.getByLabel('State or union territory').selectOption('KA');
    await page.getByLabel('City').selectOption('bengaluru');
    await expect(page.getByRole('region', { name: /Location profile: Bengaluru/ })).toBeVisible();
    await expect(page.getByText(/estimate/).first()).toBeVisible();
    await axe(page);
  });
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('motion tokens are zero, so nothing animates', async ({ page }) => {
    await open(page, '/simulations/sim1', true);
    const durations = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      return ['--dur-fast', '--dur', '--dur-slow'].map((t) => parseFloat(css.getPropertyValue(t)));
    });
    expect(durations).toEqual([0, 0, 0]);
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((a) => (a.effect?.getComputedTiming().duration as number) > 0).length,
    );
    expect(running).toBe(0);
  });
});

test('the login form works by keyboard alone, with visible focus', async ({ page }) => {
  await open(page, '/login', false);
  await page.keyboard.press('Tab'); // skip link first
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return {
        label: el.getAttribute('aria-label') ?? el.textContent ?? el.tagName,
        outline: style.outlineStyle,
      };
    });
    expect(info.outline, `no visible focus on ${info.label}`).not.toBe('none');
  }
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.getByLabel('Email').focus();
  await page.keyboard.type('founder@example.com');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Correct-Horse-42');
  await page.keyboard.press('Enter'); // submits: the mock answers 404, shown as an error
  await expect(page.locator('.form-error[role="alert"]')).toBeVisible();
});

test('the decision panel is reachable and labelled by keyboard', async ({ page }) => {
  await open(page, '/simulations/sim1', true);
  for (const label of ['Price (₹)', 'Marketing / month (₹)', 'Employees']) {
    const field = page.getByLabel(label);
    await field.focus();
    await expect(field).toBeFocused();
  }
});

test('charts offer a table alternative', async ({ page }) => {
  await open(page, '/simulations/sim1', true);
  const toggle = page.getByRole('button', { name: /table/i }).first();
  await toggle.click();
  await expect(page.getByRole('table').first()).toBeVisible();
});

test('the creation wizard advances by keyboard alone', async ({ page }) => {
  await open(page, '/startups/new', true);
  const first = await page.locator('h1').first().textContent();
  // Each step focuses its first field, so typing starts straight away.
  await expect(page.locator('form.wizard input').first()).toBeFocused();
  await page.keyboard.type('Keyboard Co');
  await page.keyboard.press('Enter'); // submits the step form: Next
  await expect(page.locator('h1').first()).not.toHaveText(first ?? '');
  await expect(page).toHaveURL(/\/startups\/new/);
});

test('a turn can be played by keyboard alone', async ({ page }) => {
  await open(page, '/simulations/sim1', true);
  const played = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/simulations/sim1/turns'),
  );
  await page.getByLabel('Price (₹)').focus();
  let reached = false;
  for (let i = 0; i < 15 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(
      () => document.activeElement?.textContent?.trim() === 'Play turn',
    );
  }
  expect(reached, 'Play turn is reachable with Tab from the decision fields').toBe(true);
  await page.keyboard.press('Enter');
  await played;
});
