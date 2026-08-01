// Section 4 — Sign / verify, with a tamper toggle that makes verification fail.

import { sign, verify } from '../rsa/textbook';
import { el, clear, codeBox } from './dom';
import { onKey } from './store';

export function signVerifyPanel(): HTMLElement {
  const msg = el('input', { type: 'text', id: 'sv-msg', value: 'transfer $100', class: 'text' }) as HTMLInputElement;
  const tamper = el('input', { type: 'checkbox', id: 'sv-tamper' }) as HTMLInputElement;
  const out = el('div', { class: 'io-out' });

  let render = () => {};
  onKey((k) => {
    render = () => {
      clear(out);
      const original = msg.value;
      const { signature, digest } = sign(original, k.priv);
      // tampering changes the message AFTER signing — signature no longer matches
      const delivered = tamper.checked ? original + ' (altered)' : original;
      const res = verify(delivered, signature, k.pub);

      const verdict = res.ok
        ? el('div', { class: 'verdict good' }, ['✓ Signature VALID — message is authentic and unchanged'])
        : el('div', { class: 'verdict bad' }, ['✗ Signature INVALID — message was altered after signing']);

      out.append(
        el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['H(message) signed — H = toy FNV-1a, not SHA-256']), codeBox(digest.toString(), 'digest')]),
        el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['Signature s = H(m)^d mod n  (H = toy hash)']), codeBox(signature.toString(), 'signature')]),
        el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['Delivered message verifier sees']), codeBox(delivered, 'message')]),
        el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['Recovered s^e mod n vs fresh H(m)']), codeBox(`${res.recovered}  vs  ${res.expected}`, 'check')]),
        verdict,
      );
    };
    render();
  });

  msg.addEventListener('input', () => render());
  tamper.addEventListener('change', () => render());

  return el('section', { class: 'panel', id: 'sign' }, [
    el('h2', {}, ['4 · Sign & verify']),
    el('p', { class: 'lede' }, ['Sign with the private key; anyone verifies with the public key. Flip “tamper” to alter the message after signing and watch verification fail.']),
    el('div', { class: 'controls' }, [
      el('div', { class: 'field grow' }, [el('label', { for: 'sv-msg' }, ['Message to sign']), msg]),
      el('label', { class: 'check', for: 'sv-tamper' }, [tamper, ' Tamper with the message after signing']),
    ]),
    el('div', { class: 'status warn' }, [
      el('span', {}, [
        '⚠ Textbook RSA signing — no padding (no PKCS#1 v1.5, no PSS), and H is a 64-bit FNV-1a toy hash, not a cryptographic one. It is not collision resistant, so these signatures are forgeable. Teaching only.',
      ]),
    ]),
    out,
  ]);
}
