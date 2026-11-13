import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { errorMessage } from '@/lib/api';
import { getVisitBrief, isAllowanceUsedUp } from '@/lib/ai';
import { formatDate, formatTime } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { AiBriefResult, AiStatus } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { Button } from './ui';

/**
 * "Before you go": an AI brief of the rep's own history with this clinic. Only made when the rep
 * asks (each new brief is an AI action); a brief from the last 12 hours comes back free.
 */
export function AiBriefCard({ visitId, ai, offline }: { visitId: string; ai: AiStatus; offline: boolean }) {
  const t = useT();
  const [result, setResult] = useState<AiBriefResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [usedUp, setUsedUp] = useState<string | null>(null);

  async function load(refresh = false) {
    setBusy(true);
    setProblem(null);
    try {
      setResult(await getVisitBrief(visitId, refresh));
    } catch (err) {
      if (isAllowanceUsedUp(err)) setUsedUp(err.message);
      else setProblem(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const brief = result?.brief;
  const canUpgrade = ai.plan === 'standard' && ai.proMonthly > 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="sparkles-outline" size={18} color={colors.primaryOnSoft} />
        <Text style={[type.cardTitle, styles.flex]} accessibilityRole="header">
          {t('ai.brief.title')}
        </Text>
      </View>

      {brief ? (
        <View style={styles.body}>
          <Text style={styles.headline}>{brief.headline}</Text>
          {brief.lastTime ? <Section label={t('ai.brief.lastTime')} lines={[brief.lastTime]} /> : null}
          <Section label={t('ai.brief.open')} lines={brief.openItems} />
          <Section label={t('ai.brief.focus')} lines={brief.focus} />
          <Section label={t('ai.brief.cautions')} lines={brief.cautions} />
          <Text style={type.secondary}>
            {result?.cached && result.generatedAt
              ? `${t('ai.brief.saved', { date: `${formatDate(result.generatedAt, { month: 'short', day: 'numeric' })}, ${formatTime(result.generatedAt)}` })} · ${t('ai.disclaimer')}`
              : t('ai.disclaimer')}
          </Text>
          {result?.cached && ai.remaining > 0 ? (
            <TouchableOpacity style={styles.link} onPress={() => load(true)} disabled={busy || offline} accessibilityRole="button">
              <Ionicons name="refresh" size={16} color={colors.primaryOnSoft} />
              <Text style={styles.linkText}>{t('ai.brief.refresh')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : result?.reason === 'noHistory' ? (
        <Text style={type.body}>{t('ai.brief.noHistory')}</Text>
      ) : usedUp ? (
        <View style={styles.body}>
          <Text style={type.body}>{usedUp}</Text>
          {canUpgrade ? <Button title={t('ai.seePro')} variant="secondary" onPress={() => router.push('/plan')} /> : null}
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={type.secondary}>{t('ai.brief.hint')}</Text>
          {problem ? <Text style={styles.error}>{problem}</Text> : null}
          <Button title={t('ai.brief.cta')} icon="sparkles-outline" variant="secondary" onPress={() => load()} loading={busy} disabled={offline} />
        </View>
      )}
    </View>
  );
}

function Section({ label, lines }: { label: string; lines: string[] }) {
  if (!lines.length) return null;
  return (
    <View style={styles.section} accessible accessibilityLabel={`${label}: ${lines.join('. ')}`}>
      <Text style={type.label}>{label}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={type.body}>
          {lines.length > 1 ? `• ${line}` : line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  body: { gap: spacing.sm },
  headline: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  section: { gap: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, alignSelf: 'flex-start' },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.primaryOnSoft },
  error: { fontSize: 13, color: colors.danger },
});
