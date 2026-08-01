// Related demos — cross-links to sibling labs (fleet-standard footer).
// Points learners from textbook RSA to the attack lab and the post-quantum
// schemes built to replace RSA once large quantum computers arrive.

import { el } from './dom';
import { LINKS } from '../rsa/links';

interface Related {
  href: string;
  name: string;
  blurb: string;
}

const RELATED: Related[] = [
  {
    href: LINKS.rsaForge,
    name: 'RSA Forge',
    blurb: 'Real RSA attacks — Håstad broadcast and a live Bleichenbacher padding oracle.',
  },
  {
    href: LINKS.kyberVault,
    name: 'Kyber Vault',
    blurb: 'ML-KEM (FIPS 203) — the post-quantum key encapsulation built to replace RSA key transport.',
  },
  {
    href: LINKS.dilithiumSeal,
    name: 'Dilithium Seal',
    blurb: 'ML-DSA (FIPS 204) — the post-quantum replacement for RSA/ECDSA signatures.',
  },
  {
    href: LINKS.shor,
    name: 'Shor',
    blurb: "Shor's algorithm — the quantum period-finding attack that factors RSA moduli.",
  },
];

export function relatedPanel(): HTMLElement {
  return el('section', { class: 'panel', id: 'related' }, [
    el('h2', {}, ['Related demos']),
    el('p', { class: 'lede' }, [
      'RSA is the starting point. These sibling labs cover its attacks and the schemes built to outlive it.',
    ]),
    el(
      'ul',
      { class: 'related-list' },
      RELATED.map((r) =>
        el('li', {}, [
          el('a', { href: r.href, target: '_blank', rel: 'noopener' }, [r.name]),
          el('span', { class: 'related-blurb' }, [` — ${r.blurb}`]),
        ]),
      ),
    ),
    el('p', { class: 'fine' }, [
      'One of 170+ live browser demos in the ',
      el('a', { href: LINKS.suite, target: '_blank', rel: 'noopener' }, ['Crypto Lab suite']),
      '.',
    ]),
  ]);
}
