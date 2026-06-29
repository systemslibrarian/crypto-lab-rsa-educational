// Textbook (raw, no-padding) RSA over BigInt. THIS IS DELIBERATELY INSECURE and is
// labeled so everywhere it surfaces (Invariant #4). It exists to make the math
// inspectable, NOT to be used for real. The randomized OAEP path (oaep.ts) is the
// only path framed as production-appropriate.

import { modexp, modexpTraced } from './bigint-math';
import type { ModexpStep } from './bigint-math';
import { asPlaintext } from './types';
import type { Plaintext, PrivateKey, PublicKey } from './types';

/** Marker carried on every textbook result so the UI can never render it as "safe". */
export const INSECURE = 'textbook RSA — no padding, teaching only' as const;

export interface TextbookResult {
  value: bigint;
  steps: ModexpStep[];
  readonly insecure: typeof INSECURE;
}

/** c = m^e mod n. Deterministic: identical m always yields identical c (a leak). */
export function encrypt(m: Plaintext, pub: PublicKey): TextbookResult {
  const { result, steps } = modexpTraced(m, pub.e, pub.n);
  return { value: result, steps, insecure: INSECURE };
}

/** m = c^d mod n. */
export function decrypt(c: bigint, priv: PrivateKey): TextbookResult {
  const { result, steps } = modexpTraced(c % priv.n, priv.d, priv.n);
  return { value: result, steps, insecure: INSECURE };
}

/**
 * A small SYNCHRONOUS stand-in for a real cryptographic hash (FNV-1a, reduced mod n).
 * Real RSA signs SHA-256(message); we use a toy hash purely so the signing trace is
 * inspectable and synchronous. Labeled toy so nobody mistakes it for SHA-256.
 */
export function toyHash(message: string, n: bigint): bigint {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = (1n << 64n) - 1n;
  for (let i = 0; i < message.length; i++) {
    h ^= BigInt(message.charCodeAt(i));
    h = (h * prime) & mask;
  }
  const reduced = h % n;
  return reduced === 0n ? 1n : reduced;
}

/** s = H(m)^d mod n. */
export function sign(message: string, priv: PrivateKey): { signature: bigint; digest: bigint } {
  const digest = toyHash(message, priv.n);
  const signature = modexp(digest, priv.d, priv.n);
  return { signature, digest };
}

/** Verify by recovering H(m) = s^e mod n and comparing to a fresh hash of the message. */
export function verify(message: string, signature: bigint, pub: PublicKey): { ok: boolean; recovered: bigint; expected: bigint } {
  const expected = toyHash(message, pub.n);
  const recovered = modexp(signature, pub.e, pub.n);
  return { ok: recovered === expected, recovered, expected };
}

/** Encode a short ASCII string as a single integer < n, or throw via asPlaintext. */
export function encodeMessage(text: string, n: bigint): Plaintext {
  let acc = 0n;
  for (let i = 0; i < text.length; i++) acc = (acc << 8n) | BigInt(text.charCodeAt(i) & 0xff);
  return asPlaintext(acc, n);
}

/** Inverse of encodeMessage. */
export function decodeMessage(m: bigint): string {
  if (m === 0n) return '';
  const bytes: number[] = [];
  let x = m;
  while (x > 0n) {
    bytes.unshift(Number(x & 0xffn));
    x >>= 8n;
  }
  return String.fromCharCode(...bytes);
}
