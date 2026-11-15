import { noteSignedInRep, rememberReturnPath, skipNextReturnPath, takeReturnPath } from '@/lib/returnTo';

describe('returnTo', () => {
  it('returns the same rep to the screen a lost session left, once', () => {
    noteSignedInRep('rep-a');
    rememberReturnPath('/visits/123');
    expect(takeReturnPath('rep-a')).toBe('/visits/123');
    expect(takeReturnPath('rep-a')).toBeNull();
  });
  it('never hands one rep the last rep’s screen', () => {
    noteSignedInRep('rep-a');
    rememberReturnPath('/visits/123');
    expect(takeReturnPath('rep-b')).toBeNull();
  });
  it('skips a deliberate sign-out and paths that are already the default', () => {
    noteSignedInRep('rep-a');
    skipNextReturnPath();
    rememberReturnPath('/settings');
    expect(takeReturnPath('rep-a')).toBeNull();
    rememberReturnPath('/home');
    expect(takeReturnPath('rep-a')).toBeNull();
  });
});
