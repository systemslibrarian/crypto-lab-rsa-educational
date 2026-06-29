// Key generation and validation with an ordered step-trace for the UI.
// Invariant #2: every invalid parameter set is rejected BEFORE a key is produced.

import { gcd, isProbablePrime, modexp, modinv, randomPrime } from './bigint-math';
import type { Keypair } from './types';

export interface KeygenStep {
  label: string;
  value: string;
  note?: string;
}

export class KeygenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeygenError';
  }
}

/** Smallest valid public exponent for a given phi (prefers the conventional 65537). */
export function chooseExponent(phi: bigint): bigint {
  if (gcd(65537n, phi) === 1n && 65537n < phi) return 65537n;
  for (let e = 3n; e < phi; e += 2n) {
    if (gcd(e, phi) === 1n) return e;
  }
  throw new KeygenError(`no valid public exponent found for φ = ${phi}`);
}

/** All small exponents coprime to phi, for the UI's e-selector (bounded list). */
export function validExponents(phi: bigint, limit = 12): bigint[] {
  const out: bigint[] = [];
  for (let e = 3n; e < phi && out.length < limit; e += 2n) {
    if (gcd(e, phi) === 1n) out.push(e);
  }
  if (gcd(65537n, phi) === 1n && 65537n < phi && !out.includes(65537n)) out.push(65537n);
  return out;
}

/**
 * Build a keypair from explicit p, q, e. Validates each parameter and throws a
 * KeygenError with a teaching message on any violation.
 */
export function generateKeypair(p: bigint, q: bigint, e: bigint): Keypair {
  if (!isProbablePrime(p)) throw new KeygenError(`p = ${p} is not prime. RSA's security and the φ formula both require p to be prime.`);
  if (!isProbablePrime(q)) throw new KeygenError(`q = ${q} is not prime. RSA's security and the φ formula both require q to be prime.`);
  if (p === q) throw new KeygenError(`p and q must be distinct. If p = q then n = p² is trivially factorable and φ = p(p−1), not (p−1)(q−1).`);

  const n = p * q;
  const phi = (p - 1n) * (q - 1n);

  if (e <= 1n) throw new KeygenError(`e must be > 1. e = 1 leaves the message unencrypted.`);
  if (e >= phi) throw new KeygenError(`e must be < φ(n) = ${phi}.`);
  if (gcd(e, phi) !== 1n) {
    throw new KeygenError(`gcd(e, φ) = ${gcd(e, phi)} ≠ 1, so e has no modular inverse and no private key d exists. Pick an e coprime to φ = ${phi}.`);
  }

  const d = modinv(e, phi);
  // Invariant #2: accept d only if it actually inverts e mod phi.
  if ((e * d) % phi !== 1n) throw new KeygenError(`internal: derived d does not satisfy e·d ≡ 1 (mod φ).`);

  return { pub: { n, e }, priv: { n, d }, p, q, phi };
}

/** Generate a random small keypair near the requested bit-size per prime. */
export function randomKeypair(bitsPerPrime = 16): Keypair {
  for (;;) {
    const p = randomPrime(bitsPerPrime);
    let q = randomPrime(bitsPerPrime);
    while (q === p) q = randomPrime(bitsPerPrime);
    const phi = (p - 1n) * (q - 1n);
    const e = chooseExponent(phi);
    return generateKeypair(p, q, e);
  }
}

/** Ordered, human-readable trace of the derivation for the keygen panel. */
export function keygenTrace(k: Keypair): KeygenStep[] {
  const checkMsg = (k.pub.e * k.priv.d) % k.phi; // === 1n by construction
  return [
    { label: 'p (prime)', value: k.p.toString() },
    { label: 'q (prime)', value: k.q.toString() },
    { label: 'n = p · q', value: k.pub.n.toString(), note: 'public modulus' },
    { label: 'φ(n) = (p − 1)(q − 1)', value: k.phi.toString(), note: 'kept secret' },
    { label: 'e (public exponent)', value: k.pub.e.toString(), note: `gcd(e, φ) = ${gcd(k.pub.e, k.phi)}` },
    { label: 'd = e⁻¹ mod φ', value: k.priv.d.toString(), note: 'private exponent' },
    { label: 'check: e · d mod φ', value: checkMsg.toString(), note: 'must equal 1' },
  ];
}

/** Sanity self-check used in tests: encrypt/decrypt a probe round-trips. */
export function selfCheck(k: Keypair, probe = 42n): boolean {
  const m = probe % k.pub.n;
  const c = modexp(m, k.pub.e, k.pub.n);
  return modexp(c, k.priv.d, k.priv.n) === m;
}
