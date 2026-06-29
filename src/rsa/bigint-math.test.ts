import { describe, expect, it } from 'vitest';
import { egcd, gcd, isProbablePrime, modexp, modexpTraced, modinv, randomPrime } from './bigint-math';

describe('modexp', () => {
  it('matches (m ** e) % n across many vectors', () => {
    const cases: Array<[bigint, bigint, bigint]> = [];
    for (let i = 0; i < 200; i++) {
      const m = BigInt(2 + ((i * 7) % 50));
      const e = BigInt(1 + ((i * 13) % 40));
      const n = BigInt(101 + ((i * 31) % 5000));
      cases.push([m, e, n]);
    }
    for (const [m, e, n] of cases) {
      expect(modexp(m, e, n)).toBe(m ** e % n);
    }
  });

  it('handles mod 1 and exponent 0', () => {
    expect(modexp(5n, 0n, 7n)).toBe(1n);
    expect(modexp(5n, 3n, 1n)).toBe(0n);
  });

  it('traced result equals untraced result', () => {
    for (let i = 0; i < 50; i++) {
      const m = BigInt(2 + i);
      const e = BigInt(3 + i * 2);
      const n = BigInt(97 + i * 11);
      expect(modexpTraced(m, e, n).result).toBe(modexp(m, e, n));
    }
  });
});

describe('egcd / modinv', () => {
  it('egcd satisfies a*x + b*y = g', () => {
    for (let a = 1; a <= 40; a++) {
      for (let b = 1; b <= 40; b++) {
        const [g, x, y] = egcd(BigInt(a), BigInt(b));
        expect(BigInt(a) * x + BigInt(b) * y).toBe(g);
        expect(g).toBe(gcd(BigInt(a), BigInt(b)));
      }
    }
  });

  it('modinv gives a*inv ≡ 1 (mod m)', () => {
    const ms = [97n, 3120n, 40n, 65537n];
    for (const m of ms) {
      for (let a = 2n; a < 30n; a++) {
        if (gcd(a, m) !== 1n) continue;
        const inv = modinv(a, m);
        expect((a * inv) % m).toBe(1n);
      }
    }
  });

  it('modinv throws when no inverse exists', () => {
    expect(() => modinv(6n, 9n)).toThrow();
  });
});

describe('isProbablePrime', () => {
  it('accepts known primes', () => {
    for (const p of [2n, 3n, 5n, 7n, 61n, 97n, 7919n, 104729n, 1000003n]) {
      expect(isProbablePrime(p)).toBe(true);
    }
  });

  it('rejects composites including Carmichael numbers a Fermat test would miss', () => {
    for (const c of [1n, 4n, 9n, 15n, 100n, 561n, 1105n, 1729n, 2465n, 2821n, 6601n]) {
      expect(isProbablePrime(c)).toBe(false);
    }
  });
});

describe('randomPrime', () => {
  it('produces primes of the requested bit-size', () => {
    for (let i = 0; i < 10; i++) {
      const p = randomPrime(16);
      expect(isProbablePrime(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(1n << 15n);
      expect(p).toBeLessThan(1n << 16n);
    }
  });
});
