import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { AppHeader } from '@/components/AppHeader';
import { screenStyles } from '@/components/ui';

/**
 * Home. Phase 1 only greets the rep; the next-visit card, counts and upcoming list arrive with
 * the dashboard in phase 2.
 */
export default function HomeScreen() {
  const { rep } = useAuth();
  const t = useT();
  const firstName = rep?.name.split(/\s+/)[0];

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={screenStyles.content}>
        <AppHeader />
        <Text style={type.screenTitle} accessibilityRole="header">
          {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')}
        </Text>
        {rep?.company ? <Text style={[type.secondary, styles.company]}>{rep.company}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  company: { marginTop: spacing.xs },
});
