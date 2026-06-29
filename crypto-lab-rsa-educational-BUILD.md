# BUILD TEMPLATE: crypto-lab-rsa-educational
## Gold-standard, fully-filled build prompt for the Educational RSA demo

This is a completed instance of `BUILD-TEMPLATE`. The fixed boilerplate is left
byte-for-byte; only the seven `[FILL]` sections and the REPO block are filled. It
produces the demo's cryptographic logic, UI, and in-demo content. The SEPARATE
standardization prompt (Parts 0 + A–E) is run AFTERWARD and owns the shared header,
theme toggle, README, GitHub Pages config, and scripture footer. This build prompt
deliberately stops where that one begins.

---

## REPO

- **Repo name:** `crypto-lab-rsa-educational`
- **About / one-liner:** `Step-by-step RSA — key generation, encryption/decryption, and signatures with real (small) numbers, and why 2048-bit keys are infeasible to factor. Real big-integer math in the browser, no backend.`
- **Catalog category label:** `Public-Key Cryptography` (cross-tags: `Educational · Number Theory`)
- **Catalog card title:** `Educational RSA`
- **Tags (3–4):** `RSA · Key Generation · Modular Exponentiation · OAEP`
- **Accent (`--accent`):** `#f59e0b` (amber — unused in the palette, groups it with the number-theory/educational labs and stays visibly distinct from the RSA Forge attack demo)
- **Favicon emoji (for the standardization pass to use):** `🔑`

---

## BUILD PROMPT (everything below this line is what you paste to the model)

```
# BUILD: crypto-lab-rsa-educational
## An interactive, step-by-step RSA classroom: see key generation, encryption, decryption, and signing with real small numbers, watch a weak key get factored in milliseconds, and understand why 2048-bit keys do not break.

Build a new Vite + TypeScript browser demo from scratch for the Crypto Lab suite.
It ships as a static site to GitHub Pages with NO backend.

This prompt produces the demo's cryptographic logic, UI, and content ONLY. A SEPARATE
standardization prompt (Parts 0 + A–E) will afterward apply the shared header, theme
contract, README, Pages config, and scripture footer. Therefore in THIS pass:
- Do NOT hand-build a header, top bar, nav, or theme-toggle button.
- Do NOT write the final README or the in-page scripture footer.
- DO mount the app content at `id="app"`.
- DO define `--accent` on `:root` (value: #f59e0b). If light/dark palettes exist,
  define `--accent` in both.
Those two demo-side prerequisites are the only things the standardization pass needs
from you; everything else header/footer/README-related is its job, not this one.

---

## ANTI-HALLUCINATION / DISCIPLINE RULES
- Real primitives only. Use WebCrypto (SubtleCrypto) or a named, justified library for
  the actual cryptographic operations. Do NOT simulate or fake math. If a primitive is
  not available in WebCrypto, use a specific well-known library and say which.
- For the primitive that IS the teaching subject, hand-roll the inspectable parts rather
  than hiding them inside a library — transparency of internals is the point of the demo.
- No backend, no network calls, no telemetry. Everything runs in the browser.
- Any key/secret material is generated per-session in memory and never persisted.
- Follow the relevant specification exactly; do not invent structure. Spec(s):
  PKCS #1 v2.2 (RFC 8017) for RSA, RSAES-OAEP, and RSASSA primitives; native BigInt for
  the inspectable textbook math; WebCrypto `RSA-OAEP` and `RSASSA-PKCS1-v1_5`/`RSA-PSS`
  for the realistic-mode operations.
- If a correctness or security invariant below conflicts with a feature, the invariant wins.
- Write runnable tests (see TESTING) and actually run them. Do not claim behavior you
  did not execute.
- Read before you write; re-read after each change to confirm it landed.

---

## SCOPE

IN scope:
- Textbook (raw) RSA computed in inspectable native BigInt:
  - Key generation: pick two small primes (curated dropdown OR "roll random" via
    Miller-Rabin), compute n = p·q, φ(n) = (p−1)(q−1), choose a public exponent e with
    gcd(e, φ) = 1, derive d = e⁻¹ mod φ. Every intermediate value is shown.
  - Encrypt / decrypt a short message encoded as an integer m < n: c = m^e mod n,
    m = c^d mod n, with the square-and-multiply modular exponentiation steps expandable.
  - Sign / verify: s = H(m)^d mod n, verify by s^e mod n ?= H(m), with a tamper toggle
    that makes verification visibly fail.
- "What breaks at scale" panel: factor the small educational n on-click (trial division
  / Pollard rho) in milliseconds, recover d, and decrypt — proving the weak key is broken;
  side-by-side with a 2048-bit key whose factoring cost is shown as a labeled projection.
- "Real-world RSA" panel: contrast deterministic textbook RSA (same plaintext → same
  ciphertext, which leaks) against randomized RSA-OAEP via WebCrypto (same plaintext →
  different ciphertext each time). OAEP is the path framed as production-appropriate.

NON-GOALS (each gets at most a one-line "what this isn't" note in the UI):
- This is NOT an attack lab. Padding-oracle / Bleichenbacher and signature-forgery
  attacks are mentioned at a high level only — link out to the RSA Forge demo.
- No actual factoring of realistic (≥512-bit) keys; the large-key side is an explicit
  projection, never a real attempt.
- No CRT decryption internals, no key-import/export formats (PEM/DER), no certificates/PKI.
- No persistence: keys and messages live in memory for the session only.

---

## SECURITY / CORRECTNESS INVARIANTS (bake in from the first commit; load-bearing)

1. All inspectable RSA math uses native BigInt only — never floating point, never a
   stubbed/faked result. Modular exponentiation is real square-and-multiply and its
   output is independently checkable against `(m ** e) % n`.
2. Key generation rejects every invalid parameter set before producing a key: p and q
   must each be prime and DISTINCT; e must satisfy 1 < e < φ and gcd(e, φ) = 1; d is
   accepted only if e·d ≡ 1 (mod φ) is verified after derivation.
3. Round-trip is an asserted invariant, not an assumption: dec(enc(m)) = m for every
   m < n, and verify(sign(m)) = true for untampered messages.
4. The textbook (no-padding) path is permanently and visibly labeled INSECURE /
   teaching-only. No code path and no UI state can present raw RSA as production-safe.
   Any "use this for real" framing routes exclusively through the WebCrypto OAEP path.
5. The factoring / break demo operates ONLY on the small educational key. It never claims
   to break a realistic key; the 2048-bit side is computed as an infeasibility projection
   and is labeled as such, never run.
6. The message integer is constrained to m < n by construction. Inputs with m ≥ n are
   rejected with an explanation of why modular wraparound destroys information — the app
   never silently truncates or wraps.

---

## ARCHITECTURE

- `src/rsa/bigint-math.ts`   — `modexp` (square-and-multiply), `egcd`, `modinv`, `gcd`,
                               `isProbablePrime` (Miller-Rabin), `randomPrime(bits)`.
                               Pure, no DOM. The inspectable heart of the demo.
- `src/rsa/keygen.ts`        — `generateKeypair` / `validateKeypair`; returns a key plus
                               an ordered step-trace (n, φ, e candidates, d) for the UI.
- `src/rsa/textbook.ts`      — raw `encrypt` / `decrypt` / `sign` / `verify` over BigInt,
                               every function tagged insecure in its doc + return metadata.
- `src/rsa/oaep.ts`          — thin wrapper over WebCrypto `RSA-OAEP` (and a signature
                               equivalent) for the realistic, randomized path.
- `src/rsa/factor.ts`        — small-n factoring as a strategy registry (trial division +
                               Pollard rho) for the break demo. // [extension] point
- `src/rsa/types.ts`         — branded types: `PublicKey {n,e}`, `PrivateKey {n,d}`,
                               `Plaintext` (proven < n) so an m ≥ n value cannot reach
                               textbook.encrypt by type.
- `src/ui/`                  — one panel module per section: `overview.ts`, `keygen.ts`,
                               `encrypt-decrypt.ts`, `sign-verify.ts`, `what-breaks.ts`,
                               `real-world.ts`, plus a shared `step-trace.ts` renderer.
- `index.html`               — content mounts at `id="app"`; `:root` defines
                               `--accent: #f59e0b`; NO header/footer (standardization pass
                               owns those).

---

## UI

Central metaphor: the **trapdoor**. Multiplying two primes is the easy door (one click,
instant); factoring the product is the locked one. Every panel reinforces "easy forward,
hard backward." The page is a single vertical flow of six panels mirroring the learning
objectives; each panel carries a live, expandable step-trace so the math is never hidden.

1. **Quick RSA Overview** — the trapdoor one-liner ("multiplying is easy, factoring is
   hard") with a minimal diagram of public key (n, e) and private key (d, n).
2. **Interactive Key Generation** — two prime inputs: a curated small-prime dropdown and a
   "roll random prime" button (Miller-Rabin). Live-compute n, φ(n), an e-selector that only
   offers valid coprime exponents, and the derived d. A "too small / not random" preset
   shows what a degenerate choice looks like.
3. **Encryption & Decryption Playground** — type a short message → encoded m; encrypt to
   c = m^e mod n; decrypt back. The square-and-multiply steps expand on demand.
4. **Signing & Verification** — sign m with the private key, verify with the public key. A
   "tamper" toggle alters the message after signing so the user watches verification fail.
5. **What Breaks at Scale** — side by side: the small key with a "Factor it!" button that
   recovers p, q in milliseconds, reconstructs d, and decrypts; versus a 2048-bit key whose
   factoring cost renders as a clearly-labeled projection bar that never completes.
6. **Real-World RSA Warnings** — a textbook-vs-OAEP toggle. Encrypt the same plaintext
   twice: textbook yields identical ciphertext (leaks equality); OAEP via WebCrypto yields
   different ciphertext each time. High-level note on padding-oracle pitfalls links out to
   RSA Forge.

Scripted launchers: the "Factor it!" button (setup: the current small n; expected outcome:
p, q, d recovered + plaintext decrypted, rendered as an ALARM). The "too small / not random"
keygen preset (setup: tiny or equal primes; expected outcome: a flagged, rejected/weak key).

Below 640px every panel stacks vertically; the side-by-side scale comparison becomes two
stacked cards; step-traces collapse by default.

---

## VISUAL SEMANTICS

Governing rule: **color tracks security/correctness, not whether an operation returned a
value.** Pair icon + text + color on every state (WCAG 1.4.1); verify each survives
grayscale and deuteranopia.

- Valid round-trip / valid signature → green check + "verified".
- Tampered or failed verification → red alarm + "verification failed".
- Textbook / no-padding mode → a persistent amber-to-red WARNING banner ("INSECURE —
  teaching only"). This is the inverted intuition the model gets wrong by default: textbook
  RSA *successfully* encrypting is NOT a green success — a correct-but-insecure result must
  read as a warning, because the lesson is the insecurity, not the arithmetic working.
- Small-key factoring SUCCESS → red ALARM, not green. Recovering the private key means the
  key is broken; that is the bad outcome being demonstrated.
- 2048-bit infeasibility → this is the "secure / good" state, rendered calm/green.

---

## EDGE CASES (each: defined behavior + a teaching tooltip)

- p or q not prime → reject; tooltip: RSA's security and the φ formula both depend on p, q
  being prime.
- p == q → reject; tooltip: n = p² is trivially factorable and φ = p(p−1), not (p−1)(q−1).
- gcd(e, φ) ≠ 1 → reject e; tooltip: without coprimality e has no modular inverse, so no d.
- e = 1 (or e = φ) → reject; tooltip: e = 1 leaves the message unencrypted; trivial exponents.
- m ≥ n → reject before encrypting; tooltip: only residues mod n are recoverable — m ≥ n
  wraps and loses data.
- m ∈ {0, 1, n−1} → allow but flag; tooltip: these are fixed points that encrypt to themselves
  (unconcealed messages).
- Primes so small that n cannot encode the chosen message → warn; tooltip: pick larger primes
  or a smaller message so m < n.
- Empty / non-integer / negative input → fail closed with an inline message; never coerce.

---

## TESTING
Add runnable tests (Vitest preferred) and confirm they pass before finishing. Cover:

- `modexp(m, e, n)` equals `(m ** e) % n` (BigInt) across many random vectors.
- `modinv`: for generated keys, e·d ≡ 1 (mod φ).
- `isProbablePrime`: correct on a table of known primes and composites, INCLUDING Carmichael
  numbers (561, 1105, 1729) so a naive Fermat test would fail.
- Round-trip: dec(enc(m)) = m for all m < n across several distinct keypairs.
- Sign/verify: accepts an untampered signature, rejects a tampered message.
- Break demo: `factor(n)` recovers p, q for small n; the recovered d decrypts a known
  ciphertext to the known plaintext — the "weak key is broken" claim is backed by a passing
  test, not just asserted in the UI.
- Determinism contrast: textbook `encrypt(m)` is byte-identical across calls; the OAEP path
  produces two different ciphertexts for the same plaintext — backing the padding lesson.
- Boundary: m ≥ n is rejected (never silently reduced); p == q and gcd(e, φ) ≠ 1 are rejected.

---

## ACCESSIBILITY / MOBILE
- All interactive controls (launchers, toggles, inputs) keyboard-operable with visible
  focus rings.
- State conveyed by icon + text + color, never color alone.
- Long monospace/technical strings (n, c, s) in a horizontally-scrollable box with a copy
  button rather than wrapped, when wrapping would destroy meaningful structure.
- Text inputs are real <textarea>/<input> with <label>, not contenteditable divs.
- Layout stacks cleanly below 640px.

---

## EXTENSION SEAMS (leave seams, don't build yet)

- Additional factoring strategies (Fermat near-prime, Quadratic Sieve teaser) plug into the
  `factor.ts` strategy registry — shape it as `register(name, fn)` now. // [extension] point
- CRT-based decryption as an optional "faster path" toggle: keep `textbook.decrypt` calling
  a single `decryptCore` so a CRT variant is additive. // [extension] point
- `randomPrime(bits)` is already bit-size-parameterized so a future "realistic mode" can
  grow without reshaping keygen. // [extension] point
- Cross-links out to the RSA Forge attack lab and a future post-quantum (Kyber/ML-KEM) demo;
  leave a single `links.ts` constant so adding siblings is one line. // [extension] point

---

## DEFINITION OF DONE
- `npm run dev` serves the working demo locally.
- The core interaction works and produces the intended "aha."
- Tests pass (state the count and what they cover).
- Content mounts at `id="app"`; `:root` defines `--accent` = #f59e0b.
- NO header, top bar, theme toggle, README, or scripture footer added here — those are
  applied by the Parts 0 + A–E standardization prompt next.

Report a one-line summary when done:
`✓ crypto-lab-rsa-educational — demo logic + UI + tests complete, ready for Parts 0 + A–E`
```

---

## PIPELINE (for your own reference — not part of the pasted prompt)

1. The seven `[FILL]` sections + REPO block above are complete.
2. Create the GitHub repo `crypto-lab-rsa-educational` with the About one-liner.
3. Paste the filled BUILD PROMPT to Opus / Claude Code → working demo.
4. Run the **Parts 0 + A–E standardization prompt** on the result (header, theme, README,
   Pages config, footer, head/favicon).
5. Add the catalog card (title `Educational RSA`, tags, accent `#f59e0b`) to the
   `crypto-lab` index.
6. Deploy and verify the live URL.

---

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
