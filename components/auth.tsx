import { ReactNode, useCallback, useRef, useState } from 'react';
import {
  BackHandler,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/lib/api';
import { colors, radius, spacing } from '@/lib/theme';
import { t as translate, useT } from '@/lib/i18n';
import { BrandLogo } from './BrandLogo';
import { ScrimPhoto } from './Photo';
import { Button, IconName, useAnnounce } from './ui';

// Building blocks for the signed-out and onboarding screens, so they share
// one layout, field and full-screen-state look.

/** Safe-area + keyboard-aware scrolling page with an optional back chevron. */
export function AuthScreen({
  children,
  back = false,
  center = false,
  footer,
}: {
  children: ReactNode;
  /** true = router.back(); a function overrides it (e.g. step back inside one screen). */
  back?: boolean | (() => void);
  center?: boolean;
  footer?: ReactNode;
}) {
  const t = useT();
  const onBack = typeof back === 'function' ? back : back ? () => router.back() : null;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        {onBack ? (
          <TouchableOpacity
            style={styles.back}
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.goBack')}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <ScrollView
          contentContainerStyle={[styles.content, center && styles.contentCenter]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * The sign-in screens' first impression: a bundled photo under the navy scrim, the wordmark at the
 * top, and the screen's title and line on the scrim's dark foot (never on the photo's light part).
 */
export function AuthBand({
  source,
  title,
  line,
  height = 176,
  scrimTop = 0.62,
}: {
  source: ImageSourcePropType;
  /** Set when the band carries the screen's heading (then it's the header for screen readers). */
  title?: string;
  line: string;
  height?: number;
  /** Raise for a light photo, so nothing on it crosses a bright patch. */
  scrimTop?: number;
}) {
  return (
    <ScrimPhoto source={source} style={[styles.band, { minHeight: height }]} top={scrimTop} bottom={0.96}>
      <View style={styles.bandInner}>
        <BrandLogo size="sm" align="left" tone="onNavy" />
        <View style={styles.bandText}>
          {title ? (
            <Text style={styles.bandTitle} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          <Text style={title ? styles.bandLine : styles.bandLead}>{line}</Text>
        </View>
      </View>
    </ScrimPhoto>
  );
}

export function AuthHeader({
  title,
  subtitle,
  align = 'left',
}: {
  title: string;
  subtitle?: ReactNode;
  align?: 'left' | 'center';
}) {
  const textAlign = align;
  return (
    <View style={styles.header}>
      <Text style={[styles.title, { textAlign }]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { textAlign }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** Text input with a leading icon, focus ring, and an eye toggle for passwords. */
export function IconField({
  icon,
  label,
  error,
  secureTextEntry,
  ...rest
}: TextInputProps & { icon: IconName; label: string; error?: boolean }) {
  const t = useT();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isSecret = !!secureTextEntry;
  return (
    <View style={[styles.field, focused && styles.fieldFocused, error && styles.fieldError]}>
      <Ionicons name={icon} size={20} color={focused ? colors.primary : colors.textMuted} />
      <TextInput
        placeholder={label}
        {...rest}
        style={styles.fieldInput}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        secureTextEntry={isSecret && hidden}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
      />
      {isSecret ? (
        <TouchableOpacity
          onPress={() => setHidden((h) => !h)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={hidden ? t('auth.showPassword') : t('auth.hidePassword')}
        >
          <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Six digit boxes backed by one hidden input, so paste and SMS autofill work. */
export function OtpInput({
  value,
  onChange,
  error = false,
  length = 6,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  length?: number;
  autoFocus?: boolean;
}) {
  const t = useT();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);
  const digits = value.split('');
  return (
    // The row is the one accessible element (the real input is a 1px hidden field), so
    // screen-reader users get a label and a double-tap that opens the keyboard.
    <Pressable
      style={styles.otpRow}
      onPress={() => input.current?.focus()}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t(error ? 'auth.otp.a11yIncorrect' : 'auth.otp.a11y', { length, entered: digits.length })}
      accessibilityHint={t('auth.otp.hint')}
    >
      {Array.from({ length }).map((_, i) => {
        const active = focused && (i === digits.length || (i === length - 1 && digits.length === length));
        return (
          <View
            key={i}
            style={[styles.otpBox, digits[i] && styles.otpBoxFilled, active && styles.otpBoxActive, error && styles.fieldError]}
          >
            <Text style={styles.otpDigit} maxFontSizeMultiplier={1.6}>
              {digits[i] ?? ''}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.otpHidden}
        caretHidden
        accessibilityLabel={t('auth.otp.fieldA11y', { length })}
      />
    </Pressable>
  );
}

/** Inline error text under a field/OTP: announced when it appears or changes. */
export function InlineError({ message, style }: { message: string; style?: StyleProp<TextStyle> }) {
  useAnnounce(message);
  return (
    <Text style={style} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

/**
 * For the steps right after sign-in (notifications):
 * Android back would land on a signed-out screen that just redirects forward
 * again, skipping the step, so consume it while the screen is focused. iOS
 * swipe-back is disabled for these routes in (auth)/_layout.
 */
export function useBlockHardwareBack(onBack?: () => void) {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack?.();
        return true;
      });
      return () => sub.remove();
    }, [onBack])
  );
}

export function TextLink({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="link"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.linkTarget, style]}
    >
      <Text style={[styles.link, disabled && styles.linkDisabled]}>{title}</Text>
    </TouchableOpacity>
  );
}

type Tone = 'primary' | 'danger' | 'slate';

/** Soft circular icon "illustration", optionally with a small corner badge. */
export function IconBadge({
  icon,
  tone = 'primary',
  size = 112,
  badge,
}: {
  icon: IconName;
  tone?: Tone;
  size?: number;
  badge?: { icon: IconName; tone: Tone };
}) {
  const t = TONES[tone];
  return (
    <View
      style={[styles.badgeCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={icon} size={size * 0.5} color={t.fg} />
      {badge ? (
        <View style={[styles.cornerBadge, { backgroundColor: TONES[badge.tone].fg }]}>
          <Ionicons name={badge.icon} size={18} color={colors.primaryText} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Full-screen state (refusal, offline, maintenance, success): illustration,
 * title, message, primary action, optional secondary link.
 */
export function StatusScreen({
  art,
  title,
  message,
  action,
  link,
  children,
  onBack,
}: {
  art: ReactNode;
  title: string;
  message: string;
  action?: { title: string; onPress: () => void; loading?: boolean };
  link?: { title: string; onPress: () => void };
  children?: ReactNode;
  onBack?: () => void;
}) {
  // These replace the screen content without a navigation, so say what happened.
  useAnnounce(`${title}. ${message}`);
  return (
    <AuthScreen back={onBack ?? false} center>
      <View style={styles.status}>
        {art}
        <Text style={styles.statusTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.statusMessage}>{message}</Text>
        {children}
      </View>
      {action ? <Button title={action.title} onPress={action.onPress} loading={action.loading} /> : null}
      {link ? <TextLink title={link.title} onPress={link.onPress} style={styles.statusLink} /> : null}
    </AuthScreen>
  );
}

export function OfflineScreen({ onRetry, onBack, retrying }: { onRetry: () => void; onBack?: () => void; retrying?: boolean }) {
  const t = useT();
  return (
    <StatusScreen
      onBack={onBack}
      art={<IconBadge icon="wifi" tone="slate" badge={{ icon: 'close', tone: 'danger' }} />}
      title={t('auth.offline.title')}
      message={t('auth.offline.message')}
      action={{ title: t('common.tryAgainTitle'), onPress: onRetry, loading: retrying }}
    />
  );
}

export function MaintenanceScreen({ onRetry, onBack, retrying }: { onRetry: () => void; onBack?: () => void; retrying?: boolean }) {
  const t = useT();
  return (
    <StatusScreen
      onBack={onBack}
      art={<IconBadge icon="construct" tone="slate" />}
      title={t('auth.maintenance.title')}
      message={t('auth.maintenance.message')}
      action={{ title: t('common.tryAgainTitle'), onPress: onRetry, loading: retrying }}
    />
  );
}

/** Which full-screen state (if any) a failed sign-in request should show. */
export type AuthFailure = { kind: 'offline' } | { kind: 'maintenance' } | { kind: 'message'; message: string; status: number };

export function classifyAuthError(err: unknown): AuthFailure {
  if (err instanceof ApiError) {
    if (err.code === 'NETWORK') return { kind: 'offline' };
    if (err.status === 502 || err.status === 503 || err.status === 504) return { kind: 'maintenance' };
    return { kind: 'message', message: err.message, status: err.status };
  }
  return { kind: 'message', message: translate('common.somethingWrong'), status: 0 };
}

const TONES: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: colors.primarySoft, fg: colors.primary },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  slate: { bg: colors.slateSoft, fg: colors.slate },
};

const styles = StyleSheet.create({
  band: { borderRadius: radius.lg, marginBottom: spacing.lg },
  bandInner: { flex: 1, justifyContent: 'space-between', padding: spacing.md + 4, gap: spacing.lg },
  bandText: { gap: spacing.xs },
  bandTitle: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.3 },
  bandLine: { fontSize: 15, lineHeight: 21, color: colors.onNavyMuted },
  bandLead: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.primaryText },
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.surface },
  back: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, alignSelf: 'flex-start' },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  contentCenter: { justifyContent: 'center' },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  header: { marginBottom: spacing.lg },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.textMuted, marginTop: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm + 4,
  },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  fieldError: { borderColor: colors.danger },
  fieldInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.sm + 4 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  otpBox: {
    // Not individual tap targets (the whole row is); shrink on narrow phones, grow with text.
    minWidth: 36,
    flexBasis: 48,
    flexShrink: 1,
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: { backgroundColor: colors.surface },
  otpBoxActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.surface },
  otpDigit: { fontSize: 22, fontWeight: '600', color: colors.text },
  otpHidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  // 48pt tall so the link meets the minimum touch target on its own.
  linkTarget: { minHeight: 48, justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '600', color: colors.primary },
  linkDisabled: { color: colors.textMuted },
  badgeCircle: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  cornerBadge: {
    position: 'absolute',
    right: 10,
    bottom: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  status: { alignItems: 'center', marginBottom: spacing.xl },
  statusTitle: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: spacing.lg },
  statusMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  statusLink: { alignSelf: 'center', marginTop: spacing.lg },
});
