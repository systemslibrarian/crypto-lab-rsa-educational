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
        el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['H(message) signed']), codeBox(digest.toString(), 'digest')]),
        el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['Signature s = H(m)^d mod n']), codeBox(signature.toString(), 'signature')]),
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
    out,
  ]);
}
