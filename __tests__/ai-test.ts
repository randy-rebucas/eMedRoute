import { aiOffered, isAllowanceUsedUp } from '@/lib/ai';
import { ApiError } from '@/lib/api';
import { AiStatus } from '@/lib/types';

const status = (over: Partial<AiStatus> = {}): AiStatus => ({
  available: true,
  plan: 'standard',
  limit: 20,
  used: 3,
  remaining: 17,
  resetsOn: '2026-12-01',
  proMonthly: 799,
  proYearly: 7990,
  proActions: 300,
  ...over,
});

describe('aiOffered', () => {
  it('offers the assistant when the server has it and there is an allowance or Pro to buy', () => {
    expect(aiOffered(status())).toBe(true);
    expect(aiOffered(status({ limit: 0 }))).toBe(true); // no free taste, but Pro is sold
    expect(aiOffered(status({ limit: 0, proMonthly: 0 }))).toBe(false);
    expect(aiOffered(status({ available: false }))).toBe(false);
    expect(aiOffered(null)).toBe(false);
  });
});

describe('isAllowanceUsedUp', () => {
  it('spots the server’s used-up answers only', () => {
    expect(isAllowanceUsedUp(new ApiError('Used up', 402, 'AI_UPGRADE'))).toBe(true);
    expect(isAllowanceUsedUp(new ApiError('Used up', 402, 'AI_LIMIT'))).toBe(true);
    expect(isAllowanceUsedUp(new ApiError('Busy', 429))).toBe(false);
    expect(isAllowanceUsedUp(new Error('x'))).toBe(false);
  });
});
