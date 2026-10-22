// Section 2 — Interactive key generation. Owns the shared key (store).

import {
  generateKeypair,
  keygenTrace,
  KeygenError,
  MAX_EDUCATIONAL_PRIME,
  randomKeypair,
  validExponents,
} from '../rsa/keygen';
import { isProbablePrime } from '../rsa/bigint-math';
import { el, clear } from './dom';
import { renderSteps } from './step-trace';
import { setKey } from './store';

const SMALL_PRIMES = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 257, 263];

export function keygenPanel(): HTMLElement {
  // Defaults give n = 67591 (16 bits) — small enough to factor instantly, big enough
  // to hold a 2-character message so the encrypt/real-world panels work on first load.
  const primeAttrs = { type: 'number', min: '2', max: MAX_EDUCATIONAL_PRIME.toString(), step: '1', inputmode: 'numeric', class: 'num' };
  const pInput = el('input', { ...primeAttrs, id: 'kg-p', value: '257' }) as HTMLInputElement;
  const qInput = el('input', { ...primeAttrs, id: 'kg-q', value: '263' }) as HTMLInputElement;
  const eSelect = el('select', { id: 'kg-e', class: 'num' }) as HTMLSelectElement;
  const status = el('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const trace = el('div', { class: 'trace-host' });

  function refreshExponents(): void {
    clear(eSelect);
    let p: bigint;
    let q: bigint;
    try {
      p = readPrimeInput('p', pInput);
      q = readPrimeInput('q', qInput);
    } catch {
      return;
    }
    // Reject the cheap range boundary before Miller-Rabin so a pasted enormous
    // integer cannot turn an input event into expensive synchronous work.
    if (p > MAX_EDUCATIONAL_PRIME || q > MAX_EDUCATIONAL_PRIME) return;
    if (!isProbablePrime(p) || !isProbablePrime(q) || p === q) return;
    const phi = (p - 1n) * (q - 1n);
    for (const e of validExponents(phi)) {
      eSelect.append(el('option', { value: e.toString() }, [e.toString()]));
    }
  }

  function build(): void {
    try {
      const p = readPrimeInput('p', pInput);
      const q = readPrimeInput('q', qInput);
      const e = BigInt(eSelect.value || '0');
      const k = generateKeypair(p, q, e);
      setKey(k);
      status.className = 'status ok';
      status.replaceChildren(el('span', {}, ['✓ valid keypair generated — shared with the panels below']));
      clear(trace);
      trace.append(renderSteps(keygenTrace(k)));
    } catch (err) {
      status.className = 'status bad';
      const msg = err instanceof KeygenError ? err.message : (err as Error).message;
      const kids: Array<Node | string> = [el('span', {}, ['⚠ ' + msg])];
      if (err instanceof KeygenError) {
        kids.push(
          el('a', { class: 'status-link', href: '#breaks' }, [
            '→ See exactly how a weak modulus falls in Section 5',
          ]),
        );
      }
      status.replaceChildren(...kids);
      clear(trace);
    }
  }

  pInput.addEventListener('input', refreshExponents);
  qInput.addEventListener('input', refreshExponents);

  const datalist = el('datalist', { id: 'small-primes' }, SMALL_PRIMES.map((p) => el('option', { value: String(p) })));
  pInput.setAttribute('list', 'small-primes');
  qInput.setAttribute('list', 'small-primes');

  const panel = el('section', { class: 'panel', id: 'keygen' }, [
    el('h2', {}, ['2 · Generate a key, step by step']),
    el('p', { class: 'lede' }, ['Choose two small primes from 2 through 65,537, or roll random ones. Every intermediate value is shown — nothing is hidden.']),
    datalist,
    el('div', { class: 'controls' }, [
      labelled('Prime p', pInput),
      labelled('Prime q', qInput),
      labelled('Exponent e', eSelect),
      el('button', { id: 'kg-generate', type: 'button', class: 'btn primary', onclick: build }, ['Generate']),
      el('button', {
        id: 'kg-random',
        type: 'button',
        class: 'btn',
        onclick: () => {
          const k = randomKeypair(16);
          pInput.value = k.p.toString();
          qInput.value = k.q.toString();
          refreshExponents();
          eSelect.value = k.pub.e.toString();
          build();
        },
      }, ['🎲 Roll random primes']),
      el('button', {
        id: 'kg-weak',
        type: 'button',
        class: 'btn ghost',
        title: 'A deliberately weak choice',
        onclick: () => {
          pInput.value = '3';
          qInput.value = '3';
          refreshExponents();
          build();
        },
      }, ['Try a too-small / repeated prime']),
    ]),
    status,
    trace,
    phiAside(),
  ]);

  // initial render
  refreshExponents();
  eSelect.value = '17';
  build();
  return panel;
}

function readPrimeInput(label: 'p' | 'q', input: HTMLInputElement): bigint {
  const raw = input.value.trim();
  if (!/^\d+$/.test(raw)) {
    throw new KeygenError(`${label} must be a whole decimal integer.`);
  }
  return BigInt(raw);
}

/** Plain-language gloss for the least-motivated symbol in the flow: φ(n). */
function phiAside(): HTMLElement {
  return el('aside', { class: 'phi-aside', 'aria-label': 'What φ(n) means' }, [
    el('span', { class: 'phi-aside__tag' }, ['WHAT IS φ?']),
    el('p', {}, [
      el('strong', {}, ['φ(n)']),
      ' counts how many numbers below n share ',
      el('em', {}, ['no']),
      ' common factor with n. For n = p·q that is exactly (p−1)(q−1). ',
      'It is the size of the group of invertible residues, so exponents ',
      'repeat with period φ — which is why d is taken as the inverse of e ',
      el('strong', {}, ['mod φ']),
      ', not mod n: we are inverting e in the exponent, and exponents live mod φ.',
    ]),
  ]);
}

function labelled(text: string, control: HTMLElement): HTMLElement {
  const id = control.id || text;
  control.id = id;
  return el('div', { class: 'field' }, [el('label', { for: id }, [text]), control]);
}
