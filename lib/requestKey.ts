import { useRef } from 'react';
import * as Crypto from 'expo-crypto';

/**
 * An `Idempotency-Key` for a create the rep may have to send again: a timeout can come after the
 * server already saved it, and the retry must not save a second one. The key stays the same
 * while the input does, so a retry of the same form replays the first save; a changed input gets
 * a new key (it is a different request). One per screen: a new screen starts fresh.
 */
export function useRequestKey(): (input: unknown) => string {
  const last = useRef<{ signature: string; key: string } | null>(null);
  return (input: unknown) => {
    const signature = JSON.stringify(input) ?? '';
    if (last.current?.signature !== signature) last.current = { signature, key: Crypto.randomUUID() };
    return last.current.key;
  };
}
