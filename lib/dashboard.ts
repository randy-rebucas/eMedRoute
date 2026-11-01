import { Dashboard } from './types';
import { useApiData } from './useApiData';

/** Home: counts and the next scheduled visits. Kept offline; refetches after any visit or product change. */
export function useDashboard() {
  return useApiData<Dashboard>('/api/medical-representatives/dashboard', {
    refreshOn: ['dashboard', 'visits', 'products', 'profile'],
    offline: true,
  });
}
