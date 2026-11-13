import { act, renderHook } from '@testing-library/react-native';
import { dismissSnack, scheduleDelete, settleDeletesForSignOut, undoDelete, usePendingDeletes, useSnack } from '@/lib/undo';

const hidden = () => renderHook(() => usePendingDeletes());

describe('delete with Undo', () => {
  afterEach(() => act(() => settleDeletesForSignOut({ send: false })));

  it('keeps a deleted item hidden after the server confirms it', async () => {
    const { result } = await hidden();
    const commit = jest.fn().mockResolvedValue(undefined);
    await act(() => scheduleDelete({ id: 'v1', message: 'Visit deleted', commit, topics: ['visits'] }));
    expect(result.current.has('v1')).toBe(true);
    await act(async () => dismissSnack());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(result.current.has('v1')).toBe(true);
  });

  it('brings the item back when the server refuses', async () => {
    const { result } = await hidden();
    await act(() => scheduleDelete({ id: 'v2', message: 'Visit deleted', commit: () => Promise.reject(new Error('no')), topics: [] }));
    await act(async () => dismissSnack());
    expect(result.current.has('v2')).toBe(false);
  });

  it('Undo sends nothing', async () => {
    const commit = jest.fn();
    const { result } = await hidden();
    await act(() => scheduleDelete({ id: 'v3', message: 'Visit deleted', commit, topics: [] }));
    await act(() => undoDelete());
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.has('v3')).toBe(false);
  });

  it('sign-out sends the waiting delete first, then forgets every hidden id', async () => {
    const commit = jest.fn().mockResolvedValue(undefined);
    const { result } = await hidden();
    await act(() => scheduleDelete({ id: 'v4', message: 'Visit deleted', commit, topics: [] }));
    await act(() => settleDeletesForSignOut({ send: true }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(result.current.size).toBe(0);
  });

  it('a second Delete on the same item does nothing until the first settles', async () => {
    const commit = jest.fn().mockResolvedValue(undefined);
    const { result } = await hidden();
    await act(() => scheduleDelete({ id: 'v5', message: 'Visit deleted', commit, topics: [] }));
    await act(() => scheduleDelete({ id: 'v5', message: 'Visit deleted', commit, topics: [] }));
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.has('v5')).toBe(true);
    await act(async () => dismissSnack());
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("a failed earlier delete waits behind the next item's Undo, which is still sent", async () => {
    const snack = await renderHook(() => useSnack());
    const { result } = await hidden();
    const second = jest.fn().mockResolvedValue(undefined);
    await act(() => scheduleDelete({ id: 'v6', message: 'Visit deleted', commit: () => Promise.reject(new Error('refused')), topics: [] }));
    await act(async () => scheduleDelete({ id: 'v7', message: 'Visit deleted', commit: second, topics: [] }));
    // v6 came back, but v7's Undo is still the one showing.
    expect(result.current.has('v6')).toBe(false);
    expect(snack.result.current).toMatchObject({ kind: 'undo', item: { id: 'v7' } });
    await act(async () => dismissSnack());
    expect(second).toHaveBeenCalledTimes(1);
    expect(result.current.has('v7')).toBe(true);
    expect(snack.result.current?.kind).toBe('error');
  });
});
