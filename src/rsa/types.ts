// Branded types so an invalid value cannot reach the wrong function by mistake.
// Invariant #6 (m < n) is enforced at the type boundary: textbook.encrypt only
// accepts a Plaintext, and the only way to build one is asPlaintext(m, n) which
// rejects m >= n.

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export interface PublicKey {
  readonly n: bigint;
  readonly e: bigint;
}

export interface PrivateKey {
  readonly n: bigint;
  readonly d: bigint;
}

export interface Keypair {
  readonly pub: PublicKey;
  readonly priv: PrivateKey;
  readonly p: bigint;
  readonly q: bigint;
  readonly phi: bigint;
}

/** A message integer proven to satisfy 0 <= m < n. */
export type Plaintext = Brand<bigint, 'Plaintext'>;

export class PlaintextRangeError extends Error {
  constructor(public readonly m: bigint, public readonly n: bigint) {
    super(
      `message m = ${m} is not in range [0, n) for n = ${n}. ` +
        `Only residues mod n are recoverable — m ≥ n wraps and loses data.`,
    );
    this.name = 'PlaintextRangeError';
  }
}

/** The only constructor for Plaintext. Rejects m < 0 or m >= n. */
export function asPlaintext(m: bigint, n: bigint): Plaintext {
  if (m < 0n || m >= n) throw new PlaintextRangeError(m, n);
  return m as Plaintext;
}
