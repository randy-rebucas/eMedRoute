import { router, useLocalSearchParams } from 'expo-router';
import { useT } from '@/lib/i18n';
import { isOwnLog, updateLogEntry, useVisit } from '@/lib/visits';
import { ErrorState } from '@/components/ErrorState';
import { LoadingView } from '@/components/ui';
import { VisitLogForm } from '@/components/VisitLogForm';

/** Edit one of the rep's own log entries (PUT takes the full object). */
export default function EditVisitScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: visit, loading, error, offline, stale, refresh } = useVisit(id);

  // Only the server's copy is edited: a saved offline copy could save over newer changes.
  if (!visit || stale) {
    if (loading || (stale && !offline && !error)) return <LoadingView />;
    return <ErrorState message={offline ? t('common.editNeedsConnection') : (error ?? t('common.failedToLoad'))} onRetry={refresh} />;
  }

  // The log form can't express a clinic booking (a deep link could open one here): the server would refuse the save.
  if (!isOwnLog(visit)) {
    return <ErrorState message={t('visits.editOnlyOwn')} onRetry={() => router.back()} actionLabel={t('common.goBack')} />;
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
