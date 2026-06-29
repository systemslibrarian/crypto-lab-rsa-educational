// Small-n factoring for the "what breaks at scale" demo. A strategy registry so new
// algorithms are additive (Invariant: this only ever runs on the small educational
// key; the realistic key is a labeled projection that is never factored here).

import { gcd, modinv } from './bigint-math';
import type { Keypair, PublicKey } from './types';

export interface FactorResult {
  p: bigint;
  q: bigint;
  strategy: string;
  iterations: number;
  ms: number; // filled by the caller (stamping time is a UI concern)
}

export type FactorStrategy = (n: bigint) => { p: bigint; q: bigint; iterations: number } | null;

const registry = new Map<string, FactorStrategy>();

/** Register a factoring strategy. // [extension] point — add Fermat, QS, etc. here. */
export function register(name: string, fn: FactorStrategy): void {
  registry.set(name, fn);
}

export function strategies(): string[] {
  return [...registry.keys()];
}

function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('isqrt of negative');
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) >> 1n;
  while (y < x) {
    x = y;
    y = (x + n / x) >> 1n;
  }
  return x;
}

register('trial-division', (n) => {
  let iterations = 0;
  if (n % 2n === 0n) return { p: 2n, q: n / 2n, iterations };
  const limit = isqrt(n);
  for (let i = 3n; i <= limit; i += 2n) {
    iterations++;
    if (n % i === 0n) return { p: i, q: n / i, iterations };
  }
  return null;
});

register('pollard-rho', (n) => {
  if (n % 2n === 0n) return { p: 2n, q: n / 2n, iterations: 0 };
  let iterations = 0;
  // f(x) = x^2 + c mod n, Floyd cycle detection
  for (let c = 1n; c < 100n; c++) {
    let x = 2n;
    let y = 2n;
    let d = 1n;
    const f = (v: bigint) => (v * v + c) % n;
    while (d === 1n) {
      iterations++;
      x = f(x);
      y = f(f(y));
      const diff = x > y ? x - y : y - x;
      d = gcd(diff, n);
      if (iterations > 1_000_000) return null;
    }
    if (d !== n) return { p: d, q: n / d, iterations };
  }
  return null;
});

/** Factor n with the named strategy (default trial-division). Returns null on failure. */
export function factor(n: bigint, strategy = 'trial-division'): Omit<FactorResult, 'ms'> | null {
  const fn = registry.get(strategy);
  if (!fn) throw new Error(`unknown factoring strategy: ${strategy}`);
  const res = fn(n);
  if (!res) return null;
  const [p, q] = res.p <= res.q ? [res.p, res.q] : [res.q, res.p];
  return { p, q, strategy, iterations: res.iterations };
}

/** Given a public key and recovered factors, reconstruct the private exponent d. */
export function recoverPrivateExponent(pub: PublicKey, p: bigint, q: bigint): bigint {
  const phi = (p - 1n) * (q - 1n);
  return modinv(pub.e, phi);
}

/** Convenience for the break demo + tests: factor, then rebuild the whole private key. */
export function breakKey(pub: PublicKey, strategy = 'trial-division'): { factors: Omit<FactorResult, 'ms'>; d: bigint } | null {
  const factors = factor(pub.n, strategy);
  if (!factors) return null;
  const d = recoverPrivateExponent(pub, factors.p, factors.q);
  return { factors, d };
}

/** Rough, ILLUSTRATIVE cost projection for a realistic key — never actually run.
 *  Uses the GNFS heuristic exponent to convey "astronomical", not a real benchmark. */
export function projectFactoringYears(bits: number): number {
  // L(n) = exp( (1.923) * (ln n)^(1/3) * (ln ln n)^(2/3) ), ops; assume 1e12 ops/sec.
  const lnN = bits * Math.LN2;
  const lnlnN = Math.log(lnN);
  const ops = Math.exp(1.923 * Math.cbrt(lnN) * Math.pow(lnlnN, 2 / 3));
  const opsPerSec = 1e12;
  return ops / opsPerSec / (60 * 60 * 24 * 365);
}

export type { Keypair };
