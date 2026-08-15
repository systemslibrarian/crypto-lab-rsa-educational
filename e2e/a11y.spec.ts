import { expect, test } from '@playwright/test';
import {
  boot,
  driveAllStates,
  expectBaselineNotStale,
  NARROW,
  reportCollected,
  watchPageErrors,
} from './gate';

/**
 * WCAG A/AA regression gate.
 *
 * The lab is driven along everything it teaches, and every step is scanned:
 * the arrival state, which already holds a generated key and its whole
 * downstream output; the skip link focused; the square-and-multiply disclosure
 * opened through its own summary, then switched to the real key exponent and
 * back; the signature verdict flipped INVALID by the tamper toggle, re-signed
 * over a longer message, and flipped back VALID; the three ways Section 3 can
 * fail or empty (a message too large for n, an empty message, and back);
 * the weak key FACTORED, which is the only route to the alarm verdict and to
 * the recovered private key; the real 2048-bit RSA-OAEP comparison, which is the
 * only route to a 64-hex-character run inside a `.codebox__value` scroller;
 * the round trip replayed; both keygen rejection paths (p = q, with the forward
 * link that exists in no other state, and a composite p, which empties the
 * exponent listbox); the smallest key this lab can build (n = 15), which is the
 * only route to the round-trip diagram's integer branch; and a random key
 * nobody chose. All of that in both themes, at 1280px and at 380px.
 *
 * Clipboard permission is granted because `dom.ts`'s copy buttons call
 * `navigator.clipboard?.writeText` with no `.catch()`: without the grant the
 * promise rejects, an unhandled rejection reaches `watchPageErrors`, and the
 * run fails for a reason that has nothing to do with accessibility.
 *
 * See `gate.ts` for why nothing is injected into the page (this lab forks on
 * `matchMedia('(prefers-reduced-motion: reduce)')` in JavaScript, which no style
 * tag can reach), why the one disclosure is opened by clicking it, why the lab's
 * defaults are asserted rather than assumed, and why `violations` is not the
 * whole oracle.
 */

for (const theme of ['dark'] as const) {
  test(`no WCAG A/AA violations in ${theme} theme`, async ({ page, context }) => {
    test.setTimeout(900_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = watchPageErrors(page);
    await boot(page, theme);
    await driveAllStates(page, theme);
    expect(errors, errors.join('\n')).toEqual([]);
    expectBaselineNotStale();
    reportCollected();
  });

  test(`no WCAG A/AA violations in ${theme} theme at 380px`, async ({ page, context }) => {
    test.setTimeout(900_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = watchPageErrors(page);
    await page.setViewportSize(NARROW);
    await boot(page, theme);
    await driveAllStates(page, `${theme} @380px`);
    expect(errors, errors.join('\n')).toEqual([]);
    expectBaselineNotStale();
    reportCollected();
  });
}
