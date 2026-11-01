import { router, useLocalSearchParams } from 'expo-router';
import { useT } from '@/lib/i18n';
import { updateLogEntry, useVisit } from '@/lib/visits';
import { ErrorState } from '@/components/ErrorState';
import { LoadingView } from '@/components/ui';
import { VisitLogForm } from '@/components/VisitLogForm';

/** Edit one of the rep's own log entries (PUT takes the full object). */
export default function EditVisitScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: visit, loading, error, refresh } = useVisit(id);

  if (!visit) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  return (
    <VisitLogForm
      visit={visit}
      submitLabel={t('common.save')}
      onSubmit={async (input) => {
        await updateLogEntry(visit._id, input);
        router.back();
      }}
    />
  );
}
