import { isOlder, statusFrom } from '@/lib/appVersion';

describe('isOlder', () => {
  it('compares numeric parts, not strings', () => {
    expect(isOlder('1.0.9', '1.0.10')).toBe(true);
    expect(isOlder('1.0.10', '1.0.9')).toBe(false);
    expect(isOlder('1.0', '1.0.0')).toBe(false);
    expect(isOlder('1.0.1', '1.1')).toBe(true);
  });
  it('never treats an unparseable version as older', () => {
    expect(isOlder('abc', '2.0.0')).toBe(false);
    expect(isOlder('1.0.0', 'v2')).toBe(false);
  });
});

describe('statusFrom', () => {
  it('requires an update below the minimum', () => {
    expect(statusFrom('1.0.1', { minVersion: '1.0.2', latestVersion: '1.0.3' }).kind).toBe('required');
  });
  it('offers an update below the latest only', () => {
    expect(statusFrom('1.0.2', { minVersion: '1.0.2', latestVersion: '1.0.3' })).toMatchObject({
      kind: 'available',
      latestVersion: '1.0.3',
    });
  });
  it('asks nothing when current, or when the server sent nothing usable', () => {
    expect(statusFrom('1.0.3', { minVersion: '1.0.2', latestVersion: '1.0.3' }).kind).toBe('none');
    expect(statusFrom('1.0.1', null).kind).toBe('none');
    expect(statusFrom('1.0.1', { minVersion: '', latestVersion: null }).kind).toBe('none');
  });
});
