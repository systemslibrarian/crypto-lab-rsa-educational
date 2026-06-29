// Inspectable RSA arithmetic in native BigInt. No floating point, no faked math.
// Every function here is independently checkable and unit-tested.

/** Greatest common divisor (Euclid). */
export function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** Extended Euclid: returns [g, x, y] with a*x + b*y = g = gcd(a, b). */
export function egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  let [old_r, r] = [a, b];
  let [old_s, s] = [1n, 0n];
  let [old_t, t] = [0n, 1n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
    [old_t, t] = [t, old_t - q * t];
  }
  return [old_r, old_s, old_t];
}

/** Modular inverse of a mod m. Throws if gcd(a, m) !== 1 (no inverse exists). */
export function modinv(a: bigint, m: bigint): bigint {
  const [g, x] = egcd(((a % m) + m) % m, m);
  if (g !== 1n) {
    throw new Error(`no modular inverse: gcd(${a}, ${m}) = ${g} ≠ 1`);
  }
  return ((x % m) + m) % m;
}

/** Square-and-multiply modular exponentiation: base^exp mod mod. */
export function modexp(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  if (exp < 0n) throw new Error('negative exponent');
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

/** One step of square-and-multiply, for the UI's expandable trace. */
export interface ModexpStep {
  bit: 0 | 1;
  square: bigint;
  multiplied: boolean;
  acc: bigint;
}

/** Same result as modexp, but returns the per-bit trace for teaching. */
export function modexpTraced(base: bigint, exp: bigint, mod: bigint): { result: bigint; steps: ModexpStep[] } {
  const steps: ModexpStep[] = [];
  let result = 1n;
  let b = base % mod;
  // Process exponent bits LSB→MSB, mirroring the loop above.
  let e = exp;
  while (e > 0n) {
    const bit = Number(e & 1n) as 0 | 1;
    const multiplied = bit === 1;
    if (multiplied) result = (result * b) % mod;
    const square = (b * b) % mod;
    steps.push({ bit, square, multiplied, acc: result });
    b = square;
    e >>= 1n;
  }
  return { result, steps };
}

const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

/**
 * Miller-Rabin probabilistic primality test. Deterministic for the small numbers
 * this demo uses; with enough rounds it correctly rejects Carmichael numbers that
 * a naive Fermat test would accept.
 */
export function isProbablePrime(n: bigint, rounds = 40): boolean {
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  // write n-1 as d * 2^r
  let d = n - 1n;
  let r = 0n;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    r += 1n;
  }
  const witnesses = randomWitnesses(n, rounds);
  WitnessLoop: for (const a of witnesses) {
    let x = modexp(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 0n; i < r - 1n; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue WitnessLoop;
    }
    return false;
  }
  return true;
}

function randomWitnesses(n: bigint, rounds: number): bigint[] {
  const out: bigint[] = [];
  for (let i = 0; i < rounds; i++) {
    // a in [2, n-2]
    const a = 2n + randBelow(n - 3n);
    out.push(a);
  }
  return out;
}

/** Uniform random BigInt in [0, bound) using crypto-grade randomness. */
export function randBelow(bound: bigint): bigint {
  if (bound <= 0n) return 0n;
  const bits = bound.toString(2).length;
  const bytes = Math.ceil(bits / 8);
  // rejection sampling for an unbiased value
  // (loop terminates with overwhelming probability after a couple of tries)
  for (;;) {
    let x = randomBits(bytes);
    // mask to bit-length to keep rejection rate < 1/2
    const excess = BigInt(bytes * 8 - bits);
    x >>= excess;
    if (x < bound) return x;
  }
}

function randomBits(bytes: number): bigint {
  const buf = new Uint8Array(bytes);
  cryptoSource().getRandomValues(buf);
  let x = 0n;
  for (const b of buf) x = (x << 8n) | BigInt(b);
  return x;
}

function cryptoSource(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.getRandomValues) throw new Error('WebCrypto getRandomValues unavailable');
  return c;
}

/** Generate a probable prime of approximately `bits` bits. */
export function randomPrime(bits: number): bigint {
  if (bits < 2) throw new Error('bits must be >= 2');
  const low = 1n << BigInt(bits - 1);
  const span = low; // [2^(bits-1), 2^bits)
  for (;;) {
    let candidate = low + randBelow(span);
    candidate |= 1n; // make it odd
    if (isProbablePrime(candidate)) return candidate;
  }
}
