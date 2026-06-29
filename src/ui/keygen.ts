// Section 2 — Interactive key generation. Owns the shared key (store).

import { generateKeypair, keygenTrace, KeygenError, randomKeypair, validExponents } from '../rsa/keygen';
import { isProbablePrime } from '../rsa/bigint-math';
import { el, clear } from './dom';
import { renderSteps } from './step-trace';
import { setKey } from './store';

const SMALL_PRIMES = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 257, 263];

export function keygenPanel(): HTMLElement {
  // Defaults give n = 67591 (16 bits) — small enough to factor instantly, big enough
  // to hold a 2-character message so the encrypt/real-world panels work on first load.
  const pInput = el('input', { type: 'number', id: 'kg-p', value: '257', min: '2', class: 'num' }) as HTMLInputElement;
  const qInput = el('input', { type: 'number', id: 'kg-q', value: '263', min: '2', class: 'num' }) as HTMLInputElement;
  const eSelect = el('select', { id: 'kg-e', class: 'num' }) as HTMLSelectElement;
  const status = el('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const trace = el('div', { class: 'trace-host' });

  function refreshExponents(): void {
    const p = BigInt(pInput.value || '0');
    const q = BigInt(qInput.value || '0');
    clear(eSelect);
    if (!isProbablePrime(p) || !isProbablePrime(q) || p === q) return;
    const phi = (p - 1n) * (q - 1n);
    for (const e of validExponents(phi)) {
      eSelect.append(el('option', { value: e.toString() }, [e.toString()]));
    }
  }

  function build(): void {
    try {
      const p = BigInt(pInput.value);
      const q = BigInt(qInput.value);
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
      status.replaceChildren(el('span', {}, ['⚠ ' + msg]));
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
    el('p', { class: 'lede' }, ['Choose two small primes, or roll random ones. Every intermediate value is shown — nothing is hidden.']),
    datalist,
    el('div', { class: 'controls' }, [
      labelled('Prime p', pInput),
      labelled('Prime q', qInput),
      labelled('Exponent e', eSelect),
      el('button', { type: 'button', class: 'btn primary', onclick: build }, ['Generate']),
      el('button', {
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
  ]);

  // initial render
  refreshExponents();
  eSelect.value = '17';
  build();
  return panel;
}

function labelled(text: string, control: HTMLElement): HTMLElement {
  const id = control.id || text;
  control.id = id;
  return el('div', { class: 'field' }, [el('label', { for: id }, [text]), control]);
}
