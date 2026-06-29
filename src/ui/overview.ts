// Section 1 — Quick RSA overview: the trapdoor metaphor + key diagram.

import { el } from './dom';

export function overviewPanel(): HTMLElement {
  return el('section', { class: 'panel', id: 'overview' }, [
    el('h2', {}, ['1 · The big idea: a trapdoor']),
    el('p', { class: 'lede' }, [
      'Multiplying two prime numbers is easy. Factoring the product back into those primes is hard. ',
      'RSA is built entirely on that gap — the easy door swings one way only.',
    ]),
    el('div', { class: 'trapdoor' }, [
      el('div', { class: 'trapdoor__side ok' }, [
        el('span', { class: 'trapdoor__icon', 'aria-hidden': 'true' }, ['→']),
        el('strong', {}, ['Easy: multiply']),
        el('p', {}, ['p × q = n. A computer does this instantly, even for 600-digit primes.']),
      ]),
      el('div', { class: 'trapdoor__side hard' }, [
        el('span', { class: 'trapdoor__icon', 'aria-hidden': 'true' }, ['⟂']),
        el('strong', {}, ['Hard: factor']),
        el('p', {}, ['Given only n, recover p and q. For a 2048-bit n, no one can — that is the lock.']),
      ]),
    ]),
    el('div', { class: 'keycards' }, [
      el('div', { class: 'keycard pub' }, [
        el('h3', {}, ['🔓 Public key (n, e)']),
        el('p', {}, ['Shared with anyone. Used to encrypt to you, and to verify your signatures.']),
      ]),
      el('div', { class: 'keycard priv' }, [
        el('h3', {}, ['🔑 Private key (d, n)']),
        el('p', {}, ['Kept secret. Used to decrypt messages sent to you, and to sign.']),
      ]),
    ]),
  ]);
}
