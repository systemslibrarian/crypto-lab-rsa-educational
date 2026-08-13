import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';
import { auditNonText } from './nontext';
import { NONTEXT_BASELINE } from './nontext-baseline';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Shared machinery for the WCAG gate on the Educational RSA lab.
 *
 * It replaces two specs, and what each of them did wrong is the reason this
 * file is shaped the way it is.
 *
 *  1. `a11y.spec.ts` INJECTED A STYLE TAG. `killMotion()` pushed
 *     `animation:none !important; transition:none !important` into the page
 *     before every scan. That BYPASSED this stylesheet's own
 *     `@media (prefers-reduced-motion: reduce)` block instead of exercising it,
 *     and on this page the preference does work no injection can reproduce:
 *     `round-trip.ts`'s `animate()` reads
 *     `matchMedia('(prefers-reduced-motion: reduce)')` in JavaScript and takes a
 *     completely different code path, drawing the two clock chords instantly at
 *     `stroke-dashoffset: 0` rather than transitioning them from `len` to `0`.
 *     A style tag cannot reach that branch — it is a JS fork, not a CSS one — so
 *     the old gate scanned the ANIMATED page every time and never once measured
 *     the rendering a reduced-motion reader gets. `boot` asks for the preference
 *     and asserts it took effect; `expectChordsDrawn` then asserts the branch it
 *     selects leaves the diagram DRAWN, which is the failure mode where
 *     cancelling an animation strands an element at its start value.
 *
 *  2. IT FORCE-OPENED THE DISCLOSURE FROM SCRIPT. `openAllDetails()` set
 *     `details.open = true` on every `<details>`. This lab has exactly one — the
 *     square-and-multiply trace in Section 3 — and it is the single largest
 *     block of generated markup on the page. Here it is opened by clicking its
 *     `<summary>`, the route a reader has.
 *
 *  3. IT GUARDED EVERY DRIVE STEP WITH `if (await btn.count())`. A control that
 *     disappeared would have SKIPPED SILENTLY instead of failing, and the scan
 *     that followed would have reported green for a page missing an exhibit.
 *     Nothing here is optional: every locator is asserted.
 *
 *  4. IT SCANNED TWICE, AT ONE VIEWPORT, AFTER THE WHOLE DRIVE. Three clicks
 *     were made and then one scan ran, so the two intermediate states were
 *     overwritten before anything measured them, and every ERROR state — the
 *     repeated prime, the composite prime, the out-of-range message — plus the
 *     entire 380px column had never been scanned at all. This drive scans after
 *     every single step, in {dark, light} x {1280, 380}.
 *
 *  5. `violations` IS NOT THE WHOLE ORACLE. See `scan`. On this page in
 *     particular, every verdict surface is an `rgba()` tint and every accent
 *     wash is a `color-mix(in oklab, ...)`, both of which axe files under
 *     `incomplete` rather than deciding.
 *
 *  6. `border.spec.ts` WAS A SELF-CONFIRMING 1.4.11 CHECK, and it has been
 *     DELETED rather than repaired. It measured border-vs-background on
 *     `input:not([type="checkbox"]), select` — which is precisely and only the
 *     selector list `style.css` applies its `--control-border` token to. It
 *     asserted 3:1 over the one rule that already kept it, while every `.btn`
 *     and every `.codebox__copy` on the page drew its edge from
 *     `--border-color`, the surface divider the panels are outlined with, and
 *     was never measured against anything. `nontext.ts` strictly supersedes it:
 *     same specification, applied to every control (plus links styled as
 *     buttons, `role=button`, and outlines), with the composite model this gate
 *     uses everywhere else.
 */

/**
 * Wait for every running animation and transition to drain.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' }
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels that animation without restoring its end state — the element then
 * renders at `opacity: 0` for every reader with the preference set.
 *
 * This stylesheet declares `opacity` exactly three times (`.cl-hero-sub` .85,
 * `.btn:disabled` .5, `.sam-bit.zero` .6) and none of them is zero, and its one
 * `@keyframes` (`pulse`) animates `box-shadow` only. So the OPACITY form of the
 * defect cannot currently exist here, and this assertion is what makes that a
 * measurement rather than a reading. The STROKE form of it can — see
 * `expectChordsDrawn`, which covers the clock chords this check structurally
 * cannot see.
 *
 * `aria-hidden` subtrees are excluded, matching axe. What this lab hides is
 * enumerated in `contrast.ts`; the only member carrying characters is
 * `.sam-bits`, which `scan` measures explicitly.
 */
async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  expect(invisible, `no visible text may render at opacity 0 in state: ${label}`).toEqual([]);
}

/**
 * The reduced-motion end state of the mod-n clock, which no generic oracle can
 * see.
 *
 * `round-trip.ts`'s `animate()` forks on
 * `matchMedia('(prefers-reduced-motion: reduce)')`. Under the preference it
 * sets `strokeDasharray = len` and `strokeDashoffset = 0` and returns; without
 * it, it sets `strokeDashoffset = len` — which draws NOTHING — and schedules a
 * `setTimeout` that adds a `stroke-dashoffset .8s ease` transition back to 0.
 *
 * That fork is exactly the shape of the defect this whole sweep exists to
 * catch: an element whose only route to its visible state runs through an
 * animation. If the reduced-motion branch ever stops writing the `0`, the two
 * chords — the encrypt hop and the decrypt hop, which are the entire point of
 * the figure — stay invisible forever for every reader with the preference set.
 * `expectNotBlank` cannot see it (nothing is at `opacity: 0`, and a `<line>`
 * owns no text node), and neither can axe.
 *
 * Both halves are asserted:
 *  - `stroke-dashoffset` is `0px`, so the chord is fully drawn; and
 *  - no inline `transition` was ever written, which is only true on the
 *    reduced-motion branch. Without that second half the check would pass on the
 *    animated page too, since a settled transition also ends at 0 — and a check
 *    that passes in the configuration it is meant to distinguish is not a check.
 */
async function expectChordsDrawn(page: Page, label: string): Promise<void> {
  const chords = await page.$$eval('.clock-chord', (els) =>
    els.map((e) => ({
      sel: e.getAttribute('class') ?? '',
      offset: getComputedStyle(e).strokeDashoffset,
      inlineTransition: (e as SVGElement).style.transition,
    }))
  );
  expect(chords.length, `both clock chords must exist in state: ${label}`).toBe(2);
  expect(
    chords.filter((c) => c.offset !== '0px' || c.inlineTransition !== ''),
    `clock chords must be drawn by the reduced-motion branch, not by a transition, in state: ${label}`
  ).toEqual([]);
}

/**
 * An explicit `role` on a `<ul>`/`<ol>` REPLACES its implicit `list` role and
 * orphans every `<li>` inside it (axe then fires `listitem` once per child).
 *
 * This is checked at RUNTIME rather than by grep because this lab builds its
 * DOM with `dom.ts`'s `el()` helper, which takes attributes as an object — a
 * `role: 'group'` sitting in a property bag next to nothing that says `<ul>`.
 * A markup regex structurally cannot see that. The page has one list, the
 * `.related-list` in the footer panel, and it is built exactly that way.
 */
async function expectListSemantics(page: Page, label: string): Promise<void> {
  const broken = await page.$$eval('ul[role], ol[role]', (els) =>
    els
      .filter((e) => e.getAttribute('role') !== 'list')
      .map(
        (e) =>
          `${e.tagName.toLowerCase()}[role=${e.getAttribute('role')}] with ${e.children.length} children`
      )
  );
  expect(
    broken,
    `an explicit role on a list deletes its list semantics, in state: ${label}`
  ).toEqual([]);
}

/**
 * Uncaught page errors and console errors, collected from the moment the page
 * is created. A renderer that throws halfway through leaves an earlier state on
 * screen, and a gate that scans that state reports green for a page that is
 * broken. Attach before `boot`, assert after the drive.
 */
export function watchPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

/**
 * Exactly one banner landmark: the shared bar.
 *
 * This lab's own hero is a `<header class="cl-hero">` that `main.ts` appends
 * INSIDE `<main id="app">`, which scopes it out of the banner role on its own —
 * and `index.html`'s `dedupeBanner()` skips it for that reason
 * (`el.closest('main, ...')` returns early). Asserting the OUTCOME rather than
 * either mechanism means a change to the nesting is caught too.
 */
export async function assertSingleBanner(page: Page): Promise<void> {
  const banners = await page.evaluate(() => {
    const scoped = new Set(['MAIN', 'ARTICLE', 'ASIDE', 'NAV', 'SECTION']);
    const isBanner = (el: Element): boolean => {
      if (el.getAttribute('role') === 'banner') return true;
      if (el.tagName !== 'HEADER') return false;
      if (el.getAttribute('role')) return false; // explicit non-banner role wins
      for (let p = el.parentElement; p; p = p.parentElement) if (scoped.has(p.tagName)) return false;
      return true;
    };
    return [...document.querySelectorAll('header,[role="banner"]')].filter(isBanner).length;
  });
  expect(banners, 'exactly one banner landmark').toBe(1);
}

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert the content every scan relies on is really on the page — including the
 * lab's DEFAULTS, which are never assumed.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1, so
 * the emulation is applied imperatively BEFORE the navigation and then
 * *asserted* from inside the page. It has to be before `goto` here for a reason
 * specific to this lab: `round-trip.ts` reads the preference ONCE, inside a
 * `requestAnimationFrame` scheduled while the panel is being built, so an
 * emulation applied after navigation would arrive too late to change the branch
 * taken and the gate would silently measure the animated page.
 *
 * The theme is seeded through `localStorage` rather than by clicking the toggle,
 * which pins down a real failure mode: `index.html`'s anti-flash script reads
 * `localStorage.getItem('theme')` and the shared header's toggle writes
 * `localStorage.setItem('theme', ...)`. If those keys drift apart the theme
 * silently stops persisting, and this boot fails on `data-theme` rather than
 * quietly scanning dark twice.
 *
 * THE DEFAULTS ARE ASSERTED AT LENGTH because this lab ships FULL, not empty:
 * `keygenPanel()` calls `build()` during mount, `setKey` fires every subscriber,
 * and so the arrival state already has a valid keypair, a rendered derivation
 * trace, a ciphertext, a round-trip diagram, a signed message with a VALID
 * verdict, a malleability forgery and a deterministic-ciphertext verdict on
 * screen. Which half of each fork is showing at first paint decides which half
 * a single-configuration gate would ever have measured, so every one of them is
 * written down here.
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  // A click on a control that never becomes actionable otherwise burns the whole
  // test timeout and reports nothing useful. 20s turns that silent hang into a
  // named failure naming the locator.
  page.setDefaultTimeout(20_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await page.goto('.');
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect'
  ).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await assertSingleBanner(page);

  // Every panel is mounted by `src/main.ts`, so a navigation that resolves
  // proves nothing. Seven sections, in curriculum order.
  for (const id of ['overview', 'keygen', 'encrypt', 'roundtrip', 'sign', 'breaks', 'realworld', 'related']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }

  // ── Section 2 defaults: a valid 16-bit key, generated during mount ────────
  await expect(page.locator('#kg-p')).toHaveValue('257');
  await expect(page.locator('#kg-q')).toHaveValue('263');
  await expect(page.locator('#kg-e')).toHaveValue('17');
  await expect(page.locator('#keygen .status')).toHaveClass(/\bok\b/);
  await expect(page.locator('#keygen .status')).toContainText('valid keypair generated');
  await expect(page.locator('#keygen .step')).toHaveCount(7);

  // ── Section 3 defaults: "Hi", encrypted, with the no-padding warning up ──
  await expect(page.locator('#ed-msg')).toHaveValue('Hi');
  await expect(page.locator('#encrypt .status')).toHaveClass(/\bwarn\b/);
  await expect(page.locator('#encrypt .io-row')).toHaveCount(3);
  await expect(page.locator('#encrypt .enc-chip')).toHaveCount(2);

  // ── Section 3.5 defaults: the round trip closes, so the two end nodes are
  //    `.ok` rather than `.bad`. Which one is showing is exactly the sort of
  //    default a one-configuration gate silently picks for you.
  await expect(page.locator('#roundtrip .flow-node.ok')).toHaveCount(2);
  await expect(page.locator('#roundtrip .flow-node.bad')).toHaveCount(0);

  // ── Section 4 defaults: tamper OFF, so the signature VERIFIES ────────────
  await expect(page.locator('#sv-msg')).toHaveValue('transfer $100');
  await expect(page.locator('#sv-tamper')).not.toBeChecked();
  await expect(page.locator('#sign .verdict.good')).toBeVisible();
  await expect(page.locator('#sign .verdict.bad')).toHaveCount(0);

  // ── Section 5 defaults: nothing factored yet; the 2048-bit card ships with
  //    its button DISABLED and its verdict already green.
  await expect(page.locator('#breaks .break-out')).toBeEmpty();
  await expect(page.locator('#breaks .verdict.alarm')).toHaveCount(0);
  await expect(page.locator('#breaks .scale-card.strong button')).toBeDisabled();
  await expect(page.locator('#breaks .scale-card.strong .verdict.good')).toBeVisible();

  // ── Section 6 defaults: the textbook determinism verdict is already on
  //    screen (it is synchronous); the OAEP block is NOT, because it needs a
  //    2048-bit WebCrypto key that only the button generates.
  await expect(page.locator('#realworld .verdict.bad').first()).toBeVisible();
  await expect(page.locator('.oaep-block')).toHaveCount(0);
  await expect(page.locator('#realworld .status')).toBeEmpty();

  // The one disclosure on the page, shut.
  await expect(page.locator('details.trace')).toHaveCount(1);
  await expect(page.locator('details[open]')).toHaveCount(0);

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this at all. The shapes on this
 * page that break it are the wide ones: the `.flow` round-trip diagram, the
 * `.clock-wrap` two-column grid, the `.sam-row` four-column grid, the `.step`
 * two-column grid, and every `.codebox__value` — a `white-space: nowrap` run
 * holding a full ciphertext, signature or 64-hex-char OAEP block. Each is meant
 * to reflow or to scroll inside its own box; the assertion here is that none of
 * them scrolls the DOCUMENT.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return null;

    // Only elements that actually push the DOCUMENT sideways are culprits. A
    // wide box inside an `overflow-x: auto` wrapper has a huge bounding rect but
    // is clipped by its scroller and contributes nothing to the document's
    // scroll width — naming it sends you off fixing the wrong element. Every
    // `.codebox__value` on this page is exactly that decoy.
    const clipped = (el: Element): boolean => {
      let n = el.parentElement;
      while (n && n !== doc) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        n = n.parentElement;
      }
      return false;
    };

    const over = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .sort((a, b) => b.r.right - a.r.right);
    const widest = over.filter((x) => !clipped(x.el))[0] ?? over[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${clipped(widest.el) ? '[clipped] ' : ''}${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + widest.el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  expect(overflow, `page must not scroll horizontally in state: ${label}`).toBeNull();
}

/**
 * Every scrolling container must be operable from the keyboard (WCAG 2.1.1). If
 * it holds no focusable content it needs `tabindex="0"`, so it becomes a focus
 * target arrow keys can then scroll.
 *
 * This is a live question on this page rather than a formality. `.codebox__value`
 * is `overflow-x: auto; white-space: nowrap`, it is a `<code>` element with no
 * focusable content of its own (the Copy button is its SIBLING, not its child),
 * and it holds every value the lab generates. At 380px it overflows for almost
 * all of them.
 */
export async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
          ` (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`
      );
  });
  expect(
    Array.from(new Set(unreachable)),
    `scrolling regions with no keyboard route in state: ${label}`
  ).toEqual([]);
}

/**
 * Anything made focusable must show WHERE the focus is (WCAG 2.4.7).
 *
 * This exists because the fix for the 2.1.1 finding above CREATES this risk:
 * giving `.codebox__value` a `tabindex` puts it in the tab order, and a tab stop
 * with no visible indicator is a new defect introduced by the previous fix —
 * which is exactly what happened elsewhere in this sweep, seven regions at once.
 *
 * PRIMING IS LOAD-BEARING. Chromium only matches `:focus-visible` on a
 * programmatic `focus()` when the last user interaction was via the KEYBOARD.
 * Without a real `page.keyboard.press('Tab')` first, every element probed here
 * reports no indicator and the check invents one phantom defect per region. So
 * the active element is blurred, one real Tab is pressed to put the browser in
 * keyboard modality, and only then is each region focused and measured.
 *
 * IT WAS PROVEN TO BITE, and the first attempt to prove it did not. Deleting the
 * `.codebox__value:focus-visible` rule outright left this GREEN — correctly:
 * Chromium's own `:focus-visible` ring takes over and a UA-drawn indicator
 * satisfies 2.4.7 just as well as an author-drawn one, so removing the author
 * rule is not a defect and the mutation was invalid. Replacing it with
 * `outline: none` — which is a defect, because it suppresses the UA ring too —
 * failed the run with all fifteen scrollers named. Worth adding to the
 * invalid-mutation list: A MUTATION THE USER AGENT SILENTLY REPAIRS PROVES
 * NOTHING.
 */
export async function expectFocusIndicators(page: Page, label: string): Promise<void> {
  const targets = await page.locator('[tabindex="0"]').all();
  if (targets.length === 0) return;

  // Put Chromium into keyboard modality with a REAL key press.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.keyboard.press('Tab');

  // THE FOCUSED STYLE IS READ, AND NOTHING IS READ BEFORE IT. An earlier form of
  // this check read each element's unfocused style first and asserted that
  // focusing CHANGED it, which is the more obvious statement of the requirement
  // — and it does not work in Chromium. Once an element's computed style has
  // been read, a read taken after a pseudo-class change comes back PARTIALLY
  // refreshed: `.codebox__value` reported `solid 3px rgb(230,237,243)` — the new
  // `outline-style` with the initial width and `currentColor` — for a rule that
  // resolves to `solid 2px rgb(245,158,11)` when the element is read for the
  // first time while focused. Splitting the two reads into separate `evaluate`
  // round-trips did not help; only never taking the first read does. It is
  // reproducible in isolation, it survives a rebuild, and it fabricated one
  // phantom defect per scroller across every state.
  const missing: string[] = [];
  for (const t of targets) {
    const info = await t.evaluate((el) => {
      (el as HTMLElement).focus();
      const cs = getComputedStyle(el);
      return {
        sel:
          el.tagName.toLowerCase() +
          (el.getAttribute('class') ? `.${el.getAttribute('class')!.trim().split(/\s+/).join('.')}` : ''),
        focusVisible: el.matches(':focus-visible'),
        outlineStyle: cs.outlineStyle,
        outlineWidth: parseFloat(cs.outlineWidth) || 0,
        outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
        shadow: cs.boxShadow,
      };
    });
    const paints =
      (info.outlineStyle !== 'none' && info.outlineWidth > 0) || info.shadow !== 'none';
    if (!info.focusVisible) {
      missing.push(`${info.sel}: focus() did not match :focus-visible (priming failed?)`);
    } else if (!paints) {
      missing.push(`${info.sel}: focused but paints no indicator (outline ${info.outline})`);
    }
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  expect(missing, `focusable regions with no focus indicator in state: ${label}`).toEqual([]);
}

/**
 * When `A11Y_COLLECT` is set, `scan` records failures instead of throwing.
 *
 * A strict gate reports the first failing assertion in the first failing state
 * and stops, so a page with defects in several states needs one full run per
 * defect to enumerate them. The collection pass turns that into a single run. It
 * is a debugging aid only: `A11Y_COLLECT` is never set in CI or in the committed
 * workflow, and a run with it set prints every finding as it happens and then
 * FAILS at the end via `reportCollected`, so a green collection run cannot be
 * mistaken for a green gate.
 */
const COLLECTING = !!process.env.A11Y_COLLECT;
const collected: string[] = [];

function record(entry: string): void {
  collected.push(entry);
  // Printed as it happens, not only at the end: a hard assertion later in the
  // drive would otherwise abort the test before anything collected so far was
  // ever shown.
  console.log(`\n[A11Y_COLLECT #${collected.length}] ${entry}`);
}

export function softExpect(actual: unknown, message: string, expected: unknown): void {
  if (!COLLECTING) {
    expect(actual, message).toEqual(expected);
    return;
  }
  try {
    expect(actual, message).toEqual(expected);
  } catch {
    record(`${message}\n  ${JSON.stringify(actual, null, 2)}`);
  }
}

/**
 * Fail the test if the collection pass recorded anything. Without this a
 * collection run would end green, and a green collection run is
 * indistinguishable from a green gate — which is the exact confusion the whole
 * exercise exists to remove.
 */
export function reportCollected(): void {
  if (!COLLECTING) return;
  expect(collected, `A11Y_COLLECT recorded ${collected.length} failure(s)`).toEqual([]);
}

async function soft(fn: () => Promise<void>): Promise<void> {
  if (!COLLECTING) return fn();
  try {
    await fn();
  } catch (e) {
    record(String(e).slice(0, 6000));
  }
}

/**
 * WCAG 1.4.11 and generated content, ratcheted against a per-repo baseline.
 *
 * Neither class has ANY other oracle: axe has no rule for non-text contrast,
 * and the arithmetic text walk cannot reach a control's boundary or a `::before`
 * glyph, because a pseudo-element is not an element and owns no text node.
 *
 * IT IS CALLED FROM `scan()`. In the reference gate this fleet was copied from,
 * it was reachable only from inside the scroller check, AFTER that function's
 * `if (!COLLECTING) return ...` guard — so in a strict run it never executed at
 * all, `nontext.ts` was dead code, and the baseline had been "captured" by a
 * check that had never looked. Calling it here means it runs at every driven
 * state in both themes at both widths.
 *
 * It ratchets rather than blocking: anything NOT in the baseline fails, anything
 * in the baseline that got WORSE fails, and (via `expectBaselineNotStale`)
 * anything in the baseline that has been FIXED fails until its entry is deleted.
 * That last rule is what stops the allowlist becoming a permanent exemption.
 */
const nonTextSeen = new Set<string>();

export async function expectNoNewNonTextFailures(page: Page, label: string): Promise<void> {
  const found = await auditNonText(page);
  // Capture mode: emit every finding and assert nothing, so a baseline can be
  // generated by the SAME path that checks it. Opt-in via env, and the run is
  // deliberately left failing at the end by `expectBaselineNotStale` so a
  // capture pass can never be mistaken for a passing gate.
  if (process.env.NT_BASELINE_CAPTURE) {
    for (const f of found) {
      console.log(`NTCAP|${f.kind}|${f.selector}|${f.ratio}|${f.required}|${/POSITIONED/.test(f.detail)}`);
    }
    return;
  }
  const problems: string[] = [];
  for (const f of found) {
    const key = `${f.kind}|${f.selector}`;
    nonTextSeen.add(key);
    const base = NONTEXT_BASELINE[key];
    if (!base) {
      problems.push(`NEW ${f.ratio}:1 (needs ${f.required}:1) [${f.kind}] ${f.selector} — ${f.detail}`);
    } else if (f.ratio < base.ratio - 0.01) {
      problems.push(`WORSE ${f.selector}: ${f.ratio}:1, baseline recorded ${base.ratio}:1`);
    }
  }
  expect(problems, `new or worsened non-text contrast in state: ${label}`).toEqual([]);
}

/**
 * Fail if a baselined finding never appeared during the whole drive.
 *
 * It has either been fixed — in which case delete the entry, which is the point
 * — or the drive stopped reaching the state that shows it, which is a coverage
 * regression worth knowing about. Call once, after `driveAllStates`.
 */
export function expectBaselineNotStale(): void {
  const unseen = Object.keys(NONTEXT_BASELINE).filter((k) => !nonTextSeen.has(k));
  expect(
    unseen,
    'baselined non-text findings that no longer appear — delete them from nontext-baseline.ts (or restore the drive state that showed them)'
  ).toEqual([]);
}

/**
 * Scan the page as it currently stands.
 *
 * Nine assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - reduced-motion end state, twice: `expectNotBlank` for opacity and
 *    `expectChordsDrawn` for the clock's stroke-dashoffset fork.
 *  - `violations` — the usual WCAG A/AA rule failures, plus four landmark
 *    best-practice rules `withTags` does not run on its own.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the next assertion computes those ratios
 *    arithmetically — which matters more here than in most labs, since every
 *    `.status`, `.verdict`, `.trapdoor__side` and `.flow-op__box` surface is an
 *    `rgba()` tint and every accent wash is a `color-mix(in oklab, ...)` that
 *    axe declines to resolve. Everything else in that bucket is a real result
 *    axe simply could not finish — including `aria-prohibited-attr`, which is
 *    where an `aria-label` on a role-less element hides, a defect that never
 *    reaches the violations array at all. This page carries four such labels
 *    (`.cl-hero-why`, `.phi-aside`, `.flow`, `.sam-controls`) and each is only
 *    legal because of the role beside it, which is easy to drop by accident.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node.
 *  - the `.sam-bits` strip, measured with the `aria-hidden` exemption LIFTED.
 *    SC 1.4.3 is about what a reader sees; `aria-hidden` changes only what a
 *    reader hears. See `contrast.ts`.
 *  - non-text contrast — SC 1.4.11, which axe has no rule for at all.
 *  - list semantics, focus indicators, keyboard reachability of scrolling
 *    regions (2.1.1), and reflow (1.4.10) — none of which axe covers either.
 */
export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  await expectNotBlank(page, label);
  await expectChordsDrawn(page, label);

  // TWO axe runs, deliberately, and this is not a style choice.
  //
  // `AxeBuilder.withTags()` and `AxeBuilder.withRules()` both write the same
  // `options.runOnly` field, so the second call SILENTLY REPLACES the first —
  // the axe-core/playwright source says so in as many words on `withRules`
  // ("Cannot be used with AxeBuilder#withTags"). Chained as
  // `.withTags(TAGS).withRules([...4 landmark rules])`, axe therefore runs those
  // FOUR best-practice rules and NOT ONE WCAG RULE, while a green result reads
  // exactly like a full A/AA pass. For scale, `withTags(TAGS)` selects 69 of
  // axe-core 4.12's 105 rule definitions; the chained form executes 4.
  //
  // Running the two sets separately and merging is the only way to have both.
  // The landmark four are still wanted because they are best-practice rather
  // than WCAG-tagged, so `withTags` alone does not reach them — and this page
  // has the shape they catch: a shared sticky `<header role="banner">` above a
  // `<main>` that contains a second `<header class="cl-hero">`, with an
  // `<aside class="cl-hero-why">` inside that.
  const wcag = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const landmarks = await new AxeBuilder({ page })
    .withRules([
      'landmark-no-duplicate-banner',
      'landmark-unique',
      'landmark-one-main',
      'landmark-complementary-is-top-level',
    ])
    .analyze();
  const results = {
    violations: [...wcag.violations, ...landmarks.violations],
    incomplete: [...wcag.incomplete, ...landmarks.incomplete],
  };

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  softExpect(violations, `axe violations in state: ${label}`, []);

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
  softExpect(unexplainedIncomplete, `axe incomplete results in state: ${label}`, []);

  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  softExpect(contrast, `measured contrast failures in state: ${label}`, []);

  // The one `aria-hidden` subtree on this page that carries characters.
  const hiddenStrip = Array.from(
    new Set(formatContrastFailures(await auditContrast(page, '.sam-bits *', true)))
  );
  softExpect(hiddenStrip, `contrast inside the aria-hidden .sam-bits strip in state: ${label}`, []);

  await soft(() => expectNoNewNonTextFailures(page, label));
  await soft(() => expectListSemantics(page, label));
  await soft(() => expectFocusIndicators(page, label));
  await soft(() => expectScrollersReachable(page, label));
  await soft(() => expectNoHorizontalOverflow(page, label));
}

// ── The drive ───────────────────────────────────────────────────────────────

/** Set an input's value the way a reader does, and let the lab's handler run. */
async function retype(page: Page, sel: string, value: string): Promise<void> {
  await page.fill(sel, value);
  await expect(page.locator(sel)).toHaveValue(value);
}

/** Rebuild the shared key from explicit p, q, e and wait for the trace to land. */
async function generateKey(page: Page, p: string, q: string, e?: string): Promise<void> {
  await retype(page, '#kg-p', p);
  await retype(page, '#kg-q', q);
  if (e !== undefined) await page.selectOption('#kg-e', e);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
}

/**
 * Drive the lab through every state it renders, scanning each.
 *
 * Six things shape this drive:
 *
 *  - IT STARTS FULL, AND THE ARRIVAL STATE IS SCANNED FIRST. `keygenPanel()`
 *    generates a key during mount, so every downstream panel already holds real
 *    output at first paint. `boot` asserts which side of each fork that is.
 *
 *  - EVERY ERROR STATE IS DRIVEN, and the old gate scanned none of them. There
 *    are four distinct ones and they render different markup: the repeated prime
 *    (`.status.bad` PLUS a `.status-link` forward link that exists in no other
 *    state), the composite prime (`.status.bad`, and an `<select>` emptied of
 *    every option — an empty listbox at 380px), the out-of-range message
 *    (`.status.bad` in Section 3, which also clears the whole `.io-out`), and
 *    the empty message (`.enc-chip.empty`, the only place that class is used).
 *
 *  - EVERY BRANCH OF EVERY FORK. `.verdict.good` and `.verdict.bad` in Section 4
 *    (tamper off/on), the tiny and real exponents in the square-and-multiply
 *    trace, and a key small enough that Section 3½ falls back from `"Hi"` to its
 *    `(number)` branch — which is the only route to `.flow-node` showing a bare
 *    integer and to the malleability panel's small-factor fallback.
 *
 *  - EVERY STATE THAT ONLY A BUTTON REACHES: the `.verdict.alarm` from factoring
 *    the weak key (with its recovered primes, reconstructed d and decrypted
 *    probe), and the `.oaep-block`, which needs a real 2048-bit WebCrypto key.
 *
 *  - THE LONGEST OUTPUT THE PAGE CAN PRODUCE. The `.codebox__value` scrollers
 *    only overflow once the value inside them is long enough, so the 2.1.1
 *    question about them does not exist at the defaults. The OAEP block puts a
 *    65-character run in one; the 8-character message maximum puts a 19-digit
 *    integer in another.
 *
 *  - NO FIXED TIMEOUTS. Every step waits on a DOM completion signal the code
 *    itself defines: a status class changing, a verdict appearing, a row count,
 *    the `.oaep-block` being inserted.
 */
export async function driveAllStates(page: Page, theme: string): Promise<void> {
  const scanAt = (s: string): Promise<void> => scan(page, `${theme} / ${s}`);

  // WCAG 2.4.1: the FIRST tab stop must be the skip link, so a keyboard reader
  // can bypass the sticky shared bar.
  //
  // This runs BEFORE any scan, and the order is not cosmetic. `scan` probes
  // focus indicators, which requires a real `Tab` to put Chromium into keyboard
  // modality and leaves the sequential focus navigation starting point on
  // whichever element it probed last. Nothing in the DOM API resets that
  // starting point, so any Tab pressed after a scan lands mid-document and this
  // assertion fails for a reason that has nothing to do with the page. Asserting
  // it first, from a document nothing has touched, is the only honest form.
  await page.keyboard.press('Tab');
  await expect(page.locator('a.cl-skip-link')).toBeFocused();
  await scanAt('skip link focused — the first tab stop');

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await scanAt('first paint, key generated during mount');

  // ── Section 3: the square-and-multiply disclosure, opened by its summary ──
  const trace = page.locator('details.trace');
  await trace.locator('summary').click();
  await expect(trace).toHaveAttribute('open', '');
  await expect(page.locator('.sam-bit')).toHaveCount(2); // e = 3 is 0b11
  await expect(page.locator('.sam-row')).toHaveCount(2);
  await scanAt('square-and-multiply trace open, tiny exponent e = 3');

  // The real key exponent — a longer bit strip, more rows, and the only state
  // where a `.sam-row.skip` (0-bit) appears beside a `.sam-row.used`.
  await page.getByRole('button', { name: /Real key exponent/ }).click();
  await expect(page.getByRole('button', { name: /Real key exponent/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.locator('.sam-bit')).toHaveCount(5); // e = 17 is 0b10001
  await expect(page.locator('.sam-row.skip').first()).toBeVisible();
  await expect(page.locator('.sam-row.used').first()).toBeVisible();
  await scanAt('square-and-multiply trace, real exponent e = 17');

  await page.getByRole('button', { name: /Tiny exponent/ }).click();
  await expect(page.getByRole('button', { name: /Tiny exponent/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await scanAt('square-and-multiply trace back on the tiny exponent');

  // ── Section 4: both signature verdicts ──────────────────────────────────
  await page.locator('#sv-tamper').check();
  await expect(page.locator('#sign .verdict.bad')).toBeVisible();
  await expect(page.locator('#sign .verdict.good')).toHaveCount(0);
  await scanAt('signature INVALID after tampering');

  await retype(page, '#sv-msg', 'transfer $1000000 to account 42');
  await expect(page.locator('#sign .verdict.bad')).toBeVisible();
  await scanAt('a longer signed message, still tampered');

  await page.locator('#sv-tamper').uncheck();
  await expect(page.locator('#sign .verdict.good')).toBeVisible();
  await scanAt('signature VALID again, re-signed over the edited message');

  // ── Section 3: the two message error/empty branches ─────────────────────
  // 8 characters is the input maximum, and 8 bytes will not fit under a 16-bit
  // n — this is the PlaintextRangeError path, which also empties `.io-out`.
  await retype(page, '#ed-msg', 'overflow');
  await expect(page.locator('#encrypt .status')).toHaveClass(/\bbad\b/);
  await expect(page.locator('#encrypt .status')).toContainText('is not in range');
  await expect(page.locator('#encrypt .io-row')).toHaveCount(0);
  await scanAt('message too large for n — the range error');

  await retype(page, '#ed-msg', '');
  await expect(page.locator('.enc-chip.empty')).toBeVisible();
  await expect(page.locator('#encrypt .status')).toHaveClass(/\bwarn\b/);
  await scanAt('empty message — the (empty) chip branch');

  await retype(page, '#ed-msg', 'Hi');
  await expect(page.locator('#encrypt .io-row')).toHaveCount(3);
  await scanAt('message restored');

  // ── Section 5: factor the weak key ──────────────────────────────────────
  await page.getByRole('button', { name: /Factor it!/ }).click();
  await expect(page.locator('#breaks .verdict.alarm')).toBeVisible();
  await expect(page.locator('#breaks .verdict.alarm')).toContainText('KEY BROKEN');
  await expect(page.locator('#breaks .break-out .io-row')).toHaveCount(3);
  await scanAt('weak key factored — the ALARM verdict and the recovered private key');

  // ── Section 6: the real 2048-bit OAEP comparison ────────────────────────
  await page.getByRole('button', { name: /Run the real OAEP comparison/ }).click();
  await expect(page.locator('.oaep-block')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.oaep-block .verdict.good')).toContainText('Different ciphertext');
  await expect(page.locator('#realworld .status')).toBeEmpty();
  // The longest run this page can put inside a `.codebox__value`: 64 hex chars
  // plus an ellipsis, which is what makes the 2.1.1 scroller question real.
  await expect(page.locator('.oaep-block .codebox__value').first()).toContainText(/^[0-9a-f]{64}…$/);
  await scanAt('RSA-OAEP randomized ciphertexts alongside the deterministic ones');

  // ── Section 3.5: replay the round trip ──────────────────────────────────
  await page.getByRole('button', { name: /Replay the round trip/ }).click();
  await scanAt('round trip replayed');

  // ── Section 2: the two rejection paths ──────────────────────────────────
  await page.getByRole('button', { name: /too-small \/ repeated prime/ }).click();
  await expect(page.locator('#keygen .status')).toHaveClass(/\bbad\b/);
  await expect(page.locator('#keygen .status')).toContainText('p and q must be distinct');
  // The forward link to Section 5 exists in NO other state.
  await expect(page.locator('#keygen .status-link')).toBeVisible();
  await expect(page.locator('#keygen .step')).toHaveCount(0);
  await scanAt('keygen rejected: p = q, with the forward link to Section 5');

  await generateKey(page, '9', '263');
  await expect(page.locator('#keygen .status')).toHaveClass(/\bbad\b/);
  await expect(page.locator('#keygen .status')).toContainText('is not prime');
  // A composite p empties the exponent listbox — a `<select>` with no options.
  await expect(page.locator('#kg-e option')).toHaveCount(0);
  await scanAt('keygen rejected: composite p, exponent list emptied');

  // ── A key so small the round-trip picture takes its other branch ────────
  //
  // n = 15 (p = 3, q = 5) is the smallest key this lab can build. Reaching it at
  // all is a regression test for two source bugs this gate found:
  //
  //  - Section 6 encoded a single 'H' (m = 72) for any n below 0x4869, so for
  //    n <= 72 `asPlaintext` threw out of the `onKey` listener, back through
  //    `setKey`, into Section 2's catch — which reported a VALID key as a keygen
  //    failure with a range error naming a panel four sections away. The
  //    `.status.ok` assertion below is what pins that shut.
  //  - Section 5 re-appended a persistent `out` node on every key change without
  //    clearing it, so the break result for the PREVIOUS key stayed on screen
  //    under the new card. The key was just factored two steps ago, so the
  //    `.break-out` emptiness assertion below is exactly the state that showed
  //    it.
  await generateKey(page, '3', '5', '3');
  await expect(page.locator('#keygen .status')).toHaveClass(/\bok\b/);
  await expect(page.locator('#keygen .step')).toHaveCount(7);
  await expect(page.locator('#breaks .break-out')).toBeEmpty();
  await expect(page.locator('#breaks .scale-card.weak')).toContainText('n = 15');
  await expect(page.locator('#roundtrip .flow-node').first()).toContainText('(number)');
  await expect(page.locator('#realworld .io-row__label').first()).toContainText('Encrypt m = 2');
  await expect(page.locator('#encrypt .status')).toHaveClass(/\bbad\b/);
  await scanAt('n = 15 — the smallest key, round trip on its integer branch');

  await page.getByRole('button', { name: /Factor it!/ }).click();
  await expect(page.locator('#breaks .verdict.alarm')).toBeVisible();
  await scanAt('n = 15 factored');

  // ── Random primes: a key nobody chose, propagated everywhere ────────────
  await page.getByRole('button', { name: /Roll random primes/ }).click();
  await expect(page.locator('#keygen .status')).toHaveClass(/\bok\b/);
  await expect(page.locator('#keygen .step')).toHaveCount(7);
  await expect(page.locator('#encrypt .io-row')).toHaveCount(3);
  await scanAt('random primes rolled, key propagated to every panel');

  // ── Back to the shipped defaults, with everything on screen at once ─────
  await generateKey(page, '257', '263', '17');
  await expect(page.locator('#keygen .status')).toHaveClass(/\bok\b/);
  await page.getByRole('button', { name: /Factor it!/ }).click();
  await expect(page.locator('#breaks .verdict.alarm')).toBeVisible();
  await scanAt('the finished page: every panel populated, key factored, OAEP shown');
}
