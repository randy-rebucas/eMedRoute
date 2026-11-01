import { useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClinics } from '@/lib/clinics';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { ListFooter, LoadingView } from './ui';

export type LinkedClinic = { id: string; name: string; location: string };

/**
 * "Clinic on MyClinicSoft (optional)" on an own log entry: link it to a clinic from the
 * directory, so deliveries can go to that clinic. The clinic's name and location then stand in
 * for the typed ones (the server uses the clinic's).
 */
export function ClinicLinkField({ value, onChange }: { value: LinkedClinic | null; onChange: (clinic: LinkedClinic | null) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={type.label}>
        {t('deliveries.link.label')} <Text style={styles.optional}>{t('common.optional')}</Text>
      </Text>
      {value ? (
        <View style={styles.linked} accessible accessibilityLabel={t('deliveries.link.linked', { clinic: value.name })}>
          <Ionicons name="link-outline" size={20} color={colors.primaryOnSoft} />
          <View style={styles.flex}>
            <Text style={[type.body, styles.linkedName]}>{value.name}</Text>
            {value.location ? <Text style={type.secondary}>{value.location}</Text> : null}
          </View>
        </View>
      ) : null}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => setOpen(true)} accessibilityRole="button">
          <Ionicons name={value ? 'swap-horizontal-outline' : 'link-outline'} size={20} color={colors.primary} />
          <Text style={styles.actionText}>{value ? t('deliveries.link.change') : t('deliveries.link.choose')}</Text>
        </TouchableOpacity>
        {value ? (
          <TouchableOpacity style={styles.action} onPress={() => onChange(null)} accessibilityRole="button">
            <Ionicons name="close-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.actionText, styles.muted]}>{t('deliveries.link.remove')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={type.secondary}>{t('deliveries.link.hint')}</Text>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ClinicChooser
          onClose={() => setOpen(false)}
          onPick={(clinic) => {
            onChange(clinic);
            setOpen(false);
          }}
        />
      </Modal>
    </View>
  );
}

function ClinicChooser({ onClose, onPick }: { onClose: () => void; onPick: (clinic: LinkedClinic) => void }) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useClinics(query);

  return (
    <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
      <View style={styles.modalHead}>
        <Text style={type.cardTitle} accessibilityRole="header">
          {t('deliveries.link.title')}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
          <Ionicons name="close-outline" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={20} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('deliveries.link.search')}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          accessibilityLabel={t('deliveries.link.search')}
          autoCorrect={false}
          autoFocus
        />
      </View>
      {list.loading && !list.items.length ? (
        <LoadingView />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReached={list.hasMore ? list.loadMore : undefined}
          ListEmptyComponent={<Text style={type.secondary}>{list.error ?? (query.trim() ? t('clinics.noMatch') : t('clinics.empty'))}</Text>}
          ListFooterComponent={<ListFooter loadingMore={list.loadingMore} error={list.loadMoreError} onRetry={list.loadMore} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.option}
              onPress={() => onPick({ id: item.id, name: item.name, location: item.location ?? '' })}
              accessibilityRole="button"
            >
              <Ionicons name="business-outline" size={22} color={colors.slate} />
              <View style={styles.flex}>
                <Text style={type.body}>{item.name}</Text>
                {item.location ? <Text style={type.secondary}>{item.location}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md, gap: spacing.xs + 2 },
  optional: { fontWeight: '400', color: colors.textMuted },
  flex: { flex: 1, gap: 2 },
  linked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  linkedName: { fontWeight: '600', color: colors.primaryOnSoft },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48 },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  muted: { color: colors.textMuted },
  modal: { flex: 1, backgroundColor: colors.background },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md - 4,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: spacing.sm },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
