import { useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDay } from '@/lib/format';
import { PlainKey, TFunction, useT } from '@/lib/i18n';
import {
  decodeCsvBytes,
  IMPORT_COLUMNS,
  IMPORT_TEMPLATE,
  ImportField,
  ImportResult,
  ImportRow,
  importProducts,
  MAX_IMPORT_ROWS,
  ParsedImport,
  parseProductCsv,
  RowProblem,
} from '@/lib/productImport';
import { colors, radius, spacing } from '@/lib/theme';
import { mono, type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { Illustration } from '@/components/Illustration';
import { Banner, Button, IconTile, screenStyles, useBottomPadding } from '@/components/ui';

/** Bigger than any 200-row product sheet; stops a wrong pick (a video, an archive) being read. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** Rows listed in the preview before "and N more". */
const SHOW_ROWS = 20;

const FIELD_LABEL: Record<ImportField, PlainKey> = {
  name: 'products.form.name',
  category: 'products.form.category',
  manufacturer: 'products.form.manufacturer',
  description: 'products.form.description',
  packaging: 'products.form.packaging',
  expiryDate: 'products.expiry',
  strength: 'products.form.strength',
  dosage: 'products.form.dosage',
  status: 'products.form.status',
};

function problemText(t: TFunction, p: RowProblem): string {
  switch (p.kind) {
    case 'missing':
      return t('products.import.problem.missing', { fields: p.fields.map((f) => t(FIELD_LABEL[f])).join(', ') });
    case 'tooLong':
      return t('products.import.problem.tooLong', { field: t(FIELD_LABEL[p.field]), max: p.max });
    case 'badDate':
      return t('products.import.problem.badDate', { value: p.value });
    case 'badStatus':
      return t('products.import.problem.badStatus', { value: p.value });
    case 'badPack':
      return t('products.import.problem.badPack', { value: p.value });
  }
}

function fileErrorText(t: TFunction, parsed: Extract<ParsedImport, { ok: false }>): string {
  switch (parsed.error) {
    case 'empty':
      return t('products.import.error.empty');
    case 'notCsv':
      return t('products.import.error.notCsv');
    case 'tooManyRows':
      return t('products.import.error.tooManyRows', { max: MAX_IMPORT_ROWS });
    case 'missingColumns':
      return t('products.import.error.missingColumns', { columns: (parsed.columns ?? []).join(', ') });
  }
}

type Step =
  | { kind: 'pick' }
  | { kind: 'preview'; fileName: string; ready: ImportRow[]; problems: { line: number; texts: string[] }[] }
  | { kind: 'done'; result: ImportResult; sent: ImportRow[] };

/**
 * Import products from a CSV file: choose the file, see every row checked (problems by
 * spreadsheet row number), then send the rows that passed in one request.
 */
export default function ImportProductsScreen() {
  const t = useT();
  const paddingBottom = useBottomPadding();
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // State lags a frame: two taps in one frame must not import the rows twice.
  const busyRef = useRef(false);

  async function choose() {
    setProblem(null);
    let picked;
    try {
      picked = await File.pickFileAsync({ mimeTypes: '*/*' });
    } catch {
      setProblem(t('products.import.error.unreadable'));
      return;
    }
    if (picked.canceled) return;
    const file = picked.result;
    let text: string;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('too big');
      text = decodeCsvBytes(await file.bytes());
    } catch {
      setProblem(t('products.import.error.unreadable'));
      return;
    }
    // A zip archive (xlsx, numbers, ods) starts "PK", whatever the file is called.
    const parsed = text.startsWith('PK') ? ({ ok: false, error: 'notCsv' } as const) : parseProductCsv(text, file.name);
    if (!parsed.ok) {
      setStep({ kind: 'pick' });
      setProblem(fileErrorText(t, parsed));
      return;
    }
    setStep({
      kind: 'preview',
      fileName: file.name,
      ready: parsed.rows.filter((r) => !r.problems.length),
      problems: parsed.rows.filter((r) => r.problems.length).map((r) => ({ line: r.line, texts: r.problems.map((p) => problemText(t, p)) })),
    });
  }

  async function send(ready: ImportRow[]) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const result = await importProducts(ready.map((r) => r.input));
      setStep({ kind: 'done', result, sent: ready });
    } catch (err) {
      if (isNetworkError(err)) setProblem(t('common.needsConnection'));
      else if (err instanceof ApiError && err.code === 'INVALID_ROWS' && step.kind === 'preview') {
        // The server's rules caught something the app didn't: show those rows by their file row.
        const rows = ((err.body as { rows?: { row: number; error: string }[] })?.rows ?? []).filter((r) => ready[r.row]);
        const bad = new Set(rows.map((r) => r.row));
        setStep({
          ...step,
          ready: ready.filter((_, i) => !bad.has(i)),
          problems: [...step.problems, ...rows.map((r) => ({ line: ready[r.row].line, texts: [r.error] }))].sort((a, b) => a.line - b.line),
        });
      } else setProblem(errorMessage(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView style={screenStyles.container} contentContainerStyle={[screenStyles.content, { paddingBottom }]}>
      {step.kind === 'pick' ? (
        <>
          <View style={styles.hero}>
            <Illustration name="products" size={128} />
            <Text style={[type.body, styles.center]}>{t('products.import.intro')}</Text>
          </View>
          <View style={styles.card}>
            <Text style={type.label}>{t('products.import.required')}</Text>
            <Columns required />
            <Text style={[type.label, styles.gap]}>{t('products.import.optional')}</Text>
            <Columns required={false} />
            <Hint icon="calendar-outline" text={t('products.import.formatHint')} />
            <Hint icon="copy-outline" text={t('products.import.duplicatesHint')} />
          </View>
          {problem ? <Banner message={problem} /> : null}
          <Button title={t('products.import.choose')} icon="document-attach-outline" onPress={() => choose().catch(() => {})} />
          <Button
            title={t('products.import.template')}
            icon="share-outline"
            variant="secondary"
            onPress={() => Share.share({ message: IMPORT_TEMPLATE, title: 'products.csv' }).catch(() => {})}
          />
        </>
      ) : step.kind === 'preview' ? (
        <>
          <View style={styles.fileRow}>
            <IconTile icon="document-text-outline" tone="slate" size={44} />
            <View style={styles.flex}>
              <Text style={type.cardTitle} numberOfLines={1}>
                {step.fileName}
              </Text>
              <Text style={type.secondary}>
                {t('products.import.ready', { count: step.ready.length })}
                {step.problems.length ? ` · ${t('products.import.problemRows', { count: step.problems.length })}` : ''}
              </Text>
            </View>
          </View>

          {step.problems.length ? (
            <View style={[styles.card, styles.problemCard]}>
              <View style={styles.cardHead}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
                <Text style={[type.cardTitle, styles.flex]} accessibilityRole="header">
                  {t('products.import.problemRows', { count: step.problems.length })}
                </Text>
              </View>
              <Text style={type.secondary}>{t('products.import.problemsHint')}</Text>
              {step.problems.slice(0, SHOW_ROWS).map((p) => (
                <View key={p.line} style={styles.line} accessible>
                  <Text style={[type.label, mono]}>{t('products.import.row', { line: p.line })}</Text>
                  {p.texts.map((text) => (
                    <Text key={text} style={type.secondary}>
                      {text}
                    </Text>
                  ))}
                </View>
              ))}
              <More count={step.problems.length - SHOW_ROWS} />
            </View>
          ) : null}

          {step.ready.length ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
                <Text style={[type.cardTitle, styles.flex]} accessibilityRole="header">
                  {t('products.import.ready', { count: step.ready.length })}
                </Text>
              </View>
              {step.ready.slice(0, SHOW_ROWS).map((r) => (
                <View key={r.line} style={styles.readyRow} accessible>
                  <Text style={[type.body, styles.flex]} numberOfLines={1}>
                    {[r.input.name, r.input.strength].filter(Boolean).join(' ')}
                  </Text>
                  <Text style={[type.secondary, mono]}>{formatDay(r.input.expiryDate, { month: 'short', year: 'numeric' })}</Text>
                </View>
              ))}
              <More count={step.ready.length - SHOW_ROWS} />
            </View>
          ) : null}

          {problem ? <Banner message={problem} /> : null}
          {step.ready.length ? (
            <Button
              title={t('products.import.send', { count: step.ready.length })}
              icon="cloud-upload-outline"
              onPress={() => send(step.ready)}
              loading={busy}
            />
          ) : null}
          <Button title={t('products.import.chooseAnother')} icon="document-attach-outline" variant="secondary" onPress={() => choose().catch(() => {})} disabled={busy} />
        </>
      ) : (
        <>
          <View style={styles.hero}>
            <IconTile icon={step.result.created ? 'checkmark-circle-outline' : 'information-circle-outline'} tone={step.result.created ? 'primary' : 'slate'} size={80} />
            <Text style={[type.screenTitle, styles.center]} accessibilityRole="header">
              {step.result.created ? t('products.import.done', { count: step.result.created }) : t('products.import.doneNone')}
            </Text>
          </View>
          {step.result.skipped.length ? (
            <View style={styles.card}>
              <Text style={type.label}>{t('products.import.skipped')}</Text>
              {step.result.skipped.slice(0, SHOW_ROWS).map((s) => (
                <Text key={s.row} style={type.secondary}>
                  {[s.name, step.sent[s.row]?.input.strength].filter(Boolean).join(' ')}
                </Text>
              ))}
              <More count={step.result.skipped.length - SHOW_ROWS} />
            </View>
          ) : null}
          <Button title={t('products.import.finish')} onPress={() => router.back()} />
        </>
      )}
    </ScrollView>
  );
}

/** The column names exactly as the header row must spell them (never translated). */
function Columns({ required }: { required: boolean }) {
  return (
    <View style={styles.columns}>
      {[...IMPORT_COLUMNS.filter((c) => c.required === required).map((c) => c.field), ...(required ? [] : ['packCount', 'packUnit'])].map((name) => (
        <View key={name} style={styles.column}>
          <Text style={[mono, styles.columnText]}>{name}</Text>
        </View>
      ))}
    </View>
  );
}

function Hint({ icon, text }: { icon: 'calendar-outline' | 'copy-outline'; text: string }) {
  return (
    <View style={styles.hint}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={styles.hintIcon} />
      <Text style={[type.secondary, styles.flex]}>{text}</Text>
    </View>
  );
}

function More({ count }: { count: number }) {
  const t = useT();
  return count > 0 ? <Text style={[type.secondary, styles.more]}>{t('products.import.more', { count })}</Text> : null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  gap: { marginTop: spacing.md },
  hero: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  problemCard: { borderColor: colors.danger },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginTop: spacing.xs },
  column: { borderRadius: radius.sm, backgroundColor: colors.slateSoft, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  columnText: { fontSize: 13, color: colors.text },
  hint: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  hintIcon: { marginTop: 1 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, marginBottom: spacing.md },
  line: { paddingTop: spacing.sm, marginTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 2 },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  more: { marginTop: spacing.sm },
});
