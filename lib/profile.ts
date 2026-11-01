import { apiRequest, AUTH_ENDPOINTS } from './api';
import { emitRefresh } from './events';
import { RepProfile, RepProfileUpdate } from './types';
import { useApiData } from './useApiData';

/** The signed-in rep's own profile (GET /session). Refetches after any profile or settings save. */
export function useRepProfile() {
  return useApiData<RepProfile>(AUTH_ENDPOINTS.session, { refreshOn: ['profile'] });
}

/** PUT /profile. Returns the saved profile. */
export async function updateProfile(changes: RepProfileUpdate): Promise<RepProfile> {
  const saved = await apiRequest<RepProfile>('/api/medical-representatives/profile', { method: 'PUT', body: changes });
  emitRefresh('profile', 'dashboard');
  return saved;
}

/** PUT /notifications: `notificationsEnabled: false` stops push; `emailNotifications` stops email. */
export async function updateNotificationSettings(changes: {
  notificationsEnabled?: boolean;
  emailNotifications?: boolean;
}): Promise<RepProfile> {
  const saved = await apiRequest<RepProfile>('/api/medical-representatives/notifications', { method: 'PUT', body: changes });
  emitRefresh('profile');
  return saved;
}
