import { isReleaseUrl } from '@/lib/config';

describe('isReleaseUrl', () => {
  it('takes a public https origin', () => {
    expect(isReleaseUrl('https://myclinicsoft.solutions')).toBe(true);
    expect(isReleaseUrl('https://api.example.com/base')).toBe(true);
  });

  it('refuses plain http, local and private-network hosts, and placeholders', () => {
    expect(isReleaseUrl('http://myclinicsoft.solutions')).toBe(false);
    expect(isReleaseUrl('https://localhost:3000')).toBe(false);
    expect(isReleaseUrl('https://127.0.0.1')).toBe(false);
    expect(isReleaseUrl('https://192.168.1.20:3000')).toBe(false);
    expect(isReleaseUrl('https://10.0.2.2')).toBe(false);
    expect(isReleaseUrl('https://172.16.0.5')).toBe(false);
    expect(isReleaseUrl('https://my-mac.local')).toBe(false);
    expect(isReleaseUrl('https://REPLACE_ME.example.com')).toBe(false);
    expect(isReleaseUrl('not a url')).toBe(false);
  });

  it('allows a 172.x address outside the private range', () => {
    expect(isReleaseUrl('https://172.32.0.1')).toBe(true);
  });
});
