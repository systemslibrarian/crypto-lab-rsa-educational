# Educational RSA

## What It Is

Educational RSA is an interactive, browser-based walkthrough of the **RSA public-key cryptosystem** — key generation, encryption/decryption, and digital signatures — performed on real (deliberately small) numbers using native JavaScript `BigInt`. RSA solves the problem of communicating securely and authenticating messages without a pre-shared secret: anyone can encrypt to you or verify your signature with your public key `(n, e)`, while only you, holding the private exponent `d`, can decrypt or sign. It is an **asymmetric** scheme whose security rests on the practical difficulty of factoring the product of two large primes. The textbook (unpadded) math is shown transparently for teaching; the demo is explicit that raw RSA is insecure and that real systems use OAEP padding (encryption) and PSS (signatures).

## When to Use It

- **Establishing keys / encrypting a symmetric key over an untrusted channel** — RSA-OAEP lets a sender encrypt a short secret to a recipient's public key with no prior shared secret.
- **Digital signatures and code/document signing** — RSA-PSS signatures let anyone verify authenticity and integrity using only the signer's public key.
- **Interoperability with existing PKI** — RSA is ubiquitous in TLS certificates, S/MIME, and legacy systems, so it is the right choice when you must fit established standards.
- **Teaching public-key cryptography** — RSA's arithmetic is simple enough to compute by hand on small numbers, making the easy-to-multiply / hard-to-factor "trapdoor" idea concrete.
- **When NOT to use it:** do not use **textbook (unpadded) RSA** for anything real — it is deterministic and malleable. For new systems prefer elliptic-curve schemes (Ed25519/X25519) for smaller keys and faster operations, and never roll your own padding.

## Live Demo

**[systemslibrarian.github.io/crypto-lab-rsa-educational](https://systemslibrarian.github.io/crypto-lab-rsa-educational/)**

Generate a keypair from two small primes (or roll random ones) and watch every step — `n`, `φ(n)`, `e`, and `d` — derived in the open, with a plain-language gloss on what `φ` counts and why `d` is inverted mod `φ`. **Encrypt and decrypt** a short message, seeing the text-to-integer encoding spelled out byte by byte and the square-and-multiply math shown progressively (defaulting to a tiny `e = 3` so the fast-exponentiation lesson — a handful of operations instead of thousands — is obvious). A dedicated **round-trip picture** draws `"Hi" → m → [^e mod n, public] → c → [^d mod n, private] → m → "Hi"` as one flow with the key cards under the arrows that use them, and an animated **mod-n clock** shows a value scramble under `^e` and wrap back under `^d`, with the identity `e·d = k·φ + 1` highlighted to explain *why* decryption undoes encryption. Then **sign and verify** with a tamper toggle that makes verification fail, **factor a weak key** in milliseconds and contrast it with a 2048-bit key that does not break (weak-key errors link forward to this panel). A final panel shows why real RSA adds randomized OAEP padding by comparing deterministic textbook ciphertext against WebCrypto RSA-OAEP, and demonstrates **malleability live** — multiplying two ciphertexts to forge `Enc(a·b)` without the key. Controls include the two primes, the public exponent `e`, the message, the exponent-size toggle, the signature tamper switch, and the factoring launcher.

## What Can Go Wrong

- **Textbook (unpadded) RSA is deterministic** — the same plaintext always encrypts to the same ciphertext, so an eavesdropper learns when two messages are equal. Section 6 of the demo shows this directly, then contrasts it with randomized RSA-OAEP. Real systems must use OAEP for encryption.
- **Textbook RSA is malleable** — because `Enc(m₁)·Enc(m₂) mod n = Enc(m₁·m₂)`, an attacker can transform ciphertexts into related ciphertexts without the key. OAEP's all-or-nothing padding destroys this homomorphic structure.
- **Weak primes are catastrophic** — if `p` and `q` are small, close together, or share factors with other moduli, `n` factors in milliseconds. The demo factors a weak key with trial division and Pollard's rho, recovers `d`, and decrypts — while a 2048-bit key does not budge.
- **Small public exponent without padding** — `e = 3` on an unpadded short message sent to several recipients leaks the plaintext via the Chinese Remainder Theorem and an integer cube root (Håstad's broadcast attack). Never encrypt raw messages with a tiny exponent.
- **Signature schemes need PSS, not raw RSA** — textbook "sign by exponentiating the message" is forgeable (existential forgery via the same multiplicative structure). Production signatures use RSA-PSS. The demo's sign/verify panel includes a tamper toggle that makes verification correctly reject a modified message.
- **RSA has no forward secrecy and no quantum resistance** — a compromised long-term private key retroactively exposes past sessions (why TLS 1.3 dropped RSA key exchange), and Shor's algorithm factors any RSA modulus on a fault-tolerant quantum computer.

## Real-World Usage

- **TLS certificates** — most HTTPS certificates on the public internet carry RSA-2048/4096 public keys, signed with RSASSA-PKCS1-v1_5 or RSASSA-PSS.
- **SSH authentication** — OpenSSH uses RSA host and user keys (commonly 3072/4096-bit) with the `rsa-sha2-256` / `rsa-sha2-512` signature algorithms.
- **S/MIME email** — RFC 8551 wraps a per-message symmetric content key with RSA-OAEP for end-to-end encrypted enterprise mail.
- **Code signing** — Windows Authenticode, macOS `codesign`, and Java JAR signing all support RSA signatures to prove a binary was not tampered with.
- **JSON Web Tokens (JWT)** — RFC 7518 `RS256/RS384/RS512` use RSASSA-PKCS1-v1_5; `PS256/PS384/PS512` use RSASSA-PSS.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-rsa-educational
cd crypto-lab-rsa-educational
npm install
npm run dev
```

No environment variables are required. Run the crypto unit tests with `npm test` (Miller-Rabin, modexp, factoring, key recovery, and the `n=3233`/`d=2753` KAT with sign/verify tamper checks). Run the accessibility gate with `npm run test:a11y`.

## Related Demos

- [crypto-lab-rsa-forge](https://systemslibrarian.github.io/crypto-lab-rsa-forge/) — real RSA attacks: Håstad broadcast and a live Bleichenbacher PKCS#1 v1.5 padding oracle.
- [crypto-lab-kyber-vault](https://systemslibrarian.github.io/crypto-lab-kyber-vault/) — ML-KEM (FIPS 203), the post-quantum key encapsulation built to replace RSA key transport.
- [crypto-lab-dilithium-seal](https://systemslibrarian.github.io/crypto-lab-dilithium-seal/) — ML-DSA (FIPS 204), the post-quantum replacement for RSA/ECDSA signatures.
- [crypto-lab-shor](https://systemslibrarian.github.io/crypto-lab-shor/) — Shor's algorithm, the quantum period-finding attack that factors RSA moduli.

---

*"Whether you eat or drink, or whatever you do, do all to the glory of God." — 1 Corinthians 10:31*
