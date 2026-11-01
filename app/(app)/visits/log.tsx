import { router } from 'expo-router';
import { useT } from '@/lib/i18n';
import { createLogEntry } from '@/lib/visits';
import { VisitLogForm } from '@/components/VisitLogForm';

/** Log a visit of the rep's own. Lands on the new visit. */
export default function LogVisitScreen() {
  const t = useT();
  return (
    <VisitLogForm
      submitLabel={t('visits.form.saveNew')}
      onSubmit={async (input) => {
        const visit = await createLogEntry(input);
        router.replace(`/visits/${visit._id}`);
      }}
    />
  );
}
