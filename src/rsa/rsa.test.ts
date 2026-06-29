import { describe, expect, it } from 'vitest';
import { generateKeypair, KeygenError, randomKeypair, selfCheck, validExponents } from './keygen';
import { decodeMessage, decrypt, encodeMessage, encrypt, sign, verify } from './textbook';
import { asPlaintext, PlaintextRangeError } from './types';
import { breakKey, factor, projectFactoringYears, recoverPrivateExponent } from './factor';
import { modexp } from './bigint-math';

const k = generateKeypair(61n, 53n, 17n); // n = 3233, φ = 3120, classic textbook example
const kBig = generateKeypair(257n, 263n, 3n); // n = 67591, holds a 2-char message

describe('keygen validation (Invariant #2)', () => {
  it('builds the canonical RSA example (d = 2753)', () => {
    expect(k.pub.n).toBe(3233n);
    expect(k.phi).toBe(3120n);
    expect(k.priv.d).toBe(2753n);
    expect((k.pub.e * k.priv.d) % k.phi).toBe(1n);
  });

  it('rejects non-prime p or q', () => {
    expect(() => generateKeypair(60n, 53n, 17n)).toThrow(KeygenError);
    expect(() => generateKeypair(61n, 52n, 17n)).toThrow(KeygenError);
  });

  it('rejects p == q', () => {
    expect(() => generateKeypair(61n, 61n, 17n)).toThrow(/distinct/);
  });

  it('rejects e with gcd(e, φ) ≠ 1', () => {
    // 3120 = 2^4·3·5·13, so e = 5 shares a factor
    expect(() => generateKeypair(61n, 53n, 5n)).toThrow(/no modular inverse|coprime/);
  });

  it('rejects e ≤ 1 and e ≥ φ', () => {
    expect(() => generateKeypair(61n, 53n, 1n)).toThrow(KeygenError);
    expect(() => generateKeypair(61n, 53n, 3120n)).toThrow(KeygenError);
  });

  it('only offers coprime exponents in the UI selector', () => {
    for (const e of validExponents(k.phi)) {
      expect(k.phi % e === 0n).toBe(false);
    }
  });
});

describe('encrypt/decrypt round-trip (Invariant #3)', () => {
  it('dec(enc(m)) = m for all m < n', () => {
    for (let m = 0n; m < k.pub.n; m += 7n) {
      const pt = asPlaintext(m, k.pub.n);
      const c = encrypt(pt, k.pub).value;
      expect(decrypt(c, k.priv).value).toBe(m);
    }
  });

  it('round-trips across several random keypairs', () => {
    for (let i = 0; i < 5; i++) {
      const kp = randomKeypair(14);
      expect(selfCheck(kp, 12345n)).toBe(true);
      const m = asPlaintext(99n % kp.pub.n, kp.pub.n);
      expect(decrypt(encrypt(m, kp.pub).value, kp.priv).value).toBe(m);
    }
  });

  it('textbook encryption is deterministic (the leak the OAEP panel contrasts)', () => {
    const m = encodeMessage('Hi', kBig.pub.n);
    expect(encrypt(m, kBig.pub).value).toBe(encrypt(m, kBig.pub).value);
  });

  it('encodeMessage/decodeMessage round-trips short text', () => {
    const m = encodeMessage('Yo', kBig.pub.n);
    expect(decodeMessage(m)).toBe('Yo');
    // and survives the full encrypt→decrypt cycle
    expect(decodeMessage(decrypt(encrypt(m, kBig.pub).value, kBig.priv).value)).toBe('Yo');
  });
});

describe('plaintext range (Invariant #6)', () => {
  it('rejects m ≥ n instead of silently wrapping', () => {
    expect(() => asPlaintext(k.pub.n, k.pub.n)).toThrow(PlaintextRangeError);
    expect(() => asPlaintext(k.pub.n + 1n, k.pub.n)).toThrow(PlaintextRangeError);
    expect(() => encodeMessage('this string is far too long to fit', k.pub.n)).toThrow(PlaintextRangeError);
  });

  it('fixed points m ∈ {0,1,n-1} encrypt to themselves', () => {
    for (const m of [0n, 1n, k.pub.n - 1n]) {
      expect(encrypt(asPlaintext(m, k.pub.n), k.pub).value).toBe(m);
    }
  });
});

describe('sign/verify', () => {
  it('accepts an untampered signature and rejects a tampered message', () => {
    const { signature } = sign('transfer $100', k.priv);
    expect(verify('transfer $100', signature, k.pub).ok).toBe(true);
    expect(verify('transfer $900', signature, k.pub).ok).toBe(false);
  });
});

describe('break demo (the weak-key claim, Invariant #5)', () => {
  it('trial division recovers p, q for the small key', () => {
    const f = factor(k.pub.n, 'trial-division');
    expect(f).not.toBeNull();
    expect(f!.p * f!.q).toBe(k.pub.n);
    expect(new Set([f!.p, f!.q])).toEqual(new Set([53n, 61n]));
  });

  it('pollard-rho also factors the small key', () => {
    const f = factor(k.pub.n, 'pollard-rho');
    expect(f).not.toBeNull();
    expect(f!.p * f!.q).toBe(k.pub.n);
  });

  it('recovered d matches the real d and decrypts a known ciphertext', () => {
    const broken = breakKey(k.pub, 'trial-division');
    expect(broken).not.toBeNull();
    expect(broken!.d).toBe(k.priv.d);
    const c = modexp(65n, k.pub.e, k.pub.n);
    expect(modexp(c, broken!.d, k.pub.n)).toBe(65n);
  });

  it('recoverPrivateExponent is consistent with keygen', () => {
    expect(recoverPrivateExponent(k.pub, 61n, 53n)).toBe(k.priv.d);
  });

  it('projects an astronomical cost for a 2048-bit key (never actually run)', () => {
    expect(projectFactoringYears(2048)).toBeGreaterThan(1e9);
  });
});
