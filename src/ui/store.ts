// Shared session state: the current keypair, used by the encrypt/decrypt, sign,
// and break panels. In-memory only — never persisted (Invariant: no persistence).

import type { Keypair } from '../rsa/types';

type Listener = (k: Keypair) => void;

let current: Keypair | null = null;
const listeners = new Set<Listener>();

export function setKey(k: Keypair): void {
  current = k;
  for (const fn of listeners) fn(k);
}

export function getKey(): Keypair | null {
  return current;
}

/** Subscribe to key changes; fires immediately if a key already exists. */
export function onKey(fn: Listener): void {
  listeners.add(fn);
  if (current) fn(current);
}
