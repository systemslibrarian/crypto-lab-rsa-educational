// Section 3 — Encrypt / decrypt playground over the shared textbook key.

import { decodeMessage, decrypt, encodeMessage, encrypt } from '../rsa/textbook';
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
          row('Ciphertext c = m^e mod n', c.value.toString()),
          row('Decrypted c^d mod n', `${back.value}  →  "${decodeMessage(back.value)}"`, back.value === m),
          disclosure('Show the encryption math (square-and-multiply)', renderModexp(m, k.pub.e, k.pub.n, c.steps)),
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
