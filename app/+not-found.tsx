import { router, Stack } from 'expo-router';
import { IconBadge, StatusScreen } from '@/components/auth';
import { useT } from '@/lib/i18n';

/**
 * An old or mistyped link (a deep link, a push from a newer app version). "/" routes the rep to
 * Home or to sign-in, whichever applies.
 */
export default function NotFoundScreen() {
  const t = useT();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusScreen
        art={<IconBadge icon="compass-outline" tone="slate" />}
        title={t('common.notFound.title')}
        message={t('common.notFound.body')}
        action={{ title: t('common.notFound.home'), onPress: () => router.replace('/') }}
      />
    </>
  );
}
