import { routeForNotification } from '@/lib/push';

// Only the pure routing is tested: the native module (and its Expo Go warning) isn't needed.
jest.mock('@/lib/notifications', () => ({ Notifications: null }));

describe('routeForNotification', () => {
  it('opens the detail when there is an id, else the list, and refreshes what changed', () => {
    expect(routeForNotification({ screen: 'visits', id: 'v 1' })).toEqual({ href: '/visits/v%201', topics: ['visits', 'deliveries', 'dashboard'] });
    expect(routeForNotification({ screen: 'visits' }).href).toBe('/visits');
    expect(routeForNotification({ screen: 'products', id: 'p1' })).toEqual({ href: '/products/p1', topics: ['products', 'dashboard'] });
    expect(routeForNotification({ screen: 'team', id: 'x' })).toEqual({ href: '/team', topics: ['team'] });
    expect(routeForNotification({ screen: 'clinics' })).toEqual({ href: '/clinics', topics: ['clinics'] });
    expect(routeForNotification({ screen: 'sponsorships' })).toEqual({ href: '/sponsorships', topics: ['sponsorships'] });
  });

  it('ignores blank ids and unknown screens (no navigation, broad refresh)', () => {
    expect(routeForNotification({ screen: ' visits ', id: '  ' }).href).toBe('/visits');
    expect(routeForNotification({ screen: 'billing' })).toEqual({ href: null, topics: ['visits', 'products', 'team', 'dashboard'] });
    expect(routeForNotification(undefined).href).toBeNull();
    expect(routeForNotification({ screen: 42 }).href).toBeNull();
  });
});
