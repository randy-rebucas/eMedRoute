import { StyleSheet, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import { openRoute, RouteStop } from '@/lib/route';
import { colors, radius, spacing } from '@/lib/theme';
import { mono, type } from '@/lib/typography';
import { Button, IconTile } from './ui';

/**
 * Home's route card, shown when today has two or more stops: the stops as a short timeline, and
 * Start route, which opens Google Maps through all of them in visit order.
 */
export function TodayRoute({ stops }: { stops: RouteStop[] }) {
  const t = useT();
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <IconTile icon="map-outline" tone="primary" size={36} />
        <View style={styles.headText}>
          <Text style={type.cardTitle} accessibilityRole="header">
            {t('home.route.title')}
          </Text>
          <Text style={type.secondary}>{t('home.route.stops', { count: stops.length })}</Text>
        </View>
      </View>

      <View style={styles.stops}>
        {stops.map((stop, i) => (
          <View key={stop.id} style={styles.stop} accessible accessibilityLabel={`${i + 1}. ${stop.time}, ${stop.clinicName}`}>
            <View style={styles.rail}>
              <View style={[styles.dot, i === stops.length - 1 && styles.dotLast]} />
              {i < stops.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <Text style={[mono, styles.time]} maxFontSizeMultiplier={1.6}>
              {stop.time}
            </Text>
            <Text style={[type.body, styles.name]} numberOfLines={1}>
              {stop.clinicName}
            </Text>
          </View>
        ))}
      </View>

      <Button
        title={t('home.route.start')}
        icon="navigate-outline"
        onPress={() => openRoute(stops).catch(() => {})}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  headText: { flex: 1 },
  stops: { marginTop: spacing.md },
  stop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 4, minHeight: 32 },
  // A dot per stop joined by a line: the order the rep drives them in.
  rail: { width: 12, alignItems: 'center', alignSelf: 'stretch' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, borderWidth: 2, borderColor: colors.slate, backgroundColor: colors.surface },
  dotLast: { backgroundColor: colors.slate },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  time: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text, minWidth: 48 },
  name: { flex: 1 },
  button: { marginTop: spacing.sm },
});
