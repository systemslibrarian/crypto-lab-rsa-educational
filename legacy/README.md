# Legacy scripts

This repository began as a fork of a small educational Python project that
demonstrates breaking weak RSA keys by trial-division factoring against a list
of small primes. Those original scripts (Python 2, Spanish comments) are kept
here for provenance; they are **not** part of the live demo and are not run by it.

| File | What it does |
|------|--------------|
| `rsa_testing.py` | Generates a small RSA keypair and round-trips a number through encrypt/decrypt. |
| `rsa_breaker.py` | Recovers the private key from a public `(N, e)` by factoring `N` against the first 10⁴ primes. |
| `rsa_breaker_1milion.py` | Same attack with a larger prime table. |
| `10000.txt`, `primes1.txt` | Prime-number tables used by the breakers. |

The modern, browser-based version of these ideas — key generation, encryption,
signing, and the millisecond factoring of a weak key — lives in the Vite +
TypeScript demo at the repository root (`src/`). See the top-level `README.md`.
