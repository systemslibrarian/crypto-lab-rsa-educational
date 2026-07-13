// Section 6 — Real-world RSA: textbook determinism (a leak) vs randomized OAEP.

import { encodeMessage, encrypt, decrypt } from '../rsa/textbook';
import { asPlaintext } from '../rsa/types';
import { generateOaepKey, oaepEncrypt, toHex } from '../rsa/oaep';
import type { OaepKey } from '../rsa/oaep';
import { el, clear, codeBox } from './dom';
import { LINKS } from '../rsa/links';
import { onKey } from './store';
import type { Keypair } from '../rsa/types';

export function realWorldPanel(): HTMLElement {
  const out = el('div', { class: 'io-out' });
  const malleHost = el('div', { class: 'io-out' });
  const status = el('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
  let oaepKey: OaepKey | null = null;

  let render = () => {};
  onKey((k) => {
    renderMalleability(malleHost, k);
    render = () => {
      clear(out);
      // Textbook: encrypt the SAME plaintext twice → identical ciphertext (leaks equality).
      // Use a message that fits the current (possibly tiny) key.
      const text = k.pub.n > 0x4869n ? 'Hi' : 'H';
      const m = encodeMessage(text, k.pub.n);
      const c1 = encrypt(m, k.pub).value;
      const c2 = encrypt(m, k.pub).value;
      out.append(
        el('h3', { class: 'warn-h' }, ['⚠ Textbook RSA — deterministic']),
        el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, [`Encrypt "${text}" once`]), codeBox(c1.toString(), 'c1')]),
        el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, [`Encrypt "${text}" again`]), codeBox(c2.toString(), 'c2')]),
        el('div', { class: 'verdict bad' }, [
          c1 === c2 ? '✗ Identical ciphertext — an eavesdropper learns the two messages are equal' : 'unexpected',
        ]),
      );
    };
    render();
  });

  async function runOaep(): Promise<void> {
    status.className = 'status';
    status.replaceChildren(el('span', {}, ['Generating a real 2048-bit RSA-OAEP key…']));
    try {
      oaepKey ??= await generateOaepKey();
      const a = toHex(await oaepEncrypt(oaepKey, 'Hi'));
      const b = toHex(await oaepEncrypt(oaepKey, 'Hi'));
      const oaepBlock = el('div', { class: 'oaep-block' }, [
        el('h3', { class: 'ok-h' }, ['✓ RSA-OAEP (WebCrypto) — randomized']),
        el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['Encrypt "Hi" once']), codeBox(a.slice(0, 64) + '…', 'oaep1')]),
        el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['Encrypt "Hi" again']), codeBox(b.slice(0, 64) + '…', 'oaep2')]),
        el('div', { class: 'verdict good' }, [a !== b ? '✓ Different ciphertext every time — equality leak is gone' : 'unexpected']),
      ]);
      const existing = out.querySelector('.oaep-block');
      if (existing) existing.replaceWith(oaepBlock);
      else out.append(oaepBlock);
      status.replaceChildren();
    } catch (err) {
      status.className = 'status bad';
      status.replaceChildren(el('span', {}, ['⚠ ' + (err as Error).message]));
    }
  }

  return el('section', { class: 'panel', id: 'realworld' }, [
    el('h2', {}, ['6 · Why real RSA adds padding']),
    el('p', { class: 'lede' }, ['Raw RSA is deterministic: the same message always encrypts to the same ciphertext, leaking when two messages match. Real RSA (OAEP) adds randomness so every encryption differs.']),
    el('div', { class: 'controls' }, [
      el('button', { type: 'button', class: 'btn primary', onclick: () => runOaep() }, ['Run the real OAEP comparison']),
    ]),
    status,
    out,
    el('h3', { class: 'rt-subhead' }, ['A second reason: textbook RSA is malleable']),
    el('p', { class: 'lede' }, [
      'An attacker who never sees the key can still ',
      el('em', {}, ['multiply']),
      ' two ciphertexts and get the encryption of the product of the plaintexts — ',
      el('span', { class: 'mono' }, ['Enc(a)·Enc(b) mod n = Enc(a·b)']),
      '. Watch it happen on your key, then note how OAEP’s all-or-nothing padding destroys the structure.',
    ]),
    malleHost,
    el('p', { class: 'fine' }, [
      'Padding also defends against subtle attacks (e.g. Bleichenbacher padding oracles) — covered at depth in the ',
      el('a', { href: LINKS.rsaForge, target: '_blank', rel: 'noopener' }, ['RSA Forge lab']),
      '. Production code should always use OAEP (encryption) or PSS (signatures), never raw RSA.',
    ]),
  ]);
}

/**
 * Live malleability demo: encrypt two plaintexts a and b, MULTIPLY the ciphertexts
 * mod n, decrypt the product, and show it equals a·b mod n — proving an attacker
 * with no key can forge Enc(a·b) from Enc(a) and Enc(b). All real modexp; nothing
 * faked. a and b are chosen so a·b < n so the product is recovered exactly.
 */
function renderMalleability(host: HTMLElement, k: Keypair): void {
  clear(host);
  const n = k.pub.n;
  // Choose two small factors whose product stays below n (so a·b mod n = a·b).
  let a = 3n;
  let b = 5n;
  if (a * b >= n) { a = 2n; b = n > 6n ? 3n : 2n; }
  if (a >= n) a = n - 1n;
  if (b >= n) b = n - 1n;

  const ca = encrypt(asPlaintext(a % n, n), k.pub).value;
  const cb = encrypt(asPlaintext(b % n, n), k.pub).value;
  const cProduct = (ca * cb) % n;           // attacker multiplies ciphertexts — no key needed
  const recovered = decrypt(cProduct, k.priv).value; // what the product decrypts to
  const expected = (a * b) % n;             // product of the plaintexts
  const match = recovered === expected;

  host.append(
    el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, [`a = ${a},  Enc(a)`]), codeBox(ca.toString(), 'ca')]),
    el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, [`b = ${b},  Enc(b)`]), codeBox(cb.toString(), 'cb')]),
    el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['Attacker multiplies: Enc(a)·Enc(b) mod n']), codeBox(cProduct.toString(), 'product')]),
    el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['That decrypts to']), codeBox(recovered.toString(), 'recovered')]),
    el('div', { class: `verdict ${match ? 'bad' : 'good'}` }, [
      match
        ? `⚠ Equals a·b = ${a}·${b} = ${expected} — the attacker forged Enc(a·b) without the key`
        : 'unexpected',
    ]),
    el('p', { class: 'fine' }, [
      'OAEP prepends a random seed and a hash-based mask before exponentiating, so a ',
      'ciphertext product decrypts to padding garbage that fails the integrity check — ',
      'the homomorphic structure above is gone.',
    ]),
  );
}
