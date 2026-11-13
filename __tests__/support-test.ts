import { lastActivity, requestState } from '@/lib/support';
import { SupportReply } from '@/lib/types';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const reply = (authorType: SupportReply['authorType'], createdAt: string): SupportReply => ({
  _id: createdAt,
  authorType,
  authorEmail: 'x@example.com',
  message: '…',
  createdAt,
});

describe('requestState', () => {
  it('is waiting while nobody answered, or the rep wrote last', () => {
    expect(requestState({ status: 'open', replies: [] })).toBe('waiting');
    expect(requestState({ status: 'open' })).toBe('waiting');
    expect(requestState({ status: 'in-progress', replies: [reply('platform', '2026-11-10'), reply('requester', '2026-11-11')] })).toBe('waiting');
  });

  it('is replied when support wrote last on an open request', () => {
    expect(requestState({ status: 'in-progress', replies: [reply('platform', '2026-11-10')] })).toBe('replied');
    expect(requestState({ status: 'open', replies: [reply('requester', '2026-11-09'), reply('platform', '2026-11-10')] })).toBe('replied');
  });

  it('resolved and closed win over who wrote last', () => {
    expect(requestState({ status: 'resolved', replies: [reply('platform', '2026-11-10')] })).toBe('resolved');
    expect(requestState({ status: 'closed', replies: [reply('platform', '2026-11-10')] })).toBe('closed');
  });
});

describe('lastActivity', () => {
  it('is the newest reply, else when the request was sent', () => {
    expect(lastActivity({ createdAt: '2026-11-01', replies: [] })).toBe('2026-11-01');
    expect(lastActivity({ createdAt: '2026-11-01', replies: [reply('platform', '2026-11-03'), reply('requester', '2026-11-05')] })).toBe('2026-11-05');
  });
});
