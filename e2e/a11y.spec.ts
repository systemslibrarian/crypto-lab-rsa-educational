import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * WCAG regression gate. Deploys are already gated on the RSA unit tests; this
 * gates them on accessibility the same way. Scans the full page with every
 * <details> expanded and every interactive demo driven, in both themes.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Neutralize animations/transitions so a scan never races a mid-transition frame. */
async function killMotion(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}`,
  });
}

async function openAllDetails(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const details of document.querySelectorAll('details')) {
      details.open = true;
    }
  });
}

/**
 * Drive every interactive demo so axe scans the rendered output, not just the
 * empty scaffolding: factor the weak key, tamper the signature, and run the
 * real OAEP comparison (which generates a 2048-bit WebCrypto key).
 */
async function driveDemos(page: Page): Promise<void> {
  // Section 5 — factor the small key (renders the "KEY BROKEN" output).
  const factor = page.getByRole('button', { name: /Factor it!/i });
  if (await factor.count()) {
    await factor.first().click();
    await expect(page.locator('.verdict.alarm')).toBeVisible();
  }

  // Section 4 — tamper toggle flips the verdict to INVALID.
  const tamper = page.locator('#sv-tamper');
  if (await tamper.count()) {
    await tamper.check();
    await expect(page.locator('.verdict.bad').first()).toBeVisible();
  }

  // Section 6 — run the real OAEP comparison (async: generates a 2048-bit key).
  const oaep = page.getByRole('button', { name: /Run the real OAEP comparison/i });
  if (await oaep.count()) {
    await oaep.first().click();
    await expect(page.locator('.oaep-block')).toBeVisible({ timeout: 30_000 });
  }
}

async function prep(page: Page): Promise<void> {
  await killMotion(page);
  await driveDemos(page);
  await openAllDetails(page);
}

async function scan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

test('no WCAG A/AA violations in dark theme', async ({ page }) => {
  await page.goto('.');
  await prep(page);
  await scan(page);
});

test('no WCAG A/AA violations in light theme', async ({ page }) => {
  await page.goto('.');
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await prep(page);
  await scan(page);
});
