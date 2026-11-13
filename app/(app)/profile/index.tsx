import { useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PhotoPermissionError, PhotoSource, pickProfilePhoto } from '@/lib/avatar';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { updateProfile, useRepProfile } from '@/lib/profile';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { Avatar } from '@/components/Avatar';
import { ErrorState } from '@/components/ErrorState';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Button, IconName, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/**
 * The rep's profile: their picture and name on the app's navy (tap the picture to take, choose
 * or remove one), then contact details, About you and account dates as ruled cards, and Edit.
 */
export default function ProfileScreen() {
  const t = useT();
  const { setRepFromProfile } = useAuth();
  const { data: profile, loading, refreshing, error, refresh, offline, stale, updatedAt } = useRepProfile();
  const paddingBottom = useBottomPadding();
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading && !profile) return <LoadingView />;
  if (!profile) return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const shownName = [profile.title, fullName].filter(Boolean).join(' ');
  const hasPhoto = !!profile.profileImage;

  async function save(image: string | null) {
    setSaving(true);
    try {
      const saved = await updateProfile({ profileImage: image });
      // Home's header and More's card read the signed-in rep, so they change straight away.
      setRepFromProfile(saved);
      AccessibilityInfo.announceForAccessibility(image ? t('profile.photo.saved') : t('profile.photo.removed'));
    } catch (err) {
      Alert.alert(t('profile.photo.title'), isNetworkError(err) ? t('profile.photo.offline') : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function choose(source: PhotoSource) {
    setSheet(false);
    try {
      const image = await pickProfilePhoto(source);
      if (image) await save(image);
    } catch (err) {
      if (err instanceof PhotoPermissionError) {
        Alert.alert(t('profile.photo.title'), t('profile.photo.noCamera'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.photo.openSettings'), onPress: () => Linking.openSettings().catch(() => {}) },
        ]);
      } else {
        Alert.alert(t('profile.photo.title'), t('common.somethingWrong'));
      }
    }
  }

  function confirmRemove() {
    setSheet(false);
    Alert.alert(t('profile.photo.removeTitle'), t('profile.photo.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.photo.remove'), style: 'destructive', onPress: () => save(null) },
    ]);
  }

  const date = (value?: string) => (value ? formatDate(value, { month: 'short', day: 'numeric', year: 'numeric' }) : null);

  return (
    <>
      <ScrollView
        style={screenStyles.container}
        contentContainerStyle={[screenStyles.content, { paddingBottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {stale || offline ? (
          <View style={styles.status}>
            <ThinProgress active={stale && !offline} />
            <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('profile.offlineSubject')} />
          </View>
        ) : null}

        <View style={styles.hero}>
          <TouchableOpacity
            onPress={() => setSheet(true)}
            disabled={saving}
            style={styles.photoWrap}
            accessibilityRole="button"
            accessibilityLabel={hasPhoto ? t('profile.photo.change') : t('profile.photo.add')}
            accessibilityState={{ busy: saving }}
          >
            <Avatar name={fullName} image={profile.profileImage} size={112} tone="teal" />
            {saving ? (
              <View style={styles.photoBusy}>
                <ActivityIndicator color={colors.primaryText} />
              </View>
            ) : null}
            <View style={styles.camera}>
              <Ionicons name="camera" size={18} color={colors.primaryText} />
            </View>
          </TouchableOpacity>
          <Text style={styles.name} accessibilityRole="header">
            {shownName}
          </Text>
          {profile.company ? <Text style={styles.muted}>{profile.company}</Text> : null}
          {profile.territory ? (
            <View style={styles.territory}>
              <Ionicons name="location" size={13} color={colors.primaryText} />
              <Text style={styles.territoryText}>{profile.territory}</Text>
            </View>
          ) : null}
          <TouchableOpacity onPress={() => setSheet(true)} disabled={saving} style={styles.changeLink} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.changeText}>{saving ? t('profile.photo.saving') : hasPhoto ? t('profile.photo.change') : t('profile.photo.add')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.groupTitle}>{t('profile.contact')}</Text>
        <View style={styles.card}>
          <Row icon="mail-outline" label={t('profile.email')} value={profile.email} note={t('profile.emailNote')} locked />
          <Row icon="call-outline" label={t('profile.phone')} value={profile.phone} tabular />
          <Row icon="business-outline" label={t('profile.company')} value={profile.company} />
          <Row icon="map-outline" label={t('profile.territory')} value={profile.territory} last />
        </View>

        <Text style={styles.groupTitle}>{t('profile.bio')}</Text>
        <View style={[styles.card, styles.bioCard]}>
          {profile.bio ? (
            <Text style={type.body}>{profile.bio}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push('/profile/edit')} accessibilityRole="button" style={styles.bioEmpty}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primaryOnSoft} />
              <Text style={[type.body, styles.bioEmptyText]}>{t('profile.bioEmpty')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {profile.createdAt || profile.lastLogin ? (
          <>
            <Text style={styles.groupTitle}>{t('profile.account')}</Text>
            <View style={styles.card}>
              {profile.createdAt ? (
                <Row icon="calendar-outline" label={t('profile.memberSince')} value={date(profile.createdAt)} tabular last={!profile.lastLogin} />
              ) : null}
              {profile.lastLogin ? <Row icon="log-in-outline" label={t('profile.lastSignIn')} value={date(profile.lastLogin)} tabular last /> : null}
            </View>
          </>
        ) : null}

        <Button title={t('profile.edit')} icon="create-outline" variant="secondary" onPress={() => router.push('/profile/edit')} />
      </ScrollView>

      <PhotoSheet
        visible={sheet}
        hasPhoto={hasPhoto}
        onClose={() => setSheet(false)}
        onCamera={() => choose('camera')}
        onLibrary={() => choose('library')}
        onRemove={confirmRemove}
      />
    </>
  );
}

/** One fact in a ruled card: icon, label, value, and an optional note (the email's "how you sign in"). */
function Row({
  icon,
  label,
  value,
  note,
  locked,
  tabular,
  last,
}: {
  icon: IconName;
  label: string;
  value?: string | null;
  note?: string;
  locked?: boolean;
  tabular?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowRule]} accessible accessibilityLabel={[label, value || '—', note].filter(Boolean).join(', ')}>
      <Ionicons name={icon} size={20} color={colors.slate} style={styles.rowIcon} />
      <View style={styles.rowText}>
        <Text style={type.secondary}>{label}</Text>
        <Text style={[type.body, tabular && styles.tabular, !value && { color: colors.textMuted }]}>{value || '—'}</Text>
        {note ? <Text style={[type.secondary, styles.note]}>{note}</Text> : null}
      </View>
      {locked ? <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} /> : null}
    </View>
  );
}

/** Take, choose or remove the picture. A sheet, since Android alerts hold only three buttons. */
function PhotoSheet({
  visible,
  hasPhoto,
  onClose,
  onCamera,
  onLibrary,
  onRemove,
}: {
  visible: boolean;
  hasPhoto: boolean;
  onClose: () => void;
  onCamera: () => void;
  onLibrary: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.cancel')} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <Text style={type.cardTitle} accessibilityRole="header">
          {t('profile.photo.title')}
        </Text>
        <Text style={[type.secondary, styles.sheetHint]}>{t('profile.photo.hint')}</Text>
        <SheetOption icon="camera-outline" label={t('profile.photo.camera')} onPress={onCamera} />
        <SheetOption icon="images-outline" label={t('profile.photo.library')} onPress={onLibrary} />
        {hasPhoto ? <SheetOption icon="trash-outline" label={t('profile.photo.remove')} onPress={onRemove} danger /> : null}
        <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={styles.sheetCancel} />
      </SafeAreaView>
    </Modal>
  );
}

function SheetOption({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.option} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.text} />
      <Text style={[type.body, styles.optionText, danger && { color: colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  status: { marginBottom: spacing.sm },
  // The rep on the app's navy, as on More: the picture leads.
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  photoWrap: { width: 112, height: 112, marginBottom: spacing.md },
  photoBusy: { ...StyleSheet.absoluteFill, borderRadius: 56, backgroundColor: 'rgba(11, 33, 54, 0.55)', alignItems: 'center', justifyContent: 'center' },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 22, fontWeight: '700', color: colors.primaryText, textAlign: 'center', letterSpacing: -0.2 },
  muted: { fontSize: 14, color: colors.onNavyMuted, marginTop: 2, textAlign: 'center' },
  territory: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.primary },
  territoryText: { fontSize: 12, fontWeight: '600', color: colors.primaryText },
  changeLink: { marginTop: spacing.md, minHeight: 32, justifyContent: 'center' },
  changeText: { fontSize: 15, fontWeight: '600', color: colors.primaryText, textDecorationLine: 'underline' },
  groupTitle: { ...type.label, color: colors.textMuted, marginBottom: spacing.sm, marginLeft: 2 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  bioCard: { paddingVertical: spacing.md },
  bioEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  bioEmptyText: { flex: 1, color: colors.primaryOnSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingVertical: spacing.sm + 4, minHeight: 56 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: { alignSelf: 'flex-start', marginTop: 2 },
  rowText: { flex: 1, gap: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  note: { marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11, 33, 54, 0.4)' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
  sheetHint: { marginTop: 2, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionText: { flex: 1 },
  sheetCancel: { marginTop: spacing.md },
});
