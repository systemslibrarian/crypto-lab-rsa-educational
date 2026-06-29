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

Generate a keypair from two small primes (or roll random ones) and watch every step — `n`, `φ(n)`, `e`, and `d` — derived in the open. **Encrypt and decrypt** a short message with the square-and-multiply math expanded, **sign and verify** with a tamper toggle that makes verification fail, then **factor a weak key** in milliseconds and contrast it with a 2048-bit key that does not break. A final panel shows why real RSA adds randomized OAEP padding by comparing deterministic textbook ciphertext against WebCrypto RSA-OAEP. Controls include the two primes, the public exponent `e`, the message, the signature tamper switch, and the factoring launcher.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-rsa-educational
cd crypto-lab-rsa-educational
npm install
npm run dev
```

No environment variables are required. Run the test suite with `npm test`.

## Part of the Crypto-Lab Suite

> One of 60+ live browser demos at
> [systemslibrarian.github.io/crypto-lab](https://systemslibrarian.github.io/crypto-lab/)
> — spanning Atbash (600 BCE) through NIST FIPS 203/204/205 (2024).

---

*"Whether you eat or drink, or whatever you do, do all to the glory of God." — 1 Corinthians 10:31*
