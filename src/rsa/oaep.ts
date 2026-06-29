// Realistic-mode RSA via WebCrypto. This is the ONLY path framed as production-
// appropriate (Invariant #4). WebCrypto cannot import the tiny textbook keys, so it
// generates its own 2048-bit RSA-OAEP key; the panel's lesson is the randomized,
// non-deterministic ciphertext — contrasted with deterministic textbook RSA.

function subtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) throw new Error('WebCrypto SubtleCrypto unavailable in this environment');
  return c.subtle;
}

export interface OaepKey {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/** Generate a real 2048-bit RSA-OAEP (SHA-256) keypair. */
export async function generateOaepKey(): Promise<OaepKey> {
  const pair = await subtle().generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
      hash: 'SHA-256',
    },
    false,
    ['encrypt', 'decrypt'],
  );
  return pair as OaepKey;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** OAEP-encrypt a UTF-8 string. Randomized: two calls on the same input differ. */
export async function oaepEncrypt(key: OaepKey, message: string): Promise<Uint8Array> {
  const data = enc.encode(message) as BufferSource;
  const ct = await subtle().encrypt({ name: 'RSA-OAEP' }, key.publicKey, data);
  return new Uint8Array(ct);
}

export async function oaepDecrypt(key: OaepKey, ciphertext: Uint8Array): Promise<string> {
  const pt = await subtle().decrypt({ name: 'RSA-OAEP' }, key.privateKey, ciphertext as BufferSource);
  return dec.decode(pt);
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
