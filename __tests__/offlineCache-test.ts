import { isExpired, MAX_AGE_MS, openEntry, sealEntry, selectEvictions } from '@/lib/offlineCache';

const key = new Uint8Array(32).fill(7);
const otherKey = new Uint8Array(32).fill(8);
const nonce = new Uint8Array(24).fill(1);
const entry = { data: { name: 'Parañaque Clinic' }, savedAt: 1_700_000_000_000 };

describe('sealed offline entries', () => {
  it('round-trip with the same key and cache key', () => {
    expect(openEntry(key, 'list:/visits', sealEntry(key, nonce, 'list:/visits', entry))).toEqual(entry);
  });

  it('refuse another key, another cache key (a swapped file) or tampering', () => {
    const sealed = sealEntry(key, nonce, 'list:/visits', entry);
    expect(openEntry(otherKey, 'list:/visits', sealed)).toBeNull();
    expect(openEntry(key, 'list:/products', sealed)).toBeNull();
    const tampered = sealed.slice();
    tampered[tampered.length - 1] ^= 1;
    expect(openEntry(key, 'list:/visits', tampered)).toBeNull();
  });
});

describe('selectEvictions', () => {
  const now = 2_000_000_000_000;

  it('drops expired files (and ones from the future), then the oldest until it fits', () => {
    const files = [
      { name: 'old', size: 1, modifiedAt: now - MAX_AGE_MS - 1 },
      { name: 'future', size: 1, modifiedAt: now + 120_000 },
      { name: 'a', size: 5, modifiedAt: now - 3000 },
      { name: 'b', size: 5, modifiedAt: now - 2000 },
      { name: 'c', size: 5, modifiedAt: now - 1000 },
    ];
    expect(selectEvictions(files, now, { maxBytes: 10 })).toEqual(['old', 'future', 'a']);
    expect(isExpired(now, now)).toBe(false);
  });
});
