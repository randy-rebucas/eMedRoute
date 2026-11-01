import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { LoadingView } from '@/components/ui';

/** Root routing: signed in → Home; otherwise sign-in. */
export default function Index() {
  const { signedIn, loading } = useAuth();
  if (loading) return <LoadingView />;
  return <Redirect href={signedIn ? '/home' : '/login'} />;
}
