import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Claims gate — asserts the load-bearing states the page actually claims, not
 * merely that it rendered. Every number checked here is read back out of the DOM
 * and re-derived independently in the test, so a verdict that disagrees with its
 * own arithmetic fails the suite instead of shipping.
 *
 * The a11y spec proves the page is reachable. This spec proves it is right.
 */

/** modexp, recomputed in the test so page output is checked against an independent source. */
function modexp(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

/** Pull the first BigInt out of a string (page values are decimal integers). */
function bigOf(text: string | null): bigint {
  const m = (text ?? '').replace(/[\s,]/g, '').match(/-?\d+/);
  if (!m) throw new Error(`no integer found in ${JSON.stringify(text)}`);
  return BigInt(m[0]);
}

/** Read a keygen trace row by its label prefix. */
async function step(page: Page, labelStartsWith: string): Promise<string> {
  const value = await page.locator('#keygen .steps').evaluate((host, prefix) => {
    for (const row of host.querySelectorAll('.step')) {
      const label = row.querySelector('.step__label')?.textContent ?? '';
      if (label.startsWith(prefix)) return row.querySelector('.step__value')?.textContent ?? '';
    }
    return null;
  }, labelStartsWith);
  if (value === null) throw new Error(`no keygen step labelled ${JSON.stringify(labelStartsWith)}`);
  return value.trim();
}

/** The whole shared key, as the page currently displays it. */
async function pageKey(page: Page): Promise<{ p: bigint; q: bigint; n: bigint; phi: bigint; e: bigint; d: bigint }> {
  return {
    p: bigOf(await step(page, 'p ')),
    q: bigOf(await step(page, 'q ')),
    n: bigOf(await step(page, 'n =')),
    phi: bigOf(await step(page, 'φ')),
    e: bigOf(await step(page, 'e ')),
    d: bigOf(await step(page, 'd =')),
  };
}

/** The `.io-row` whose label starts with the given text, scoped to a section. */
function ioRow(scope: Locator, labelContains: string): Locator {
  return scope.locator('.io-row').filter({ has: scope.page().locator('.io-row__label', { hasText: labelContains }) }).first();
}

async function rowValue(scope: Locator, labelContains: string): Promise<string> {
  return (await ioRow(scope, labelContains).locator('.codebox__value').innerText()).trim();
}

test.beforeEach(async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#keygen .status')).toHaveClass(/ok/);
});

// ---------------------------------------------------------------- Section 2

test('generated key is internally consistent: n = p·q, φ = (p−1)(q−1), e·d ≡ 1 mod φ', async ({ page }) => {
  const k = await pageKey(page);

  // The inputs the user actually sees drive the derivation.
  expect(await page.locator('#kg-p').inputValue()).toBe(k.p.toString());
  expect(await page.locator('#kg-q').inputValue()).toBe(k.q.toString());
  expect(await page.locator('#kg-e').inputValue()).toBe(k.e.toString());

  expect(k.n).toBe(k.p * k.q);
  expect(k.phi).toBe((k.p - 1n) * (k.q - 1n));
  expect((k.e * k.d) % k.phi).toBe(1n);

  // The page prints that same check itself; it must agree with ours.
  expect(await step(page, 'check')).toBe('1');
  await expect(page.locator('#keygen .status')).toContainText('valid keypair generated');
});

test('the key survives an actual round trip: 42^e^d ≡ 42 (mod n)', async ({ page }) => {
  const k = await pageKey(page);
  const probe = 42n % k.n;
  expect(modexp(modexp(probe, k.e, k.n), k.d, k.n)).toBe(probe);
});

test('rolling random primes produces a different but still-consistent key', async ({ page }) => {
  const before = await pageKey(page);
  await page.getByRole('button', { name: /Roll random primes/i }).click();
  await expect(page.locator('#keygen .status')).toHaveClass(/ok/);

  const after = await pageKey(page);
  expect(after.n).not.toBe(before.n);
  expect(after.n).toBe(after.p * after.q);
  expect(after.phi).toBe((after.p - 1n) * (after.q - 1n));
  expect((after.e * after.d) % after.phi).toBe(1n);
  expect(await step(page, 'check')).toBe('1');
});

// ------------------------------------------------- Section 2, failure paths

test('repeated prime is rejected, says why, and links forward to the break panel', async ({ page }) => {
  await page.getByRole('button', { name: /too-small \/ repeated prime/i }).click();

  const status = page.locator('#keygen .status');
  await expect(status).toHaveClass(/bad/);
  await expect(status).toContainText('p and q must be distinct');
  // The teaching link is the whole point of the failure path.
  await expect(status.locator('a.status-link')).toHaveAttribute('href', '#breaks');
  // A rejected parameter set must not leave a trace behind — no key was produced.
  await expect(page.locator('#keygen .steps')).toHaveCount(0);
});

test('a composite p is rejected before any key exists', async ({ page }) => {
  await page.locator('#kg-p').fill('9');
  await page.getByRole('button', { name: /^Generate$/ }).click();

  const status = page.locator('#keygen .status');
  await expect(status).toHaveClass(/bad/);
  await expect(status).toContainText('is not prime');
  await expect(page.locator('#keygen .steps')).toHaveCount(0);
});

// ---------------------------------------------------------------- Section 3

test('encrypt/decrypt round trip agrees with independently recomputed modexp', async ({ page }) => {
  const k = await pageKey(page);
  const enc = page.locator('#encrypt');

  const m = bigOf(await rowValue(enc, 'Message → integer m'));
  const c = bigOf(await rowValue(enc, 'Ciphertext'));
  const back = bigOf(await rowValue(enc, 'Decrypted'));

  // "Hi" packed base-256 — the encoding the page explains chip by chip.
  expect(m).toBe(BigInt('H'.charCodeAt(0)) * 256n + BigInt('i'.charCodeAt(0)));
  await expect(enc.locator('.enc-explain__result')).toContainText(`m = ${m}`);
  await expect(enc.locator('.enc-chip__code')).toHaveText(['72', '105']);

  expect(c).toBe(modexp(m, k.e, k.n));
  expect(back).toBe(m);
  await expect(ioRow(enc, 'Decrypted')).toHaveClass(/good/);
  await expect(ioRow(enc, 'Decrypted').locator('.codebox__value')).toContainText('"Hi"');
});

test('changing the message changes the ciphertext and still round-trips', async ({ page }) => {
  const k = await pageKey(page);
  const enc = page.locator('#encrypt');
  const before = bigOf(await rowValue(enc, 'Ciphertext'));

  await page.locator('#ed-msg').fill('Zz');
  await expect(ioRow(enc, 'Ciphertext').locator('.codebox__value')).not.toHaveText(before.toString());

  const m = bigOf(await rowValue(enc, 'Message → integer m'));
  expect(m).toBe(BigInt('Z'.charCodeAt(0)) * 256n + BigInt('z'.charCodeAt(0)));
  expect(bigOf(await rowValue(enc, 'Ciphertext'))).toBe(modexp(m, k.e, k.n));
  expect(bigOf(await rowValue(enc, 'Decrypted'))).toBe(m);
});

test('a message that will not fit under n is refused with the range reason', async ({ page }) => {
  const k = await pageKey(page);
  await page.locator('#ed-msg').fill('Hii'); // 0x486969 > n for the default key
  expect(BigInt(0x486969)).toBeGreaterThan(k.n);

  const status = page.locator('#encrypt .status');
  await expect(status).toHaveClass(/bad/);
  await expect(status).toContainText('is not in range');
  await expect(page.locator('#encrypt .io-out .io-row')).toHaveCount(0);
});

test('square-and-multiply operation counts add up to the total the page advertises', async ({ page }) => {
  const enc = page.locator('#encrypt');
  await enc.locator('details.trace summary').click();

  const lesson = (await enc.locator('.sam-lesson').innerText()).replace(/\s+/g, ' ');
  const parsed = lesson.match(/(\d+) squarings \+ (\d+) multiplies = (\d+) operations, not (\d+)/);
  expect(parsed, `unparsed lesson line: ${lesson}`).not.toBeNull();
  const [, squarings, multiplies, total, naive] = parsed!.map((v) => Number(v));

  // The advertised total is the sum of its own parts.
  expect(squarings + multiplies).toBe(total);
  // The comparison operand is the exponent itself. (At e = 3 the naive count is
  // smaller than the fast one — square-and-multiply only wins as the exponent
  // grows, which is what the real-exponent half of this test pins down.)
  expect(naive).toBe(3);

  // Default trace is the tiny exponent e = 3 (binary 11): 2 bits, 2 one-bits.
  expect(squarings).toBe(2);
  expect(multiplies).toBe(2);
  await expect(enc.locator('.sam-bit')).toHaveCount(2);
  await expect(enc.locator('.sam-bit.one')).toHaveCount(2);

  // Switching to the real key exponent must re-derive, not reuse, the counts.
  const k = await pageKey(page);
  await enc.getByRole('button', { name: new RegExp(`Real key exponent \\(e = ${k.e}\\)`) }).click();
  const realLesson = (await enc.locator('.sam-lesson').innerText()).replace(/\s+/g, ' ');
  const real = realLesson.match(/(\d+) squarings \+ (\d+) multiplies = (\d+) operations, not (\d+)/)!.map((v) => Number(v));
  expect(real[1]).toBe(k.e.toString(2).length);            // one squaring per exponent bit
  expect(real[2]).toBe([...k.e.toString(2)].filter((b) => b === '1').length); // one multiply per set bit
  expect(real[1] + real[2]).toBe(real[3]);
  expect(real[4]).toBe(Number(k.e));
  // At the real exponent the advertised saving is genuine.
  expect(real[3]).toBeLessThan(real[4]);
  await expect(enc.locator('.sam-bit')).toHaveCount(k.e.toString(2).length);
});

// -------------------------------------------------------------- Section 3½

test('the round-trip picture shows real values that close the loop', async ({ page }) => {
  const k = await pageKey(page);
  const nodes = page.locator('#roundtrip .flow-node__main');
  await expect(nodes).toHaveCount(5);

  const m = bigOf(await nodes.nth(1).innerText());
  const c = bigOf(await nodes.nth(2).innerText());
  const back = bigOf(await nodes.nth(3).innerText());

  expect(c).toBe(modexp(m, k.e, k.n));
  expect(back).toBe(m);
  // The picture only claims success when it actually got the message back.
  await expect(page.locator('#roundtrip .flow-node').nth(3)).toHaveClass(/ok/);
  await expect(page.locator('#roundtrip .flow-node').nth(4)).toHaveClass(/ok/);
  await expect(nodes.nth(4)).toHaveText('"Hi"');
});

test('the mod-n clock identity e·d = k·φ + 1 is arithmetically true, not decorative', async ({ page }) => {
  const k = await pageKey(page);
  const eqs = page.locator('#roundtrip .clock-identity__eq');

  const product = bigOf((await eqs.nth(0).innerText()).split('=').pop()!);
  expect(product).toBe(k.e * k.d);

  // "<ed> = <kMul> · φ + <remainder>   (φ = <phi>)"
  const hl = (await eqs.nth(1).innerText()).replace(/\s+/g, ' ');
  const parts = hl.match(/(\d+) = (\d+) · φ \+ (\d+)\s*\(φ = (\d+)\)/);
  expect(parts, `unparsed identity line: ${hl}`).not.toBeNull();
  const [ed, kMul, remainder, phi] = parts!.slice(1).map((v) => BigInt(v));

  expect(ed).toBe(product);
  expect(phi).toBe(k.phi);
  expect(remainder).toBe(1n);
  expect(kMul * phi + remainder).toBe(ed); // the identity, checked as arithmetic
});

// ---------------------------------------------------------------- Section 4

test('an untampered signature verifies, and the page shows the two values that matched', async ({ page }) => {
  const sign = page.locator('#sign');
  const check = await rowValue(sign, 'Recovered');
  const [recovered, expected] = check.split('vs').map((s) => bigOf(s));

  expect(recovered).toBe(expected);
  await expect(sign.locator('.verdict')).toHaveClass(/good/);
  await expect(sign.locator('.verdict')).toContainText('Signature VALID');

  // The signature really is H(m)^d, verifiable with the public key alone.
  const k = await pageKey(page);
  const signature = bigOf(await rowValue(sign, 'Signature s'));
  const digest = bigOf(await rowValue(sign, 'H(message) signed'));
  expect(modexp(signature, k.e, k.n)).toBe(digest);
  expect(recovered).toBe(digest);
});

test('tampering after signing fails verification and says why', async ({ page }) => {
  const sign = page.locator('#sign');
  const signatureBefore = bigOf(await rowValue(sign, 'Signature s'));

  await page.locator('#sv-tamper').check();

  await expect(sign.locator('.verdict')).toHaveClass(/bad/);
  await expect(sign.locator('.verdict')).toContainText('message was altered after signing');
  // The delivered message is what changed — the signature is untouched.
  expect(bigOf(await rowValue(sign, 'Signature s'))).toBe(signatureBefore);
  await expect(ioRow(sign, 'Delivered message').locator('.codebox__value')).toContainText('(altered)');

  const [recovered, expected] = (await rowValue(sign, 'Recovered')).split('vs').map((s) => bigOf(s));
  expect(recovered).not.toBe(expected);

  // Unchecking restores the valid verdict — the failure path is reversible, not a dead end.
  await page.locator('#sv-tamper').uncheck();
  await expect(sign.locator('.verdict')).toHaveClass(/good/);
});

test('editing the signed message re-signs rather than reusing a stale signature', async ({ page }) => {
  const sign = page.locator('#sign');
  const before = bigOf(await rowValue(sign, 'Signature s'));
  await page.locator('#sv-msg').fill('transfer $1000000');
  await expect(ioRow(sign, 'Signature s').locator('.codebox__value')).not.toHaveText(before.toString());
  await expect(sign.locator('.verdict')).toHaveClass(/good/);
});

// ---------------------------------------------------------------- Section 5

test('factoring the weak key really recovers p, q and d — checked against n', async ({ page }) => {
  const k = await pageKey(page);
  await page.getByRole('button', { name: /Factor it!/i }).click();

  const breaks = page.locator('#breaks');
  const alarm = breaks.locator('.verdict.alarm');
  await expect(alarm).toContainText('KEY BROKEN');

  // The recovered factors must multiply back to the modulus on screen.
  const [fp, fq] = (await rowValue(breaks, 'Recovered primes')).split('×').map((s) => bigOf(s));
  expect(fp * fq).toBe(k.n);
  expect(new Set([fp, fq])).toEqual(new Set([k.p, k.q]));

  // The reconstructed d must be a working private exponent, not just a number.
  const d = bigOf(await rowValue(breaks, 'Reconstructed private d'));
  expect((k.e * d) % ((fp - 1n) * (fq - 1n))).toBe(1n);

  // And the page's own "anyone can now decrypt" line must actually decrypt.
  const [ct, recovered] = (await rowValue(breaks, 'Anyone can now decrypt')).split('→').map((s) => bigOf(s));
  expect(ct).toBe(modexp(42n % k.n, k.e, k.n));
  expect(recovered).toBe(42n % k.n);
  expect(modexp(ct, d, k.n)).toBe(recovered);

  // Timing and effort are reported, and the strategy named is one that ran.
  expect(Number((await alarm.innerText()).match(/in ([\d.]+) ms/)![1])).toBeGreaterThanOrEqual(0);
  const fine = await breaks.locator('.break-out .fine').innerText();
  expect(fine).toMatch(/Strategy: (trial-division|pollard-rho), \d+ iterations/);
});

test('the 2048-bit card is a projection that stays unbroken', async ({ page }) => {
  const strong = page.locator('#breaks .scale-card.strong');
  await expect(strong.locator('.verdict.good')).toContainText('SECURE');
  await expect(strong.getByRole('button')).toBeDisabled();
  // The projection is labeled as a projection, and is astronomically large.
  const fine = await strong.locator('.fine').innerText();
  expect(fine).toContain('nothing is actually run');
  expect(Number(fine.match(/~10(\d+)/)![1])).toBeGreaterThan(10);
});

// ---------------------------------------------------------------- Section 6

test('textbook RSA is shown to be deterministic — the same two ciphertexts, byte for byte', async ({ page }) => {
  const det = page.locator('#realworld .io-out').first();
  const c1 = bigOf(await rowValue(det, 'once'));
  const c2 = bigOf(await rowValue(det, 'again'));
  expect(c1).toBe(c2);

  const k = await pageKey(page);
  const m = BigInt('H'.charCodeAt(0)) * 256n + BigInt('i'.charCodeAt(0));
  expect(c1).toBe(modexp(m, k.e, k.n));

  const verdict = det.locator('.verdict');
  await expect(verdict).toHaveClass(/bad/);
  await expect(verdict).toContainText('Identical ciphertext');
  await expect(verdict).not.toContainText('unexpected');
});

test('real RSA-OAEP is shown to be randomized — two runs, two ciphertexts', async ({ page }) => {
  await page.getByRole('button', { name: /Run the real OAEP comparison/i }).click();
  const block = page.locator('#realworld .oaep-block');
  await expect(block).toBeVisible({ timeout: 30_000 });

  const a = (await block.locator('.codebox__value').nth(0).innerText()).trim();
  const b = (await block.locator('.codebox__value').nth(1).innerText()).trim();
  expect(a).not.toBe(b);
  expect(a).toMatch(/^[0-9a-f]{64}…$/);
  expect(b).toMatch(/^[0-9a-f]{64}…$/);

  const verdict = block.locator('.verdict');
  await expect(verdict).toHaveClass(/good/);
  await expect(verdict).toContainText('Different ciphertext every time');
  await expect(verdict).not.toContainText('unexpected');
  await expect(page.locator('#realworld .status')).toBeEmpty();
});

test('the malleability forgery is real: Enc(a)·Enc(b) decrypts to a·b', async ({ page }) => {
  const k = await pageKey(page);
  const mal = page.locator('#realworld .io-out').nth(1);

  const labels = await mal.locator('.io-row__label').allInnerTexts();
  const a = bigOf(labels[0].match(/a = (\d+)/)![1]);
  const b = bigOf(labels[1].match(/b = (\d+)/)![1]);

  const ca = bigOf(await mal.locator('.codebox__value').nth(0).innerText());
  const cb = bigOf(await mal.locator('.codebox__value').nth(1).innerText());
  const product = bigOf(await mal.locator('.codebox__value').nth(2).innerText());
  const recovered = bigOf(await mal.locator('.codebox__value').nth(3).innerText());

  // Each ciphertext is genuine, the product is the attacker's cheap multiplication,
  // and the decryption of that product is exactly the product of the plaintexts.
  expect(ca).toBe(modexp(a, k.e, k.n));
  expect(cb).toBe(modexp(b, k.e, k.n));
  expect(product).toBe((ca * cb) % k.n);
  expect(recovered).toBe((a * b) % k.n);
  expect(modexp(product, k.d, k.n)).toBe(recovered);

  const verdict = mal.locator('.verdict');
  await expect(verdict).toHaveClass(/bad/);
  await expect(verdict).toContainText(`Equals a·b = ${a}·${b} = ${(a * b) % k.n}`);
  await expect(verdict).not.toContainText('unexpected');
});

// ------------------------------------------------------- README-visible claims

test('every numbered section the README promises is present and reachable', async ({ page }) => {
  for (const id of ['keygen', 'encrypt', 'roundtrip', 'sign', 'breaks', 'realworld']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  // The insecurity warning the README leans on is on the page, not just in the docs.
  await expect(page.locator('#encrypt .status.warn')).toContainText('never use raw RSA');
  await expect(page.locator('#sign .status.warn')).toContainText('FNV-1a toy hash');
});

test('a new key propagates to every downstream panel', async ({ page }) => {
  const encBefore = bigOf(await rowValue(page.locator('#encrypt'), 'Ciphertext'));
  const signBefore = bigOf(await rowValue(page.locator('#sign'), 'Signature s'));

  await page.locator('#kg-p').fill('251');
  await page.locator('#kg-q').fill('241');
  await page.getByRole('button', { name: /^Generate$/ }).click();
  await expect(page.locator('#keygen .status')).toHaveClass(/ok/);

  const k = await pageKey(page);
  expect(k.n).toBe(251n * 241n);

  const m = bigOf(await rowValue(page.locator('#encrypt'), 'Message → integer m'));
  expect(bigOf(await rowValue(page.locator('#encrypt'), 'Ciphertext'))).toBe(modexp(m, k.e, k.n));
  expect(bigOf(await rowValue(page.locator('#encrypt'), 'Ciphertext'))).not.toBe(encBefore);
  expect(bigOf(await rowValue(page.locator('#sign'), 'Signature s'))).not.toBe(signBefore);

  // Section 5 re-renders against the new modulus too.
  await expect(page.locator('#breaks .scale-card.weak h3')).toContainText(`n = ${k.n}`);
});
