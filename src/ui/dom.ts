// Tiny DOM helpers — keeps the panel modules readable without a framework.

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (val === undefined || val === false) continue;
    if (key.startsWith('on') && typeof val === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), val as EventListener);
    } else if (key === 'class') {
      node.className = String(val);
    } else if (key === 'html') {
      node.innerHTML = String(val);
    } else if (val === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(val));
    }
  }
  for (const c of children) node.append(c);
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

/** A collapsible <details> block for the expandable math traces. */
export function disclosure(summary: string, body: Node): HTMLDetailsElement {
  const d = el('details', { class: 'trace' });
  d.append(el('summary', {}, [summary]), body);
  return d;
}

/**
 * Monospace, horizontally-scrollable value box with a copy button (a11y/mobile rule).
 *
 * The box is `overflow-x: auto` around a `white-space: nowrap` run, so at phone
 * width almost every value this lab generates makes it scroll for real — which
 * makes it a SCROLLING REGION that has to be operable from a keyboard (WCAG
 * 2.1.1), and it holds nothing focusable of its own: the Copy button is its
 * SIBLING, not its child. So it gets a tab stop, and a tab stop has to be named
 * and has to show where the focus is:
 *
 *  - `role="group"` is what makes the `aria-label` legal. An `aria-label` on a
 *    role-less element is PROHIBITED and silently discarded — axe files that
 *    under `incomplete`, never under `violations` — and `<code>` exposes the
 *    `code` role, which does not support naming either. `group` does, and it is
 *    the right shape for a small scroller: `role="region"` would turn every one
 *    of these into a landmark and they would collide under `landmark-unique`.
 *  - `.codebox__value:focus-visible` in `style.css` draws the indicator (2.4.7).
 *    Making something focusable and leaving it without one is a defect
 *    introduced by the fix.
 *
 * This was invisible until the 1.4.10 reflow fix landed, because until then the
 * box was never narrower than its content and so never scrolled at all.
 */
export function codeBox(value: string, label?: string): HTMLElement {
  const pre = el(
    'code',
    { class: 'codebox__value', tabindex: '0', role: 'group', 'aria-label': label ?? 'value' },
    [value],
  );
  const copy = el(
    'button',
    {
      class: 'codebox__copy',
      type: 'button',
      'aria-label': `Copy ${label ?? 'value'}`,
      onclick: () => navigator.clipboard?.writeText(value),
    },
    ['Copy'],
  );
  return el('div', { class: 'codebox' }, [pre, copy]);
}
