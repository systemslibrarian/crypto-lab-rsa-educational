/**
 * Known WCAG 1.4.11 / generated-content findings in this lab, captured through
 * the gate's own path so the baseline and the check cannot disagree.
 *
 * THIS FILE IS A TO-DO LIST, NOT A SET OF EXEMPTIONS. The gate ratchets on it:
 *   - a finding NOT listed here fails the run, so a regression cannot land;
 *   - a listed finding whose ratio gets WORSE fails, so the list cannot rot;
 *   - a listed finding that no longer appears ALSO fails, so a fixed entry must
 *     be deleted and the file can only shrink toward empty.
 * The last rule is what stops an allowlist becoming a permanent exemption.
 *
 * `unverified: true` marks an absolutely-positioned pseudo-element. It can paint
 * outside its host and the oracle measures it against the host's backdrop, so
 * that ratio is NOT trustworthy — hand-measure before acting on it.
 *
 * ── What the first live run of this oracle found, and where it went ─────────
 *
 * Eighteen distinct control-boundary failures, over {dark, light} × {1280, 380}
 * and every state the drive builds. Sixteen were this lab's and are FIXED in
 * `src/style.css`, not exempted here:
 *
 *   every `.btn`, `.btn.ghost`, `.btn.primary` and `.codebox__copy`  1.32–2.15:1
 *     — all four drew their edge from `--border-color`, the SURFACE divider the
 *       panels are outlined with, while `--control-border`, the token written
 *       for exactly this job, was applied to `input` and `select` and nothing
 *       else. Now on `--control-border` (3.33:1 dark / 4.57:1 light), with
 *       `.btn.primary` and the hover and focus states on `--accent-edge`
 *       (8.05:1 dark / 6.28:1 light) since raw `--accent` is 2.15:1 on the light
 *       panel.
 *   `input#kg-p`, `input#kg-q`, `input#ed-msg`, `input#sv-msg`, `select#kg-e`
 *                                                                       2.91:1
 *     — the token itself was under the floor in dark. `#596574` → `#626e7d`.
 *       This is the set the DELETED `e2e/border.spec.ts` measured, and it passed
 *       them at 3.28:1 by comparing the border against the input's OWN fill
 *       instead of against the panel the control sits on.
 *
 * The two below are the shared Crypto Lab top bar, and are not this repo's to
 * change. `.cl-btn` draws its edge as
 * `1px solid color-mix(in srgb, var(--accent, #35d6bb) 38%, transparent)` over
 * the bar's fixed `#0b1512`. This lab defines `--accent: #f59e0b`, so the edge
 * composites to rgb(100, 73, 15): 2.21:1 against the bar, IDENTICALLY IN BOTH
 * THEMES, because the bar is always dark and the page theme does not move it.
 * Every repo in this fleet carries a copy of that markup and CSS, and
 * `CLAUDE.md` is explicit that a change every lab should get is a reviewed
 * fleet-wide pass and never an overwrite driven from one repo. So it is
 * measured here, ratcheted here, and reported upward.
 *
 * Everything inside `<main id="app">` and the footer is audited with no
 * exemption, and comes back clean.
 */
export const NONTEXT_BASELINE: Record<
  string,
  { ratio: number; required: number; unverified: boolean }
> = {
  'control-boundary|a.cl-btn': { ratio: 2.21, required: 3, unverified: false },
};
