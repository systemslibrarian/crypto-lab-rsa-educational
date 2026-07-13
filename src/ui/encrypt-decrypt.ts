// Section 3 — Encrypt / decrypt playground over the shared textbook key.

import { decodeMessage, decrypt, encodeMessage, encrypt } from '../rsa/textbook';
import { modexpTraced } from '../rsa/bigint-math';
import { PlaintextRangeError } from '../rsa/types';
import { el, clear, codeBox, disclosure } from './dom';
import { renderModexp } from './step-trace';
import { onKey } from './store';

export function encryptDecryptPanel(): HTMLElement {
  const msg = el('input', { type: 'text', id: 'ed-msg', value: 'Hi', maxlength: '8', class: 'text' }) as HTMLInputElement;
  const out = el('div', { class: 'io-out' });
  const status = el('div', { class: 'status', role: 'status', 'aria-live': 'polite' });

  let render = () => {};

  onKey((k) => {
    render = () => {
      clear(out);
      status.className = 'status';
      status.replaceChildren();
      try {
        const m = encodeMessage(msg.value, k.pub.n);
        const c = encrypt(m, k.pub);
        const back = decrypt(c.value, k.priv);
        out.append(
          row('Message → integer m', m.toString()),
          explainEncoding(msg.value, m),
          row('Ciphertext c = m^e mod n', c.value.toString()),
          row('Decrypted c^d mod n', `${back.value}  →  "${decodeMessage(back.value)}"`, back.value === m),
          disclosure('Show the encryption math (square-and-multiply)', samHost(m, k.pub.e, k.pub.n)),
        );
        status.className = 'status warn';
        status.replaceChildren(el('span', {}, ['⚠ Textbook RSA — no padding. Teaching only, never use raw RSA for real messages.']));
      } catch (err) {
        status.className = 'status bad';
        const m = err instanceof PlaintextRangeError ? err.message : (err as Error).message;
        status.replaceChildren(el('span', {}, ['⚠ ' + m]));
      }
    };
    render();
  });

  msg.addEventListener('input', () => render());

  return el('section', { class: 'panel', id: 'encrypt' }, [
    el('h2', {}, ['3 · Encrypt & decrypt']),
    el('p', { class: 'lede' }, ['Type a short message. It is encoded as an integer m < n, encrypted with (n, e), and decrypted back with d.']),
    el('div', { class: 'controls' }, [
      el('div', { class: 'field' }, [el('label', { for: 'ed-msg' }, ['Message (short)']), msg]),
    ]),
    status,
    out,
  ]);
}

function row(label: string, value: string, ok?: boolean): HTMLElement {
  const cls = ok === undefined ? 'io-row' : ok ? 'io-row good' : 'io-row bad';
  return el('div', { class: cls }, [
    el('span', { class: 'io-row__label' }, [ok === true ? '✓ ' + label : label]),
    codeBox(value, label),
  ]);
}

/** Show the text→number leap explicitly: each character's byte packed into m. */
function explainEncoding(text: string, m: bigint): HTMLElement {
  const chars = [...text].slice(0, 8);
  const parts = chars.map((ch) => {
    const code = ch.charCodeAt(0) & 0xff;
    return el('span', { class: 'enc-chip' }, [
      el('span', { class: 'enc-chip__ch' }, [ch === ' ' ? '␣' : ch]),
      el('span', { class: 'enc-chip__code mono' }, [String(code)]),
    ]);
  });
  return el('div', { class: 'enc-explain' }, [
    el('p', { class: 'enc-explain__cap' }, [
      'How text becomes a number: each character is its byte value, and the bytes are packed left-to-right into one big integer (base-256).',
    ]),
    el('div', { class: 'enc-chips' }, parts.length ? parts : [el('span', { class: 'enc-chip empty' }, ['(empty)'])]),
    el('p', { class: 'enc-explain__result mono' }, [`packed → m = ${m}`]),
  ]);
}

/**
 * Square-and-multiply host. Defaults to a TINY exponent (e = 3) so the trace is
 * only two rows and the "fast exponentiation" lesson is obvious, then offers the
 * real key exponent. Both traces are computed live over the same base and modulus
 * with modexpTraced — no faked numbers; only the exponent shown changes.
 */
function samHost(m: bigint, realE: bigint, n: bigint): HTMLElement {
  const view = el('div', { class: 'sam-view' });
  const render = (e: bigint): void => {
    clear(view);
    const { steps } = modexpTraced(m, e, n);
    view.append(renderModexp(m, e, n, steps));
  };

  const tinyBtn = el('button', { type: 'button', class: 'btn primary', onclick: () => { setActive(tinyBtn); render(3n); } }, ['Tiny exponent (e = 3)']);
  const realBtn = el('button', { type: 'button', class: 'btn', onclick: () => { setActive(realBtn); render(realE); } }, [`Real key exponent (e = ${realE})`]);

  function setActive(active: HTMLElement): void {
    for (const b of [tinyBtn, realBtn]) {
      b.className = b === active ? 'btn primary' : 'btn';
      b.setAttribute('aria-pressed', String(b === active));
    }
  }
  tinyBtn.setAttribute('aria-pressed', 'true');
  realBtn.setAttribute('aria-pressed', 'false');

  render(3n); // start tiny
  return el('div', { class: 'sam-wrap' }, [
    el('div', { class: 'controls sam-controls', role: 'group', 'aria-label': 'Exponent size for the trace' }, [tinyBtn, realBtn]),
    view,
  ]);
}
