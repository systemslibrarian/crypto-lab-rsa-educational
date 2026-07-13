// Section 3.5 — The round trip drawn as one picture, plus a mod-n "clock" that
// shows WHY raising to d undoes raising to e. Everything here is computed live
// from the shared key with the same modexp the rest of the demo uses — no faked
// numbers. The visualization only *renders* real arithmetic.

import { encodeMessage } from '../rsa/textbook';
import { modexp } from '../rsa/bigint-math';
import { el, clear } from './dom';
import { onKey } from './store';
import type { Keypair } from '../rsa/types';

export function roundTripPanel(): HTMLElement {
  const flowHost = el('div', { class: 'flow-host' });
  const clockHost = el('div', { class: 'clock-host' });
  const status = el('div', { class: 'status', role: 'status', 'aria-live': 'polite' });

  let current: Keypair | null = null;

  function rebuild(): void {
    if (!current) return;
    const k = current;
    // Pick a message that fits under n. 'Hi' when it fits, else a single char,
    // else the largest single-byte value that fits so the picture always renders.
    let text = k.pub.n > 0x4869n ? 'Hi' : k.pub.n > 0x48n ? 'H' : '';
    let m: bigint;
    try {
      m = encodeMessage(text, k.pub.n);
    } catch {
      m = k.pub.n > 3n ? 2n : 1n;
      text = '';
    }
    const c = modexp(m, k.pub.e, k.pub.n);
    const back = modexp(c, k.priv.d, k.priv.n);

    clear(flowHost);
    flowHost.append(renderFlow(k, text, m, c, back));

    clear(clockHost);
    clockHost.append(renderClock(k, m, c, back));
  }

  onKey((k) => {
    current = k;
    status.replaceChildren();
    status.className = 'status';
    rebuild();
  });

  return el('section', { class: 'panel', id: 'roundtrip' }, [
    el('h2', {}, ['3½ · The round trip, in one picture']),
    el('p', { class: 'lede' }, [
      'The two keys are not two separate facts — they are two halves of one journey. ',
      'Encrypt with the ',
      el('strong', {}, ['public']),
      ' key, decrypt with the ',
      el('strong', {}, ['private']),
      ' key, and the message you started with comes back.',
    ]),
    flowHost,
    el('h3', { class: 'rt-subhead' }, ['Why does raising to d undo raising to e?']),
    el('p', { class: 'lede' }, [
      'Think of the numbers 0…n−1 as marks on a clock face. Encrypting jumps m to a ',
      'scrambled spot. Decrypting takes exactly enough further jumps to land all the way ',
      'back around on m. It works because of one identity you can read straight off the key.',
    ]),
    clockHost,
    status,
  ]);
}

/** Horizontal flow: 'Hi' → m → [^e mod n · public] → c → [^d mod n · private] → m → 'Hi'. */
function renderFlow(k: Keypair, text: string, m: bigint, c: bigint, back: bigint): HTMLElement {
  const label = text ? `"${text}"` : '(number)';
  const backLabel = back === m ? (text ? `"${text}"` : String(back)) : '✗ mismatch';

  const node = (top: string, main: string, kind = ''): HTMLElement =>
    el('div', { class: `flow-node ${kind}`.trim() }, [
      el('span', { class: 'flow-node__top' }, [top]),
      el('span', { class: 'flow-node__main mono' }, [main]),
    ]);

  const op = (title: string, sub: string, keyKind: 'pub' | 'priv'): HTMLElement =>
    el('div', { class: 'flow-op' }, [
      el('div', { class: 'flow-arrow', 'aria-hidden': 'true' }, ['→']),
      el('div', { class: `flow-op__box ${keyKind}` }, [
        el('span', { class: 'flow-op__title mono' }, [title]),
        el('span', { class: `flow-key-tag ${keyKind}` }, [sub]),
      ]),
      el('div', { class: 'flow-arrow', 'aria-hidden': 'true' }, ['→']),
    ]);

  return el('div', { class: 'flow', role: 'img', 'aria-label':
    `Round trip: message ${label} becomes integer m = ${m}, is encrypted with the public key to ciphertext c = ${c}, ` +
    `then decrypted with the private key back to m = ${back}, recovering ${label}.` }, [
    node('text', label),
    el('div', { class: 'flow-arrow', 'aria-hidden': 'true' }, ['→']),
    node('encode', `m = ${m}`),
    op(`c = m^${k.pub.e} mod ${k.pub.n}`, `🔓 public (n, e)`, 'pub'),
    node('ciphertext', `c = ${c}`, 'cipher'),
    op(`m = c^${k.priv.d} mod ${k.priv.n}`, `🔑 private (d, n)`, 'priv'),
    node('recovered', `m = ${back}`, back === m ? 'ok' : 'bad'),
    el('div', { class: 'flow-arrow', 'aria-hidden': 'true' }, ['→']),
    node('decode', backLabel, back === m ? 'ok' : 'bad'),
  ]);
}

/**
 * A mod-n clock. We plot m, c, and the recovered value on a ring of n positions.
 * The animation walks the point from m → c (encrypt) then c → back (decrypt),
 * highlighting that decrypt wraps around to the original mark. e·d = kφ + 1 is
 * shown as the exact reason: exponents compose, and e·d is 1 more than a multiple
 * of φ, so the whole trip is equivalent to "raise to the 1st power" = do nothing.
 */
function renderClock(k: Keypair, m: bigint, c: bigint, back: bigint): HTMLElement {
  const n = Number(k.pub.n);
  const e = k.pub.e;
  const d = k.priv.d;
  const phi = k.phi;
  const ed = e * d;
  const kMul = ed / phi; // floor; ed = kMul*phi + 1 by construction
  const remainder = ed % phi; // === 1n

  const SIZE = 260;
  const R = 104;
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('class', 'clock-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `A number clock with ${n} positions (0 to ${n - 1}). The message m = ${m} is at one mark. ` +
      `Encrypting moves it to ciphertext c = ${c}. Decrypting moves it back to ${back}, the original mark, ` +
      `because e·d = ${ed} equals ${kMul} times φ plus 1.`,
  );

  const pos = (val: number): { x: number; y: number } => {
    const ang = (val / n) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  };

  // Outer ring.
  const ring = document.createElementNS(ns, 'circle');
  ring.setAttribute('cx', String(cx));
  ring.setAttribute('cy', String(cy));
  ring.setAttribute('r', String(R));
  ring.setAttribute('class', 'clock-ring');
  svg.appendChild(ring);

  // Tick marks — cap the number drawn so a large n stays legible.
  const tickStep = Math.max(1, Math.round(n / 60));
  for (let i = 0; i < n; i += tickStep) {
    const p = pos(i);
    const t = document.createElementNS(ns, 'circle');
    t.setAttribute('cx', String(p.x));
    t.setAttribute('cy', String(p.y));
    t.setAttribute('r', '1.4');
    t.setAttribute('class', 'clock-tick');
    svg.appendChild(t);
  }

  const marker = (val: bigint, cls: string, glyph: string): SVGGElement => {
    const p = pos(Number(val) % n);
    const g = document.createElementNS(ns, 'g') as SVGGElement;
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', String(p.x));
    dot.setAttribute('cy', String(p.y));
    dot.setAttribute('r', '7');
    dot.setAttribute('class', `clock-dot ${cls}`);
    const lbl = document.createElementNS(ns, 'text');
    // Nudge label outward from the ring center.
    const ox = p.x + (p.x - cx) * 0.16;
    const oy = p.y + (p.y - cy) * 0.16;
    lbl.setAttribute('x', String(ox));
    lbl.setAttribute('y', String(oy));
    lbl.setAttribute('class', `clock-label ${cls}`);
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('dominant-baseline', 'middle');
    lbl.textContent = glyph;
    g.appendChild(dot);
    g.appendChild(lbl);
    return g;
  };

  // Chords: m→c (encrypt) and c→back (decrypt).
  const chord = (a: bigint, b: bigint, cls: string): SVGLineElement => {
    const pa = pos(Number(a) % n);
    const pb = pos(Number(b) % n);
    const line = document.createElementNS(ns, 'line') as SVGLineElement;
    line.setAttribute('x1', String(pa.x));
    line.setAttribute('y1', String(pa.y));
    line.setAttribute('x2', String(pb.x));
    line.setAttribute('y2', String(pb.y));
    line.setAttribute('class', `clock-chord ${cls}`);
    return line;
  };

  const encChord = chord(m, c, 'enc');
  const decChord = chord(c, back, 'dec');
  svg.appendChild(encChord);
  svg.appendChild(decChord);
  svg.appendChild(marker(m, 'm', 'm'));
  svg.appendChild(marker(c, 'c', 'c'));

  // The identity readout — the crux of the whole panel.
  const identity = el('div', { class: 'clock-identity' }, [
    el('p', { class: 'clock-identity__eq mono' }, [
      `e · d = ${e} · ${d} = ${ed}`,
    ]),
    el('p', { class: 'clock-identity__eq mono hl' }, [
      `${ed} = ${kMul} · φ + ${remainder}   (φ = ${phi})`,
    ]),
    el('p', { class: 'clock-identity__note' }, [
      'Because e·d is exactly ',
      el('strong', {}, ['one more than a multiple of φ']),
      ', encrypting then decrypting is the same as raising m to the power 1 — Euler’s theorem ',
      'says the extra ',
      el('span', { class: 'mono' }, [`${kMul}·φ`]),
      ' worth of exponent wraps all the way around and cancels. That is what the check ',
      el('span', { class: 'mono' }, ['e·d mod φ = 1']),
      ' in Section 2 was quietly guaranteeing.',
    ]),
  ]);

  const legend = el('div', { class: 'clock-legend' }, [
    legendItem('m', 'start: m = ' + m),
    legendItem('c', 'after ^e: c = ' + c),
    legendItem('enc', 'encrypt hop', true),
    legendItem('dec', 'decrypt hop back', true),
  ]);

  const replay = el('button', {
    type: 'button',
    class: 'btn',
    onclick: () => animate(encChord, decChord, svg),
  }, ['▶ Replay the round trip']);

  // Kick off the animation once on build.
  requestAnimationFrame(() => animate(encChord, decChord, svg));

  return el('div', { class: 'clock-wrap' }, [
    el('div', { class: 'clock-figure' }, [svg, legend, replay]),
    identity,
  ]);
}

function legendItem(cls: string, text: string, line = false): HTMLElement {
  return el('span', { class: 'clock-legend__item' }, [
    el('span', { class: `clock-legend__swatch ${cls} ${line ? 'is-line' : ''}`.trim(), 'aria-hidden': 'true' }, []),
    text,
  ]);
}

/**
 * Draw the encrypt chord, then the decrypt chord, using stroke-dashoffset so the
 * lines visibly "travel". Respects prefers-reduced-motion by drawing instantly.
 */
function animate(enc: SVGLineElement, dec: SVGLineElement, svg: SVGSVGElement): void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for (const [ln, delay] of [[enc, 0], [dec, 900]] as const) {
    const len = lineLength(ln);
    ln.style.strokeDasharray = String(len);
    if (reduce) {
      ln.style.strokeDashoffset = '0';
      continue;
    }
    ln.style.strokeDashoffset = String(len);
    ln.style.transition = 'none';
    // Force reflow then transition.
    void svg.getBBox;
    window.setTimeout(() => {
      ln.style.transition = 'stroke-dashoffset .8s ease';
      ln.style.strokeDashoffset = '0';
    }, delay + 30);
  }
}

function lineLength(ln: SVGLineElement): number {
  const x1 = Number(ln.getAttribute('x1'));
  const y1 = Number(ln.getAttribute('y1'));
  const x2 = Number(ln.getAttribute('x2'));
  const y2 = Number(ln.getAttribute('y2'));
  return Math.hypot(x2 - x1, y2 - y1);
}
