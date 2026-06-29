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

/** Monospace, horizontally-scrollable value box with a copy button (a11y/mobile rule). */
export function codeBox(value: string, label?: string): HTMLElement {
  const pre = el('code', { class: 'codebox__value' }, [value]);
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
