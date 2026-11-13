import { appendPage, mergeFirstPage } from '@/lib/usePaginatedList';

const ids = (items: { _id: string }[]) => items.map((i) => i._id);
const page = (...names: string[]) => names.map((_id) => ({ _id }));

describe('mergeFirstPage', () => {
  it('drops what left page 1 (deleted, or out of the filter)', () => {
    expect(ids(mergeFirstPage(page('a', 'b', 'c'), page('a', 'c'), 3))).toEqual(['a', 'c']);
  });

  it('keeps later pages, without repeating an item that moved up into page 1', () => {
    const prev = page('a', 'b', 'c', 'd', 'e', 'f');
    expect(ids(mergeFirstPage(prev, page('new', 'a', 'b'), 3))).toEqual(['new', 'a', 'b', 'd', 'e', 'f']);
    expect(ids(mergeFirstPage(prev, page('a', 'b', 'd'), 3))).toEqual(['a', 'b', 'd', 'e', 'f']);
  });

  it('takes the fresh copy of an item', () => {
    expect(mergeFirstPage([{ _id: 'a', name: 'old' }], [{ _id: 'a', name: 'new' }], 20)).toEqual([{ _id: 'a', name: 'new' }]);
  });
});

describe('appendPage', () => {
  it('adds the next page after the loaded items, skipping ones already shown', () => {
    expect(ids(appendPage(page('a', 'b', 'c'), page('c', 'd')))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a re-fetched last page brings back items that slid up after a delete', () => {
    // Pages of 2: a, b | c, d loaded; "b" was deleted, so the server's page 2 is now d, e.
    const afterMerge = mergeFirstPage(page('a', 'b', 'c', 'd'), page('a', 'c'), 2);
    const refetched = appendPage(afterMerge, page('d', 'e'));
    expect(ids(appendPage(refetched, page('f')))).toEqual(['a', 'c', 'd', 'e', 'f']);
  });
});
